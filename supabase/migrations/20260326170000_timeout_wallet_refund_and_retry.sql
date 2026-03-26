-- Ensure booking search timeout actually cancels/refunds wallet holds,
-- while still allowing the customer to retry the same timed-out booking.

CREATE OR REPLACE FUNCTION public.expire_booking_search(
  p_booking_id uuid,
  p_customer_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_booking public.bookings%ROWTYPE;
BEGIN
  SELECT *
  INTO v_booking
  FROM public.bookings
  WHERE id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Booking not found');
  END IF;

  IF v_booking.customer_id <> p_customer_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized - not your booking');
  END IF;

  IF v_booking.driver_id IS NOT NULL OR v_booking.status <> 'pending' THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Booking is no longer eligible for timeout expiry',
      'status', v_booking.status
    );
  END IF;

  IF v_booking.expires_at IS NULL OR v_booking.expires_at > now() THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Booking search has not expired yet'
    );
  END IF;

  UPDATE public.bookings
  SET
    status = 'cancelled',
    cancelled_at = now(),
    cancelled_by = p_customer_id,
    cancellation_reason = 'Search timed out',
    updated_at = now()
  WHERE id = p_booking_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Booking search expired and refund flow queued'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.retry_booking_with_tip_and_wallet_sync(
  p_booking_id uuid,
  p_customer_id uuid,
  p_new_tip_amount numeric,
  p_new_fare_multiplier numeric DEFAULT 1.0
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_booking public.bookings%ROWTYPE;
  v_new_total numeric(10,2);
  v_extra_to_hold numeric(10,2) := 0;
  v_user_balance numeric(10,2) := 0;
  v_wallet_backed boolean := false;
  v_timeout_retry boolean := false;
BEGIN
  SELECT *
  INTO v_booking
  FROM public.bookings
  WHERE id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Booking not found');
  END IF;

  IF v_booking.customer_id <> p_customer_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized - not your booking');
  END IF;

  v_timeout_retry := v_booking.status = 'cancelled'
    AND COALESCE(v_booking.cancellation_reason, '') = 'Search timed out';

  IF v_booking.status <> 'pending' AND NOT v_timeout_retry THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only pending or timed-out bookings can be retried');
  END IF;

  v_wallet_backed := COALESCE(v_booking.payment_method::text, 'cash') IN (
    'wallet',
    'partial_wallet',
    'wallet_plus_online',
    'wallet_plus_cash'
  );

  v_new_total := ROUND(
    COALESCE(v_booking.base_fare, 0)
    + COALESCE(v_booking.distance_fare, 0)
    + COALESCE(v_booking.time_fare, 0)
    + COALESCE(v_booking.waiting_charges, 0)
    + COALESCE(v_booking.addon_charges, 0)
    + COALESCE(p_new_tip_amount, 0)
    - COALESCE(v_booking.discount_amount, 0),
    2
  );

  IF v_wallet_backed THEN
    v_extra_to_hold := CASE
      WHEN v_timeout_retry THEN v_new_total
      ELSE GREATEST(
        v_new_total - COALESCE(v_booking.quoted_total_fare, v_booking.total_fare, 0),
        0
      )
    END;

    IF v_extra_to_hold > 0 THEN
      SELECT balance
      INTO v_user_balance
      FROM public.users
      WHERE id = p_customer_id
      FOR UPDATE;

      IF v_user_balance IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'User not found');
      END IF;

      IF v_user_balance < v_extra_to_hold THEN
        RETURN jsonb_build_object(
          'success', false,
          'error', 'Insufficient wallet balance for updated fare',
          'required', v_extra_to_hold,
          'available', v_user_balance,
          'shortfall', v_extra_to_hold - v_user_balance
        );
      END IF;

      UPDATE public.users
      SET balance = balance - v_extra_to_hold
      WHERE id = p_customer_id;

      INSERT INTO public.wallet_transactions (
        user_id,
        amount,
        type,
        status,
        description,
        booking_id
      ) VALUES (
        p_customer_id,
        v_extra_to_hold,
        'debit',
        'completed',
        CASE
          WHEN v_timeout_retry THEN 'Wallet escrow re-hold after search timeout - Booking #' || v_booking.booking_number
          ELSE 'Wallet escrow top-up after tip increase - Booking #' || v_booking.booking_number
        END,
        p_booking_id
      );
    END IF;
  END IF;

  UPDATE public.bookings
  SET
    tip_amount = COALESCE(p_new_tip_amount, 0),
    fare_multiplier = COALESCE(p_new_fare_multiplier, 1.0),
    status = 'pending',
    cancelled_at = NULL,
    cancelled_by = NULL,
    cancellation_reason = NULL,
    expires_at = now() + interval '3 minutes',
    updated_at = now(),
    refund_status = NULL,
    refund_amount = NULL,
    refund_reason = NULL,
    refund_error = NULL,
    refund_id = NULL,
    refund_source = NULL,
    refund_initiated_at = NULL,
    refund_completed_at = NULL,
    payment_status = CASE
      WHEN v_wallet_backed THEN 'paid'::public.payment_status
      ELSE payment_status
    END,
    quoted_total_fare = CASE
      WHEN v_wallet_backed THEN v_new_total
      ELSE quoted_total_fare
    END,
    wallet_amount_used = CASE
      WHEN v_wallet_backed AND v_timeout_retry THEN v_extra_to_hold
      WHEN v_wallet_backed THEN COALESCE(wallet_amount_used, 0) + v_extra_to_hold
      ELSE wallet_amount_used
    END,
    wallet_escrow_amount = CASE
      WHEN v_wallet_backed AND v_timeout_retry THEN v_extra_to_hold
      WHEN v_wallet_backed THEN COALESCE(wallet_escrow_amount, 0) + v_extra_to_hold
      ELSE wallet_escrow_amount
    END,
    wallet_escrow_status = CASE
      WHEN v_wallet_backed AND (
        CASE
          WHEN v_timeout_retry THEN v_extra_to_hold
          ELSE COALESCE(wallet_escrow_amount, 0) + v_extra_to_hold
        END
      ) > 0 THEN 'held'
      ELSE wallet_escrow_status
    END,
    wallet_escrow_held_at = CASE
      WHEN v_wallet_backed AND (
        CASE
          WHEN v_timeout_retry THEN v_extra_to_hold
          ELSE COALESCE(wallet_escrow_amount, 0) + v_extra_to_hold
        END
      ) > 0 THEN now()
      ELSE wallet_escrow_held_at
    END,
    wallet_escrow_released_at = CASE
      WHEN v_wallet_backed THEN NULL
      ELSE wallet_escrow_released_at
    END,
    wallet_escrow_refunded_at = CASE
      WHEN v_wallet_backed THEN NULL
      ELSE wallet_escrow_refunded_at
    END
  WHERE id = p_booking_id;

  RETURN jsonb_build_object(
    'success', true,
    'booking_id', p_booking_id,
    'new_total_fare', v_new_total,
    'additional_wallet_held', v_extra_to_hold,
    'message', CASE
      WHEN v_wallet_backed AND v_timeout_retry THEN 'Timed-out booking restarted and wallet hold recreated'
      WHEN v_wallet_backed AND v_extra_to_hold > 0 THEN 'Booking updated and wallet hold increased'
      ELSE 'Booking updated successfully'
    END
  );
END;
$$;
