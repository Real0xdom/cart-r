-- Migration: 014_fix_accept_booking_rls.sql
-- Purpose: Fix accept_booking_atomic to use SECURITY DEFINER
-- 
-- ISSUE: The RLS policy "Drivers can update assigned bookings" only allows 
-- drivers to update bookings where driver_id matches them. But when accepting,
-- driver_id is NULL so the update fails.
--
-- SOLUTION: Make accept_booking_atomic use SECURITY DEFINER to bypass RLS.
-- We add additional security checks inside the function to validate the driver.

CREATE OR REPLACE FUNCTION accept_booking_atomic(
  p_booking_id UUID,
  p_driver_id UUID
) RETURNS JSON AS $$
DECLARE
  v_result JSON;
  v_updated_count INT;
  v_booking RECORD;
  v_driver RECORD;
BEGIN
  -- SECURITY CHECK: Verify this driver_id belongs to the calling user
  SELECT id, user_id, verification_status, is_online
  INTO v_driver
  FROM drivers 
  WHERE id = p_driver_id;
  
  IF v_driver IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Driver not found');
  END IF;
  
  IF v_driver.user_id != auth.uid() THEN
    RETURN json_build_object('success', false, 'message', 'Unauthorized: Driver ID mismatch');
  END IF;
  
  IF v_driver.verification_status != 'approved' THEN
    RETURN json_build_object('success', false, 'message', 'Driver not approved');
  END IF;
  
  IF v_driver.is_online != true THEN
    RETURN json_build_object('success', false, 'message', 'Driver must be online to accept bookings');
  END IF;

  -- Check booking availability
  SELECT status, driver_id, expires_at, cancelled_at
  INTO v_booking
  FROM bookings WHERE id = p_booking_id;
  
  IF v_booking IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Booking not found');
  END IF;
  
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
  
  -- Attempt atomic update (this will succeed now with SECURITY DEFINER)
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION accept_booking_atomic(UUID, UUID) TO authenticated;

SELECT 'Migration 014_fix_accept_booking_rls completed successfully' as result;
