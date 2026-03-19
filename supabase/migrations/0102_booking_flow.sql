-- Migration: 010b_booking_flow.sql
-- Purpose: Add expiration/radius config and atomic booking functions
-- NOTE: Requires 010a_add_tempo_enum.sql to run first!

-- =====================================================
-- STEP 1: Update table schemas
-- =====================================================
-- Add driver_search_radius_km to fare_config
ALTER TABLE fare_config ADD COLUMN IF NOT EXISTS driver_search_radius_km NUMERIC DEFAULT 10;

-- Add expires_at to bookings
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;

-- =====================================================
-- STEP 3: Update fare_config with new vehicle types
-- =====================================================
-- Delete old vehicle types that are being consolidated
DELETE FROM fare_config WHERE vehicle_type IN ('auto', 'mini', 'suv');

-- Update remaining vehicles to new naming
-- Note: 'sedan' stays as 'sedan' (represents Mini/Sedan category)
-- 'truck' stays as 'truck' (represents SUV/Truck category)

-- Ensure we have the 4 correct vehicle entries
INSERT INTO fare_config (vehicle_type, base_fare, per_km_rate, per_minute_rate, minimum_fare, driver_search_radius_km, is_active)
VALUES 
  ('bike', 25, 8, 1, 30, 5, true),
  ('tempo', 40, 15, 2, 60, 8, true),
  ('sedan', 60, 18, 2.5, 90, 10, true),
  ('truck', 120, 25, 3.5, 180, 15, true)
ON CONFLICT (vehicle_type) DO UPDATE SET
  base_fare = EXCLUDED.base_fare,
  per_km_rate = EXCLUDED.per_km_rate,
  per_minute_rate = EXCLUDED.per_minute_rate,
  minimum_fare = EXCLUDED.minimum_fare,
  driver_search_radius_km = EXCLUDED.driver_search_radius_km,
  is_active = EXCLUDED.is_active;

-- =====================================================
-- STEP 3: Create driver_rejections table
-- =====================================================
CREATE TABLE IF NOT EXISTS driver_rejections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  rejected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(booking_id, driver_id)
);

