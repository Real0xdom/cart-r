-- Migration: 019_driver_decline_logic.sql
-- Purpose: Add server-side filtering for available bookings and handle driver declines

-- =====================================================
-- STEP 1: Ensure driver_rejections table exists
-- =====================================================
CREATE TABLE IF NOT EXISTS driver_rejections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  rejected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(booking_id, driver_id)
);

-- Enable RLS
ALTER TABLE driver_rejections ENABLE ROW LEVEL SECURITY;

-- Allow drivers to insert their own rejections
CREATE POLICY "Drivers can create rejections" ON driver_rejections
  FOR INSERT WITH CHECK (
    driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid())
  );

-- Allow drivers to view their own rejections (for debugging/filtering)
CREATE POLICY "Drivers can view own rejections" ON driver_rejections
  FOR SELECT USING (
    driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid())
  );

-- =====================================================
-- STEP 2: RPC to decline a booking
-- =====================================================
CREATE OR REPLACE FUNCTION decline_booking(p_booking_id UUID)
RETURNS JSON AS $$
DECLARE
  v_driver_id UUID;
BEGIN
  -- Get the driver ID for the current authenticated user
  SELECT id INTO v_driver_id
  FROM drivers
  WHERE user_id = auth.uid();

  IF v_driver_id IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Driver profile not found');
  END IF;

  -- Insert rejection
  INSERT INTO driver_rejections (booking_id, driver_id)
  VALUES (p_booking_id, v_driver_id)
  ON CONFLICT (booking_id, driver_id) DO NOTHING;

  RETURN json_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'message', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- STEP 3: Server-side Booking Fetch (The V2 Function)
-- =====================================================
-- This function replaces the client-side logic for fetching and filtering bookings
CREATE OR REPLACE FUNCTION get_available_bookings_v2(
  p_latitude DECIMAL,
  p_longitude DECIMAL,
  p_vehicle_type VARCHAR,
  p_radius_km DECIMAL DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  created_at TIMESTAMPTZ,
  booking_number VARCHAR,
  origin_address VARCHAR,
  destination_address VARCHAR,
  total_fare DECIMAL,
  driver_payout DECIMAL,
  estimated_distance DECIMAL,
  estimated_duration DECIMAL,
  vehicle_type VARCHAR,
  payment_method VARCHAR,
  expires_at TIMESTAMPTZ,
  tip_amount DECIMAL,
  fare_multiplier DECIMAL,
  distance_km DECIMAL
) AS $$
DECLARE
  v_driver_id UUID;
BEGIN
  -- Get current driver ID to filter their rejections
  SELECT d.id INTO v_driver_id
  FROM drivers d
  WHERE d.user_id = auth.uid();

  RETURN QUERY
  SELECT 
    b.id,
    b.created_at,
    b.booking_number,
    b.origin_address,
    b.destination_address,
    b.total_fare,
    b.driver_payout,
    b.estimated_distance,
    b.estimated_duration,
    b.vehicle_type,
    b.payment_method,
    b.expires_at,
    b.tip_amount,
    b.fare_multiplier,
    -- Calculate distance from driver to pickup
    (6371 * acos(
      LEAST(1.0, 
        cos(radians(p_latitude)) * cos(radians(b.origin_latitude)) *
        cos(radians(b.origin_longitude) - radians(p_longitude)) +
        sin(radians(p_latitude)) * sin(radians(b.origin_latitude))
      )
    ))::DECIMAL AS distance_km
  FROM bookings b
  WHERE 
    b.status = 'pending'
    AND b.driver_id IS NULL
    AND b.cancelled_at IS NULL
    AND (b.expires_at IS NULL OR b.expires_at > NOW())
    AND b.vehicle_type = p_vehicle_type
    -- Filter out bookings rejected by this driver
    AND NOT EXISTS (
      SELECT 1 FROM driver_rejections dr 
      WHERE dr.booking_id = b.id 
      AND (v_driver_id IS NOT NULL AND dr.driver_id = v_driver_id)
    )
    -- Distance filter (bounding box first for speed, then precise)
    AND b.origin_latitude BETWEEN (p_latitude - (p_radius_km / 111.0)) AND (p_latitude + (p_radius_km / 111.0))
    AND b.origin_longitude BETWEEN (p_longitude - (p_radius_km / (111.0 * cos(radians(p_latitude))))) 
                               AND (p_longitude + (p_radius_km / (111.0 * cos(radians(p_latitude)))))
  HAVING 
    (6371 * acos(
      LEAST(1.0, 
        cos(radians(p_latitude)) * cos(radians(b.origin_latitude)) *
        cos(radians(b.origin_longitude) - radians(p_longitude)) +
        sin(radians(p_latitude)) * sin(radians(b.origin_latitude))
      )
    )) <= p_radius_km
  ORDER BY 
    b.created_at DESC
  LIMIT 50;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
