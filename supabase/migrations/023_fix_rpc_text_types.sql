-- Migration: 023_fix_rpc_text_types.sql
-- Purpose: Fix return type mismatch - use TEXT instead of VARCHAR for address columns

CREATE OR REPLACE FUNCTION get_available_bookings_v2(
  p_latitude DECIMAL,
  p_longitude DECIMAL,
  p_vehicle_type VARCHAR,
  p_radius_km DECIMAL DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  created_at TIMESTAMPTZ,
  booking_number TEXT,       -- Changed from VARCHAR
  origin_address TEXT,       -- Column 4 - was the error
  destination_address TEXT,  -- Changed from VARCHAR
  total_fare DECIMAL,
  driver_payout DECIMAL,
  estimated_distance DECIMAL,
  estimated_duration DECIMAL,
  vehicle_type TEXT,         -- Changed from VARCHAR (ENUM cast)
  payment_method TEXT,       -- Changed from VARCHAR (ENUM cast)
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
    sub.id,
    sub.created_at,
    sub.booking_number,
    sub.origin_address,
    sub.destination_address,
    sub.total_fare,
    sub.driver_payout,
    sub.estimated_distance,
    sub.estimated_duration,
    sub.vehicle_type,
    sub.payment_method,
    sub.expires_at,
    sub.tip_amount,
    sub.fare_multiplier,
    sub.distance_km
  FROM (
    SELECT 
      b.id,
      b.created_at,
      b.booking_number::TEXT AS booking_number,
      b.origin_address,
      b.destination_address,
      b.total_fare,
      b.driver_payout,
      b.estimated_distance::DECIMAL,
      b.estimated_duration::DECIMAL,
      b.vehicle_type::TEXT AS vehicle_type,
      b.payment_method::TEXT AS payment_method,
      b.expires_at,
      b.tip_amount,
      b.fare_multiplier,
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
      AND b.vehicle_type = p_vehicle_type::vehicle_type
      -- Filter out bookings rejected by this driver
      AND NOT EXISTS (
        SELECT 1 FROM driver_rejections dr 
        WHERE dr.booking_id = b.id 
        AND (v_driver_id IS NOT NULL AND dr.driver_id = v_driver_id)
      )
      -- Bounding box pre-filter for performance
      AND b.origin_latitude BETWEEN (p_latitude - (p_radius_km / 111.0)) AND (p_latitude + (p_radius_km / 111.0))
      AND b.origin_longitude BETWEEN (p_longitude - (p_radius_km / (111.0 * cos(radians(p_latitude))))) 
                                 AND (p_longitude + (p_radius_km / (111.0 * cos(radians(p_latitude)))))
  ) sub
  WHERE sub.distance_km <= p_radius_km
  ORDER BY sub.created_at DESC
  LIMIT 50;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
