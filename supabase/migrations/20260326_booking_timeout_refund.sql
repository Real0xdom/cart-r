-- Migration: 20260326_booking_timeout_refund.sql
-- Purpose: Automatically handle refunds for bookings that time out during driver search.

-- 1. Create a function to cleanup expired pending bookings
CREATE OR REPLACE FUNCTION public.cleanup_expired_bookings()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_updated_count integer;
BEGIN
  -- We move pending bookings that have passed their expires_at into 'cancelled' state
  -- This will trigger the queue_booking_refund logic automatically.
  UPDATE public.bookings
  SET 
    status = 'cancelled',
    cancelled_at = now(),
    cancellation_reason = 'Search timed out',
    updated_at = now()
  WHERE status = 'pending'
    AND expires_at IS NOT NULL
    AND expires_at < now();

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RETURN v_updated_count;
END;
$$;

-- 2. Update accept_booking_atomic to perform cleanup on the specific booking if it's expired
-- This ensures that even without a cron, the next driver attempt clears the stale state.
CREATE OR REPLACE FUNCTION public.accept_booking_atomic(
  p_booking_id uuid,
  p_driver_id uuid
) RETURNS json AS $func$
DECLARE
  v_booking public.bookings%ROWTYPE;
  v_driver public.drivers%ROWTYPE;
  v_wallet public.driver_wallets%ROWTYPE;
  v_debt_threshold numeric := -100;
  v_required_recharge numeric := 100;
  v_active_count integer := 0;
  v_queued_count integer := 0;
  v_assignment_mode text;
BEGIN
  SELECT *
  INTO v_driver
  FROM public.drivers
  WHERE id = p_driver_id
  FOR UPDATE;

  IF NOT FOUND THEN
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

  BEGIN
    SELECT *
    INTO v_booking
    FROM public.bookings
    WHERE id = p_booking_id
    FOR UPDATE NOWAIT;
  EXCEPTION
    WHEN lock_not_available THEN
      RETURN json_build_object('success', false, 'message', 'Too late! Another driver is currently accepting this ride.');
  END;

  IF v_booking IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Booking not found');
  END IF;

  IF v_booking.driver_id IS NOT NULL THEN
    IF v_booking.driver_id = p_driver_id AND v_booking.status IN ('accepted', 'queued') THEN
      RETURN json_build_object(
        'success', true,
        'message', 'You have already accepted this booking',
        'assignment_mode', v_booking.status
      );
    END IF;

    RETURN json_build_object('success', false, 'message', 'This ride has already been booked by another driver');
  END IF;

  IF v_booking.cancelled_at IS NOT NULL THEN
    RETURN json_build_object('success', false, 'message', 'This ride has been cancelled by the customer');
  END IF;

  -- IMPROVED TIMEOUT HANDLING: 
  -- If the booking has expired, mark it as cancelled officially.
  -- This triggers the refund flow for the customer.
  IF v_booking.expires_at IS NOT NULL AND v_booking.expires_at < now() THEN
    IF v_booking.status = 'pending' THEN
       UPDATE public.bookings
       SET 
         status = 'cancelled',
         cancelled_at = now(),
         cancellation_reason = 'Search timed out',
         updated_at = now()
       WHERE id = p_booking_id;
    END IF;
    RETURN json_build_object('success', false, 'message', 'This ride request has expired');
  END IF;

  IF v_booking.status != 'pending' THEN
    RETURN json_build_object('success', false, 'message', 'Booking is no longer available');
  END IF;

  PERFORM public.ensure_driver_wallet(p_driver_id);

  SELECT *
  INTO v_wallet
  FROM public.driver_wallets
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
    v_required_recharge := abs(COALESCE(v_wallet.available_balance, 0)) + abs(v_debt_threshold);

    RETURN json_build_object(
      'success', false,
      'error', 'wallet_recharge_required',
      'current_balance', COALESCE(v_wallet.available_balance, 0),
      'required_recharge', v_required_recharge,
      'message', 'Please recharge your wallet to accept rides'
    );
  END IF;

  SELECT COUNT(*)
  INTO v_active_count
  FROM public.bookings
  WHERE driver_id = p_driver_id
    AND status IN ('accepted', 'driver_arrived', 'in_progress');

  SELECT COUNT(*)
  INTO v_queued_count
  FROM public.bookings
  WHERE driver_id = p_driver_id
    AND status = 'queued';

  IF v_queued_count > 0 THEN
    RETURN json_build_object(
      'success', false,
      'error', 'driver_queue_full',
      'message', 'Finish or clear your queued ride before accepting another request'
    );
  END IF;

  IF v_active_count > 1 THEN
    RETURN json_build_object(
      'success', false,
      'error', 'driver_active_ride_conflict',
      'message', 'Driver has multiple active rides and cannot accept another request'
    );
  END IF;

  IF v_active_count = 0 THEN
    v_assignment_mode := 'accepted';
  ELSIF v_active_count = 1 THEN
    v_assignment_mode := 'queued';
  ELSE
    RETURN json_build_object(
      'success', false,
      'error', 'driver_queue_full',
      'message', 'Finish or clear your queued ride before accepting another request'
    );
  END IF;

  UPDATE public.bookings
  SET
    driver_id = p_driver_id,
    status = v_assignment_mode::public.booking_status,
    accepted_at = CASE WHEN v_assignment_mode = 'accepted' THEN now() ELSE NULL END,
    queued_at = CASE WHEN v_assignment_mode = 'queued' THEN now() ELSE NULL END,
    updated_at = now()
  WHERE id = p_booking_id;

  RETURN json_build_object(
    'success', true,
    'message', CASE
      WHEN v_assignment_mode = 'queued' THEN 'Ride queued successfully'
      ELSE 'Booking accepted successfully'
    END,
    'assignment_mode', v_assignment_mode
  );
EXCEPTION
  WHEN unique_violation THEN
    RETURN json_build_object(
      'success', false,
      'error', 'driver_queue_full',
      'message', 'Finish or clear your queued ride before accepting another request'
    );
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'message', 'Database error occurred');
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;
