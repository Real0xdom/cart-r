-- Migration: 017_lock_booking_acceptance.sql
-- Purpose: Implement robust race condition handling for booking acceptance using Pessimistic Locking with FAIL FAST optimization.
--
-- METHOD:
-- We use `SELECT ... FOR UPDATE NOWAIT`.
-- FAILURE SCENARIO HANDLING:
-- 1. Standard Locking: If 50 drivers accept at once, 1 gets lock, 49 wait in queue, consuming database connections.
-- 2. NOWAIT (Fail Fast): 1 gets lock, 49 fail IMMEDIATELY with a specific error.
--    This effectively handles the "Thundering Herd" problem by rejecting latecomers instantly rather than queueing them.

CREATE OR REPLACE FUNCTION accept_booking_atomic(
  p_booking_id UUID,
  p_driver_id UUID
) RETURNS JSON AS $func$
DECLARE
  v_result JSON;
  v_updated_count INT;
  v_booking RECORD;
  v_driver RECORD;
BEGIN
  -- 1. SECURITY CHECK: Verify this driver_id belongs to the calling user
  SELECT id, user_id, verification_status, is_online
  INTO v_driver
  FROM drivers 
  WHERE id = p_driver_id;
  
  IF v_driver IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Driver not found');
  END IF;
  
  -- Ensure the authenticated user owns this driver profile
  IF v_driver.user_id != auth.uid() THEN
    RETURN json_build_object('success', false, 'message', 'Unauthorized: Driver ID mismatch');
  END IF;
  
  IF v_driver.verification_status != 'approved' THEN
    RETURN json_build_object('success', false, 'message', 'Driver not approved');
  END IF;
  
  IF v_driver.is_online != true THEN
    RETURN json_build_object('success', false, 'message', 'Driver must be online to accept bookings');
  END IF;

  -- 2. CRITICAL SECTION: Lock the booking row with FAIL FAST (NOWAIT)
  -- If another driver is currently processing this row, this statement will THROW an error immediately.
  -- We catch this specific error below to return a clean message.
  BEGIN
    SELECT *
    INTO v_booking
    FROM bookings 
    WHERE id = p_booking_id
    FOR UPDATE NOWAIT; 
  EXCEPTION 
    WHEN lock_not_available THEN
      RETURN json_build_object('success', false, 'message', 'Too late! Another driver is currently accepting this ride.');
  END;
  
  -- 3. VALIDATION CHECKS (Performed AFTER acquiring lock)
  
  IF v_booking IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Booking not found');
  END IF;
  
  -- Check if already assigned
  IF v_booking.driver_id IS NOT NULL THEN
    IF v_booking.driver_id = p_driver_id THEN
       RETURN json_build_object('success', true, 'message', 'You have already accepted this booking');
    ELSE
       RETURN json_build_object('success', false, 'message', 'This ride has already been booked by another driver');
    END IF;
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
  
  -- 4. UPDATE STATUS
  -- Since we hold the lock, no one else can change it while we are here.
  UPDATE bookings 
  SET 
    driver_id = p_driver_id,
    status = 'accepted',
    accepted_at = NOW(),
    updated_at = NOW()
  WHERE id = p_booking_id;
  
  -- 5. RETURN SUCCESS
  RETURN json_build_object('success', true, 'message', 'Booking accepted successfully');
  
EXCEPTION WHEN OTHERS THEN
  -- Handle any other unexpected errors
  RETURN json_build_object('success', false, 'message', 'Database error occurred');
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION accept_booking_atomic(UUID, UUID) TO authenticated;

SELECT 'Migration 017_lock_booking_acceptance completed successfully' as result;
