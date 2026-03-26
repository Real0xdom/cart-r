-- Fix waiting-charge finalization and ensure paid bookings top up
-- the driver's pending earning when fare increases before completion.

-- Legacy trigger from early booking flow conflicts with later commission logic.
DROP TRIGGER IF EXISTS bookings_calculate_payout ON public.bookings;

CREATE OR REPLACE FUNCTION public.compute_driver_payout_for_booking(
  p_total_fare numeric,
  p_vehicle_type text
) RETURNS numeric
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_commission_settings jsonb;
  v_default_rate numeric := 15.0;
  v_commission_rate numeric := 15.0;
  v_platform_fee numeric := 0;
BEGIN
  SELECT value
  INTO v_commission_settings
  FROM public.platform_settings
  WHERE key = 'commission'
  LIMIT 1;

  v_default_rate := COALESCE(
    (v_commission_settings->>'default_rate')::numeric,
    15.0
  );

  v_commission_rate := COALESCE(
    (v_commission_settings->'by_vehicle_type'->>p_vehicle_type)::numeric,
    v_default_rate
  );

  v_platform_fee := ROUND(COALESCE(p_total_fare, 0) * (v_commission_rate / 100.0), 2);

  RETURN ROUND(COALESCE(p_total_fare, 0) - v_platform_fee, 2);
END;
$$;

CREATE OR REPLACE FUNCTION public.calculate_waiting_charges_from_values(
  p_vehicle_type public.vehicle_type,
  p_waiting_minutes numeric
) RETURNS numeric
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_free_minutes integer := 0;
  v_rate_per_minute numeric := 0;
  v_max_charge numeric := 0;
  v_chargeable_minutes numeric := 0;
  v_calculated_charge numeric := 0;
BEGIN
  IF COALESCE(p_waiting_minutes, 0) <= 0 THEN
    RETURN 0;
  END IF;

  SELECT
    free_waiting_minutes,
    charge_per_minute,
    max_waiting_charge
  INTO
    v_free_minutes,
    v_rate_per_minute,
    v_max_charge
  FROM public.waiting_charges_config
  WHERE vehicle_type = p_vehicle_type
    AND is_active = true
  LIMIT 1;

  v_chargeable_minutes := GREATEST(COALESCE(p_waiting_minutes, 0) - COALESCE(v_free_minutes, 0), 0);
  v_calculated_charge := v_chargeable_minutes * COALESCE(v_rate_per_minute, 0);

  IF v_max_charge IS NOT NULL THEN
    v_calculated_charge := LEAST(v_calculated_charge, v_max_charge);
  END IF;

  RETURN ROUND(v_calculated_charge);
END;
$$;

CREATE OR REPLACE FUNCTION public.calculate_waiting_charges(
  p_booking_id uuid
) RETURNS numeric
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_waiting_minutes numeric;
  v_vehicle_type public.vehicle_type;
BEGIN
  SELECT
    EXTRACT(EPOCH FROM (COALESCE(waiting_end_time, now()) - waiting_start_time)) / 60.0,
    vehicle_type
  INTO
    v_waiting_minutes,
    v_vehicle_type
  FROM public.bookings
  WHERE id = p_booking_id;

  RETURN public.calculate_waiting_charges_from_values(v_vehicle_type, v_waiting_minutes);
END;
$$;

