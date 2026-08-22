-- Replace credit_driver_earning so cash-ride commission deduction is safe
-- even when the driver's available balance is insufficient.
--
-- Key changes:
-- - Uses admin-configured commission from platform_settings
-- - Allows cash commission deduction to drive available_balance negative
-- - Tracks newly created commission debt in total_commission_owed
-- - Preserves pending-balance behavior for online rides

CREATE OR REPLACE FUNCTION public.credit_driver_earning(
  p_driver_id uuid,
  p_booking_id uuid,
  p_total_fare numeric,
  p_is_cash boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_commission_settings jsonb;
  v_default_rate numeric;
  v_vehicle_type text;
  v_commission_rate numeric;
  v_platform_fee numeric;
  v_driver_share numeric;
  v_wallet_id uuid;
  v_existing_earning uuid;
BEGIN
  -- Idempotency guard
  SELECT id
  INTO v_existing_earning
  FROM public.driver_wallet_transactions
  WHERE booking_id = p_booking_id
    AND type = 'earning'
    AND driver_id = p_driver_id
  LIMIT 1;

  IF v_existing_earning IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'message', 'Already credited');
  END IF;

  -- Get vehicle type from booking
  SELECT vehicle_type::text
  INTO v_vehicle_type
  FROM public.bookings
  WHERE id = p_booking_id;

  -- Get commission settings configured by admin
  SELECT value
  INTO v_commission_settings
  FROM public.platform_settings
  WHERE key = 'commission'
  LIMIT 1;

  -- Extract default rate, then override by vehicle type if present
  v_default_rate := COALESCE(
    (v_commission_settings->>'default_rate')::numeric,
    15.0
  );

  v_commission_rate := COALESCE(
    (v_commission_settings->'by_vehicle_type'->>v_vehicle_type)::numeric,
    v_default_rate
  );

  -- Calculate amounts
  v_platform_fee := ROUND(p_total_fare * (v_commission_rate / 100.0), 2);
  v_driver_share := p_total_fare - v_platform_fee;

  -- Ensure driver wallet exists
  v_wallet_id := public.ensure_driver_wallet(p_driver_id);

  IF p_is_cash THEN
    -- Cash ride: driver already collected the gross fare offline.
    -- Record net earning for history, but only deduct platform commission
    -- from the digital wallet. This may drive available_balance negative.
    INSERT INTO public.driver_wallet_transactions (
      driver_id,
      booking_id,
      type,
      amount,
      balance_type,
      direction,
      status,
      description,
      metadata
    ) VALUES (
      p_driver_id,
      p_booking_id,
      'earning',
      v_driver_share,
      'available',
      'credit',
      'completed',
      'Cash ride earning (collected offline)',
      jsonb_build_object(
        'is_cash', true,
        'gross_fare', p_total_fare,
        'commission_rate', v_commission_rate,
        'platform_fee', v_platform_fee
      )
    );

    UPDATE public.driver_wallets
    SET
      available_balance = available_balance - v_platform_fee,
      total_commission_owed = total_commission_owed
        + GREATEST(v_platform_fee - GREATEST(available_balance, 0), 0),
      total_earned = total_earned + v_driver_share,
      updated_at = now()
    WHERE id = v_wallet_id;

    INSERT INTO public.driver_wallet_transactions (
      driver_id,
      booking_id,
      type,
      amount,
      balance_type,
      direction,
      status,
      description,
      metadata
    ) VALUES (
      p_driver_id,
      p_booking_id,
      'platform_fee',
      v_platform_fee,
      'available',
      'debit',
      'completed',
      'Platform commission for cash ride',
      jsonb_build_object(
        'commission_rate', v_commission_rate,
        'gross_fare', p_total_fare
      )
    );

  ELSE
    -- Online ride: platform collected payment, so credit pending balance.
    INSERT INTO public.driver_wallet_transactions (
      driver_id,
      booking_id,
      type,
      amount,
      balance_type,
      direction,
      status,
      description,
      metadata
    ) VALUES (
      p_driver_id,
      p_booking_id,
      'earning',
      v_driver_share,
      'pending',
      'credit',
      'completed',
      'Online ride earning (pending release)',
      jsonb_build_object(
        'gross_fare', p_total_fare,
        'commission_rate', v_commission_rate,
        'platform_fee', v_platform_fee
      )
    );

    UPDATE public.driver_wallets
    SET
      pending_balance = pending_balance + v_driver_share,
      total_earned = total_earned + v_driver_share,
      updated_at = now()
    WHERE id = v_wallet_id;
  END IF;

  -- Update booking with final settled driver payout
  UPDATE public.bookings
  SET driver_payout = v_driver_share
  WHERE id = p_booking_id;

  RETURN jsonb_build_object(
    'success', true,
    'driver_share', v_driver_share,
    'platform_fee', v_platform_fee,
    'commission_rate', v_commission_rate
  );
END;
$$;
