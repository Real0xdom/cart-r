-- Migration: Waiting Charges Implementation
-- Description: Add waiting time tracking and charges to bookings
-- Date: 2026-02-12

-- 1. Add waiting-related columns to bookings table
ALTER TABLE public.bookings 
ADD COLUMN IF NOT EXISTS waiting_start_time timestamptz,
ADD COLUMN IF NOT EXISTS waiting_end_time timestamptz,
ADD COLUMN IF NOT EXISTS waiting_duration_minutes integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS waiting_charges numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS free_waiting_minutes integer DEFAULT 15;

-- 2. Create waiting charges configuration table
CREATE TABLE IF NOT EXISTS public.waiting_charges_config (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  vehicle_type vehicle_type NOT NULL UNIQUE,
  free_waiting_minutes integer DEFAULT 15,
  charge_per_hour numeric DEFAULT 100,
  charge_per_minute numeric GENERATED ALWAYS AS (charge_per_hour / 60) STORED,
  max_waiting_charge numeric DEFAULT 500,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. Insert default waiting charges config
INSERT INTO public.waiting_charges_config (
  vehicle_type,
  free_waiting_minutes,
  charge_per_hour,
  max_waiting_charge
)
VALUES 
  ('bike', 10, 50, 200),
  ('three_wheeler', 15, 80, 300),
  ('tempo', 15, 100, 400),
  ('chota_hathi', 20, 150, 600),
  ('pickup', 15, 120, 500),
  ('sedan', 10, 60, 250),
  ('truck', 20, 200, 800)
ON CONFLICT (vehicle_type) DO UPDATE SET
  free_waiting_minutes = EXCLUDED.free_waiting_minutes,
  charge_per_hour = EXCLUDED.charge_per_hour,
  max_waiting_charge = EXCLUDED.max_waiting_charge,
  updated_at = now();

-- 4. Function to calculate waiting charges
CREATE OR REPLACE FUNCTION calculate_waiting_charges(
  p_booking_id uuid
) RETURNS numeric AS $$
DECLARE
  v_waiting_minutes integer;
  v_free_minutes integer;
  v_chargeable_minutes integer;
  v_rate_per_minute numeric;
  v_max_charge numeric;
  v_calculated_charge numeric;
  v_vehicle_type vehicle_type;
BEGIN
  -- Get booking details
  SELECT 
    EXTRACT(EPOCH FROM (waiting_end_time - waiting_start_time)) / 60,
    vehicle_type
  INTO v_waiting_minutes, v_vehicle_type
  FROM bookings
  WHERE id = p_booking_id;

  -- If no waiting time recorded, return 0
  IF v_waiting_minutes IS NULL OR v_waiting_minutes <= 0 THEN
    RETURN 0;
  END IF;

  -- Get waiting charges config
  SELECT 
    free_waiting_minutes,
    charge_per_minute,
    max_waiting_charge
  INTO v_free_minutes, v_rate_per_minute, v_max_charge
  FROM waiting_charges_config
  WHERE vehicle_type = v_vehicle_type
  AND is_active = true;

  -- Calculate chargeable minutes
  v_chargeable_minutes := GREATEST(0, v_waiting_minutes - v_free_minutes);

  -- Calculate charge
  v_calculated_charge := v_chargeable_minutes * v_rate_per_minute;

  -- Apply max charge cap
  v_calculated_charge := LEAST(v_calculated_charge, v_max_charge);

  -- Round to nearest rupee
  RETURN ROUND(v_calculated_charge);
END;
$$ LANGUAGE plpgsql;

-- 5. Function to start waiting timer
CREATE OR REPLACE FUNCTION start_waiting_timer(
  p_booking_id uuid
) RETURNS boolean AS $$
BEGIN
  UPDATE bookings
  SET 
    waiting_start_time = now(),
    updated_at = now()
  WHERE id = p_booking_id
  AND status = 'driver_arrived'
  AND waiting_start_time IS NULL;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- 6. Function to stop waiting timer and calculate charges
CREATE OR REPLACE FUNCTION stop_waiting_timer(
  p_booking_id uuid
) RETURNS numeric AS $$
DECLARE
  v_charges numeric;
BEGIN
  -- Set end time
  UPDATE bookings
  SET 
    waiting_end_time = now(),
    waiting_duration_minutes = EXTRACT(EPOCH FROM (now() - waiting_start_time)) / 60,
    updated_at = now()
  WHERE id = p_booking_id
  AND status = 'in_progress'
  AND waiting_start_time IS NOT NULL
  AND waiting_end_time IS NULL;

  -- Calculate charges
  v_charges := calculate_waiting_charges(p_booking_id);

  -- Update booking with charges
  UPDATE bookings
  SET waiting_charges = v_charges
  WHERE id = p_booking_id;

  RETURN v_charges;
END;
$$ LANGUAGE plpgsql;

-- 7. Update total fare calculation trigger
CREATE OR REPLACE FUNCTION update_booking_total_fare()
RETURNS TRIGGER AS $$
BEGIN
  NEW.total_fare = COALESCE(NEW.base_fare, 0) 
                 + COALESCE(NEW.distance_fare, 0)
                 + COALESCE(NEW.time_fare, 0)
                 + COALESCE(NEW.waiting_charges, 0)
                 + COALESCE(NEW.tip_amount, 0)
                 - COALESCE(NEW.discount_amount, 0);
  
  -- Calculate driver payout (85% of total fare)
  NEW.driver_payout = ROUND(NEW.total_fare * 0.85);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 8. Create or replace trigger
DROP TRIGGER IF EXISTS trigger_update_booking_total_fare ON bookings;
CREATE TRIGGER trigger_update_booking_total_fare
  BEFORE INSERT OR UPDATE OF base_fare, distance_fare, time_fare, waiting_charges, tip_amount, discount_amount
  ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION update_booking_total_fare();

-- 9. Trigger to auto-start waiting timer when driver arrives
CREATE OR REPLACE FUNCTION auto_start_waiting_timer()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'driver_arrived' AND OLD.status != 'driver_arrived' THEN
    NEW.waiting_start_time = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_start_waiting_timer ON bookings;
CREATE TRIGGER trigger_auto_start_waiting_timer
  BEFORE UPDATE OF status
  ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION auto_start_waiting_timer();

-- 10. Trigger to auto-stop waiting timer when trip starts
CREATE OR REPLACE FUNCTION auto_stop_waiting_timer()
RETURNS TRIGGER AS $$
DECLARE
  v_charges numeric;
BEGIN
  IF NEW.status = 'in_progress' AND OLD.status = 'driver_arrived' THEN
    IF NEW.waiting_start_time IS NOT NULL AND NEW.waiting_end_time IS NULL THEN
      NEW.waiting_end_time = now();
      NEW.waiting_duration_minutes = EXTRACT(EPOCH FROM (now() - NEW.waiting_start_time)) / 60;
      
      -- Calculate and set charges
      v_charges := calculate_waiting_charges(NEW.id);
      NEW.waiting_charges = v_charges;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_stop_waiting_timer ON bookings;
CREATE TRIGGER trigger_auto_stop_waiting_timer
  BEFORE UPDATE OF status
  ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION auto_stop_waiting_timer();

-- 11. Enable RLS on waiting_charges_config
ALTER TABLE public.waiting_charges_config ENABLE ROW LEVEL SECURITY;

-- 12. RLS Policy
-- 12. RLS Policy
DROP POLICY IF EXISTS "Anyone can view waiting charges config" ON public.waiting_charges_config;
CREATE POLICY "Anyone can view waiting charges config"
ON public.waiting_charges_config
FOR SELECT
USING (is_active = true);

-- 13. Comments
COMMENT ON TABLE waiting_charges_config IS 'Configuration for waiting time charges per vehicle type';
COMMENT ON FUNCTION calculate_waiting_charges IS 'Calculates waiting charges for a booking based on vehicle type and duration';
COMMENT ON FUNCTION start_waiting_timer IS 'Starts the waiting timer when driver arrives';
COMMENT ON FUNCTION stop_waiting_timer IS 'Stops the waiting timer and calculates charges when trip starts';
