-- Enforce booking-scoped driver tracking for reliable customer map updates.
-- 1. Speed up booking-scoped location lookups.
-- 2. Speed up active-booking resolution per driver.
-- 3. Prevent multiple active bookings per driver across any write path.

CREATE INDEX IF NOT EXISTS idx_driver_locations_booking_recorded_at
  ON public.driver_locations (booking_id, recorded_at DESC)
  WHERE booking_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_driver_active_tracking
  ON public.bookings (driver_id, status, updated_at DESC)
  WHERE driver_id IS NOT NULL
    AND status IN ('accepted', 'driver_arrived', 'in_progress');

CREATE OR REPLACE FUNCTION public.enforce_single_active_booking_per_driver()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.driver_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.status NOT IN ('accepted', 'driver_arrived', 'in_progress') THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.bookings AS b
    WHERE b.driver_id = NEW.driver_id
      AND b.id <> NEW.id
      AND b.status IN ('accepted', 'driver_arrived', 'in_progress')
  ) THEN
    RAISE EXCEPTION 'Driver % already has another active booking', NEW.driver_id
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_single_active_booking_per_driver ON public.bookings;
CREATE TRIGGER trg_enforce_single_active_booking_per_driver
  BEFORE INSERT OR UPDATE OF driver_id, status
  ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_single_active_booking_per_driver();