CREATE OR REPLACE FUNCTION public.update_booking_total_fare()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.total_fare :=
    COALESCE(NEW.base_fare, 0)
    + COALESCE(NEW.distance_fare, 0)
    + COALESCE(NEW.time_fare, 0)
    + COALESCE(NEW.waiting_charges, 0)
    + COALESCE(NEW.addon_charges, 0)
    + COALESCE(NEW.tip_amount, 0)
    - COALESCE(NEW.discount_amount, 0);

  NEW.driver_payout := public.compute_driver_payout_for_booking(
    NEW.total_fare,
    NEW.vehicle_type::text
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.auto_stop_waiting_timer()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_waiting_minutes numeric := 0;
BEGIN
  IF NEW.status = 'in_progress' AND OLD.status = 'driver_arrived' THEN
    IF NEW.waiting_start_time IS NOT NULL AND NEW.waiting_end_time IS NULL THEN
      NEW.waiting_end_time := now();
      v_waiting_minutes := EXTRACT(EPOCH FROM (NEW.waiting_end_time - NEW.waiting_start_time)) / 60.0;
      NEW.waiting_duration_minutes := CEIL(GREATEST(v_waiting_minutes, 0));
      NEW.waiting_charges := public.calculate_waiting_charges_from_values(
        NEW.vehicle_type,
        v_waiting_minutes
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_paid_booking_driver_earning()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_earning public.driver_wallet_transactions%ROWTYPE;
  v_wallet_id uuid;
  v_target_payout numeric := 0;
  v_delta numeric := 0;
BEGIN
  IF NEW.driver_id IS NULL
     OR COALESCE(NEW.payment_status::text, '') <> 'paid'
     OR NEW.status IN ('completed', 'cancelled')
     OR COALESCE(NEW.payment_method::text, 'cash') IN ('cash', 'wallet_plus_cash')
  THEN
    RETURN NEW;
  END IF;

  SELECT *
  INTO v_earning
  FROM public.driver_wallet_transactions
  WHERE booking_id = NEW.id
    AND driver_id = NEW.driver_id
    AND type = 'earning'
    AND status = 'completed'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_earning.id IS NULL OR v_earning.balance_type <> 'pending' THEN
    RETURN NEW;
  END IF;

  v_target_payout := public.compute_driver_payout_for_booking(
    COALESCE(NEW.total_fare, 0),
    NEW.vehicle_type::text
  );
  v_delta := ROUND(v_target_payout - COALESCE(v_earning.amount, 0), 2);

  IF v_delta <= 0 THEN
    RETURN NEW;
  END IF;

  SELECT id
  INTO v_wallet_id
  FROM public.driver_wallets
  WHERE driver_id = NEW.driver_id;

  IF v_wallet_id IS NULL THEN
    v_wallet_id := public.ensure_driver_wallet(NEW.driver_id);
  END IF;

  UPDATE public.driver_wallets
  SET
    pending_balance = pending_balance + v_delta,
    total_earned = total_earned + v_delta,
    updated_at = now()
  WHERE id = v_wallet_id;

  UPDATE public.driver_wallet_transactions
  SET
    amount = amount + v_delta,
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'fare_adjusted_at', now(),
      'fare_adjustment_delta', v_delta,
      'gross_total_fare', NEW.total_fare,
      'target_driver_payout', v_target_payout
    )
  WHERE id = v_earning.id;

  UPDATE public.bookings
  SET
    driver_payout = v_target_payout,
    updated_at = now()
  WHERE id = NEW.id
    AND COALESCE(driver_payout, 0) IS DISTINCT FROM v_target_payout;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_paid_booking_driver_earning ON public.bookings;
CREATE TRIGGER trg_sync_paid_booking_driver_earning
  AFTER UPDATE OF total_fare, waiting_charges, addon_charges, tip_amount
  ON public.bookings
  FOR EACH ROW
  WHEN (
    NEW.driver_id IS NOT NULL
    AND NEW.payment_status = 'paid'
    AND NEW.status <> 'completed'
    AND (
      OLD.total_fare IS DISTINCT FROM NEW.total_fare
      OR OLD.driver_payout IS DISTINCT FROM NEW.driver_payout
      OR OLD.waiting_charges IS DISTINCT FROM NEW.waiting_charges
      OR OLD.addon_charges IS DISTINCT FROM NEW.addon_charges
      OR OLD.tip_amount IS DISTINCT FROM NEW.tip_amount
    )
  )
  EXECUTE FUNCTION public.sync_paid_booking_driver_earning();
