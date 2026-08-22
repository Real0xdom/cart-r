-- Keep booking-level waiting charge fields in sync with admin waiting config
-- so the customer UI and backend charge calculation use the same values.

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS free_waiting_time_minutes integer,
  ADD COLUMN IF NOT EXISTS waiting_charge_per_minute numeric(10,2);

CREATE OR REPLACE FUNCTION public.apply_waiting_config_to_booking()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_free_waiting_minutes integer;
  v_charge_per_minute numeric;
BEGIN
  SELECT
    COALESCE(wc.free_waiting_minutes, 15),
    COALESCE(wc.charge_per_minute, ROUND(COALESCE(wc.charge_per_hour, 0) / 60.0, 2), 0)
  INTO
    v_free_waiting_minutes,
    v_charge_per_minute
  FROM public.waiting_charges_config wc
  WHERE wc.vehicle_type = NEW.vehicle_type
    AND wc.is_active = true
  LIMIT 1;

  NEW.free_waiting_time_minutes := COALESCE(v_free_waiting_minutes, NEW.free_waiting_time_minutes, 15);
  NEW.waiting_charge_per_minute := COALESCE(v_charge_per_minute, NEW.waiting_charge_per_minute, 0);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_apply_waiting_config_to_booking ON public.bookings;
CREATE TRIGGER trigger_apply_waiting_config_to_booking
  BEFORE INSERT OR UPDATE OF vehicle_type ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_waiting_config_to_booking();

CREATE OR REPLACE FUNCTION public.calculate_waiting_charge_amount(
  p_waiting_minutes numeric,
  p_free_waiting_minutes integer,
  p_rate_per_minute numeric,
  p_max_waiting_charge numeric DEFAULT NULL
) RETURNS numeric
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_chargeable_minutes numeric := 0;
  v_calculated_charge numeric := 0;
BEGIN
  IF COALESCE(p_waiting_minutes, 0) <= 0 THEN
    RETURN 0;
  END IF;

  v_chargeable_minutes := GREATEST(
    COALESCE(p_waiting_minutes, 0) - COALESCE(p_free_waiting_minutes, 0),
    0
  );
  v_calculated_charge := v_chargeable_minutes * COALESCE(p_rate_per_minute, 0);

  IF p_max_waiting_charge IS NOT NULL THEN
    v_calculated_charge := LEAST(v_calculated_charge, p_max_waiting_charge);
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
  v_free_waiting_minutes integer;
  v_rate_per_minute numeric;
  v_max_waiting_charge numeric;
BEGIN
  SELECT
    EXTRACT(EPOCH FROM (COALESCE(b.waiting_end_time, now()) - b.waiting_start_time)) / 60.0,
    b.vehicle_type,
    COALESCE(b.free_waiting_time_minutes, wc.free_waiting_minutes, 15),
    COALESCE(b.waiting_charge_per_minute, wc.charge_per_minute, ROUND(COALESCE(wc.charge_per_hour, 0) / 60.0, 2), 0),
    wc.max_waiting_charge
  INTO
    v_waiting_minutes,
    v_vehicle_type,
    v_free_waiting_minutes,
    v_rate_per_minute,
    v_max_waiting_charge
  FROM public.bookings b
  LEFT JOIN public.waiting_charges_config wc
    ON wc.vehicle_type = b.vehicle_type
   AND wc.is_active = true
  WHERE b.id = p_booking_id;

  RETURN public.calculate_waiting_charge_amount(
    v_waiting_minutes,
    v_free_waiting_minutes,
    v_rate_per_minute,
    v_max_waiting_charge
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.auto_stop_waiting_timer()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_waiting_minutes numeric := 0;
  v_free_waiting_minutes integer := 15;
  v_rate_per_minute numeric := 0;
  v_max_waiting_charge numeric := NULL;
BEGIN
  IF NEW.status = 'in_progress' AND OLD.status = 'driver_arrived' THEN
    IF NEW.waiting_start_time IS NOT NULL AND NEW.waiting_end_time IS NULL THEN
      NEW.waiting_end_time := now();
      v_waiting_minutes := EXTRACT(EPOCH FROM (NEW.waiting_end_time - NEW.waiting_start_time)) / 60.0;
      NEW.waiting_duration_minutes := CEIL(GREATEST(v_waiting_minutes, 0));

      SELECT
        COALESCE(NEW.free_waiting_time_minutes, wc.free_waiting_minutes, 15),
        COALESCE(NEW.waiting_charge_per_minute, wc.charge_per_minute, ROUND(COALESCE(wc.charge_per_hour, 0) / 60.0, 2), 0),
        wc.max_waiting_charge
      INTO
        v_free_waiting_minutes,
        v_rate_per_minute,
        v_max_waiting_charge
      FROM public.waiting_charges_config wc
      WHERE wc.vehicle_type = NEW.vehicle_type
        AND wc.is_active = true
      LIMIT 1;

      NEW.waiting_charges := public.calculate_waiting_charge_amount(
        v_waiting_minutes,
        v_free_waiting_minutes,
        v_rate_per_minute,
        v_max_waiting_charge
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

UPDATE public.bookings b
SET
  free_waiting_time_minutes = wc.free_waiting_minutes,
  waiting_charge_per_minute = COALESCE(wc.charge_per_minute, ROUND(COALESCE(wc.charge_per_hour, 0) / 60.0, 2)),
  updated_at = now()
FROM public.waiting_charges_config wc
WHERE wc.vehicle_type = b.vehicle_type
  AND wc.is_active = true
  AND b.status IN ('pending', 'queued', 'accepted', 'driver_arrived', 'in_progress')
  AND (
    b.free_waiting_time_minutes IS DISTINCT FROM wc.free_waiting_minutes
    OR b.waiting_charge_per_minute IS DISTINCT FROM COALESCE(wc.charge_per_minute, ROUND(COALESCE(wc.charge_per_hour, 0) / 60.0, 2))
  );
