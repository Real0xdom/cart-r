-- Enforce driver wallet debt threshold before a driver can accept a new booking.
-- This keeps the backend aligned with the driver app's wallet eligibility checks.

CREATE OR REPLACE FUNCTION accept_booking_atomic(
  p_booking_id UUID,
  p_driver_id UUID
) RETURNS JSON AS $func$
DECLARE
  v_booking RECORD;
  v_driver RECORD;
  v_wallet RECORD;
  v_debt_threshold NUMERIC := -100;
  v_required_recharge NUMERIC := 100;
BEGIN
  -- 1. SECURITY CHECK: Verify this driver_id belongs to the calling user
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

  -- 2. ACTIVE RIDE GUARD: Prevent accepting while already on a ride
  IF EXISTS (
    SELECT 1
    FROM bookings
    WHERE driver_id = p_driver_id
      AND status IN ('accepted', 'driver_arrived', 'in_progress')
  ) THEN
    RETURN json_build_object('success', false, 'message', 'Complete your current ride before accepting a new one');
  END IF;

  -- 3. CRITICAL SECTION: Lock the booking row with FAIL FAST (NOWAIT)
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

  -- 4. VALIDATION CHECKS (Performed AFTER acquiring lock)
  IF v_booking IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Booking not found');
  END IF;

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

  -- 5. WALLET GUARD: Block new ride acceptance when commission debt exceeds threshold
  PERFORM ensure_driver_wallet(p_driver_id);

  SELECT *
  INTO v_wallet
  FROM driver_wallets
  WHERE driver_id = p_driver_id
  FOR UPDATE;

  IF v_wallet IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'wallet_recharge_required',
      'current_balance', 0,
      'required_recharge', v_required_recharge,
      'message', 'Driver wallet not initialized. Please recharge your wallet to accept rides'
    );
  END IF;

  IF COALESCE(v_wallet.available_balance, 0) < v_debt_threshold THEN
    v_required_recharge := ABS(COALESCE(v_wallet.available_balance, 0)) + ABS(v_debt_threshold);

    RETURN json_build_object(
      'success', false,
      'error', 'wallet_recharge_required',
      'current_balance', COALESCE(v_wallet.available_balance, 0),
      'required_recharge', v_required_recharge,
      'message', 'Please recharge your wallet to accept rides'
    );
  END IF;

  -- 6. UPDATE STATUS
  UPDATE bookings
  SET
    driver_id = p_driver_id,
    status = 'accepted',
    accepted_at = NOW(),
    updated_at = NOW()
  WHERE id = p_booking_id;

  -- 7. RETURN SUCCESS
  RETURN json_build_object('success', true, 'message', 'Booking accepted successfully');

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'message', 'Database error occurred');
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION accept_booking_atomic(UUID, UUID) TO authenticated;