-- =====================================================
-- STEP 4: Function to check booking availability
-- =====================================================
CREATE OR REPLACE FUNCTION is_booking_available(p_booking_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_booking RECORD;
BEGIN
  SELECT status, driver_id, expires_at, cancelled_at
  INTO v_booking
  FROM bookings WHERE id = p_booking_id;
  
  IF v_booking IS NULL THEN
    RETURN FALSE;
  END IF;
  
  RETURN v_booking.status = 'pending' 
    AND v_booking.driver_id IS NULL
    AND (v_booking.expires_at IS NULL OR v_booking.expires_at > NOW())
    AND v_booking.cancelled_at IS NULL;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- STEP 5: Atomic accept booking function
-- =====================================================
CREATE OR REPLACE FUNCTION accept_booking_atomic(
  p_booking_id UUID,
  p_driver_id UUID
) RETURNS JSON AS $$
DECLARE
  v_result JSON;
  v_updated_count INT;
  v_booking RECORD;
BEGIN
  -- First check current state for proper error message
  SELECT status, driver_id, expires_at, cancelled_at
  INTO v_booking
  FROM bookings WHERE id = p_booking_id;
  
  IF v_booking IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Booking not found');
  END IF;
  
  -- Check specific failure conditions
  IF v_booking.driver_id IS NOT NULL THEN
    RETURN json_build_object('success', false, 'message', 'This ride has already been booked by another driver');
  END IF;
  
  IF v_booking.cancelled_at IS NOT NULL THEN
    RETURN json_build_object('success', false, 'message', 'This ride has been cancelled by the customer');
  END IF;
  
  IF v_booking.expires_at IS NOT NULL AND v_booking.expires_at < NOW() THEN
    RETURN json_build_object('success', false, 'message', 'This ride request has expired');
  END IF;
  
  IF v_booking.status != 'pending' THEN
    RETURN json_build_object('success', false, 'message', 'Booking is no longer available');
  END IF;
  
  -- Attempt atomic update
  UPDATE bookings 
  SET 
    driver_id = p_driver_id,
    status = 'accepted',
    accepted_at = NOW(),
    updated_at = NOW()
  WHERE id = p_booking_id
    AND status = 'pending'
    AND driver_id IS NULL
    AND (expires_at IS NULL OR expires_at > NOW())
    AND cancelled_at IS NULL;
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  
  IF v_updated_count > 0 THEN
    RETURN json_build_object('success', true, 'message', 'Booking accepted successfully');
  ELSE
    -- Race condition - another driver got it
    RETURN json_build_object('success', false, 'message', 'This ride has already been booked by another driver');
  END IF;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- STEP 6: Update notify_nearby_drivers to use fare_config radius
-- =====================================================
CREATE OR REPLACE FUNCTION notify_nearby_drivers()
RETURNS TRIGGER AS $$
DECLARE
  driver_record RECORD;
  notification_count INTEGER := 0;
  max_distance_km NUMERIC;
  driver_distance_km NUMERIC;
BEGIN
  -- Only trigger on new pending bookings
  IF NEW.status = 'pending' THEN
    -- Get radius from fare_config for this vehicle type
    SELECT COALESCE(driver_search_radius_km, 10) INTO max_distance_km
    FROM fare_config
    WHERE vehicle_type = NEW.vehicle_type;
    
    IF max_distance_km IS NULL THEN
      max_distance_km := 10; -- Default fallback
    END IF;
    
    -- Find all online drivers with matching vehicle type
    FOR driver_record IN
      SELECT 
        d.id as driver_id,
        d.user_id,
        u.expo_push_token,
        d.current_latitude,
        d.current_longitude,
        -- Calculate distance using Haversine formula
        (
          6371 * acos(
            cos(radians(NEW.origin_latitude)) * 
            cos(radians(d.current_latitude)) * 
            cos(radians(d.current_longitude) - radians(NEW.origin_longitude)) + 
            sin(radians(NEW.origin_latitude)) * 
            sin(radians(d.current_latitude))
          )
        ) as distance_km
      FROM drivers d
      JOIN users u ON d.user_id = u.id
      WHERE d.is_online = true
        AND d.is_verified = true
        AND d.vehicle_type = NEW.vehicle_type
        AND d.current_latitude IS NOT NULL
        AND d.current_longitude IS NOT NULL
        AND u.expo_push_token IS NOT NULL
      ORDER BY distance_km ASC
      LIMIT 20 -- Notify max 20 nearby drivers
    LOOP
      -- Only notify if within max distance
      IF driver_record.distance_km <= max_distance_km THEN
        -- Insert notification record
        INSERT INTO notifications (
          user_id,
          title,
          body,
          data,
          is_read
        ) VALUES (
          driver_record.user_id,
          '🚨 New Ride Request!',
          '₹' || COALESCE(NEW.driver_payout, NEW.total_fare) || ' - ' || 
            SUBSTRING(NEW.origin_address FROM 1 FOR 30) || ' → ' || 
            SUBSTRING(NEW.destination_address FROM 1 FOR 30),
          jsonb_build_object(
            'booking_id', NEW.id,
            'type', 'new_booking',
            'fare', COALESCE(NEW.driver_payout, NEW.total_fare),
            'distance_km', ROUND(NEW.estimated_distance::numeric, 1),
            'vehicle_type', NEW.vehicle_type,
            'has_tip', COALESCE(NEW.tip_amount, 0) > 0,
            'fare_increased', COALESCE(NEW.fare_multiplier, 1) > 1
          ),
          false
        );
        
        notification_count := notification_count + 1;
      END IF;
    END LOOP;
    
    RAISE NOTICE 'Notified % drivers for booking %', notification_count, NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
DROP TRIGGER IF EXISTS notify_drivers_on_booking ON bookings;
CREATE TRIGGER notify_drivers_on_booking
  AFTER INSERT ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION notify_nearby_drivers();
