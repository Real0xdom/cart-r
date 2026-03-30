-- Dynamic wallet fare settlement for mid-flow fare increases.
-- Covers:
-- 1. Tip retries while searching for a driver.
-- 2. Additional fare paid later on top of the original wallet hold.
-- 3. Mixed wallet + cash completion when the driver collects only the extra amount.

ALTER TYPE public.payment_method ADD VALUE IF NOT EXISTS 'wallet_plus_cash';

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

  IF v_booking.status <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only pending bookings can be retried');
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
    v_extra_to_hold := GREATEST(
      v_new_total - COALESCE(v_booking.quoted_total_fare, v_booking.total_fare, 0),
      0
    );

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
        'Wallet escrow top-up after tip increase - Booking #' || v_booking.booking_number,
        p_booking_id
      );
    END IF;
  END IF;

  UPDATE public.bookings
  SET
    tip_amount = COALESCE(p_new_tip_amount, 0),
    fare_multiplier = COALESCE(p_new_fare_multiplier, 1.0),
    status = 'pending',
    expires_at = now() + interval '3 minutes',
    updated_at = now(),
    quoted_total_fare = CASE
      WHEN v_wallet_backed THEN v_new_total
      ELSE quoted_total_fare
    END,
    wallet_amount_used = CASE
      WHEN v_wallet_backed THEN COALESCE(wallet_amount_used, 0) + v_extra_to_hold
      ELSE wallet_amount_used
    END,
    wallet_escrow_amount = CASE
      WHEN v_wallet_backed THEN COALESCE(wallet_escrow_amount, 0) + v_extra_to_hold
      ELSE wallet_escrow_amount
    END,
    wallet_escrow_status = CASE
      WHEN v_wallet_backed AND COALESCE(wallet_escrow_amount, 0) + v_extra_to_hold > 0 THEN 'held'
      ELSE wallet_escrow_status
    END,
    wallet_escrow_held_at = CASE
      WHEN v_wallet_backed AND COALESCE(wallet_escrow_amount, 0) + v_extra_to_hold > 0
        THEN COALESCE(wallet_escrow_held_at, now())
      ELSE wallet_escrow_held_at
    END
  WHERE id = p_booking_id;

  RETURN jsonb_build_object(
    'success', true,
    'booking_id', p_booking_id,
    'new_total_fare', v_new_total,
    'additional_wallet_held', v_extra_to_hold,
    'message', CASE
      WHEN v_wallet_backed AND v_extra_to_hold > 0 THEN 'Booking updated and wallet hold increased'
      ELSE 'Booking updated successfully'
    END
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.pay_with_wallet(
  p_booking_id uuid,
  p_user_id uuid,
  p_use_full_wallet boolean DEFAULT true,
  p_payment_session_id text DEFAULT NULL
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_booking RECORD;
  v_user_balance numeric;
  v_total_amount numeric;
  v_wallet_amount numeric := 0;
  v_remaining_amount numeric := 0;
  v_new_balance numeric;
  v_additional_due numeric := 0;
BEGIN
  SELECT *
  INTO v_booking
  FROM public.bookings
  WHERE id = p_booking_id
  FOR UPDATE NOWAIT;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Booking not found');
  END IF;

  IF v_booking.customer_id <> p_user_id THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized - not your booking');
  END IF;

  v_additional_due := GREATEST(
    COALESCE(v_booking.total_fare, 0) - COALESCE(v_booking.quoted_total_fare, v_booking.total_fare, 0),
    0
  );

  IF COALESCE(v_booking.wallet_escrow_status, 'none') = 'held'
     AND COALESCE(v_booking.wallet_escrow_amount, 0) > 0 THEN
    SELECT balance INTO v_user_balance
    FROM public.users
    WHERE id = p_user_id
    FOR UPDATE;

    IF v_additional_due <= 0 THEN
      RETURN json_build_object(
        'success', true,
        'wallet_deducted', COALESCE(v_booking.wallet_escrow_amount, v_booking.wallet_amount_used, 0),
        'remaining_to_pay',
          CASE
            WHEN COALESCE(v_booking.payment_status::text, '') = 'partial_paid'
              THEN GREATEST(COALESCE(v_booking.quoted_total_fare, v_booking.total_fare, 0) - COALESCE(v_booking.wallet_escrow_amount, v_booking.wallet_amount_used, 0), 0)
            ELSE 0
          END,
        'new_wallet_balance', COALESCE(v_user_balance, 0),
        'fully_paid', COALESCE(v_booking.payment_status::text, '') = 'paid',
        'booking_status', COALESCE(v_booking.payment_status::text, 'pending'),
        'message', 'Wallet hold already exists for this booking'
      );
    END IF;

    IF v_user_balance IS NULL THEN
      RETURN json_build_object('success', false, 'error', 'User not found');
    END IF;

    IF p_use_full_wallet THEN
      IF v_user_balance < v_additional_due THEN
        RETURN json_build_object(
          'success', false,
          'error', 'Insufficient balance',
          'required', v_additional_due,
          'available', v_user_balance,
          'shortfall', v_additional_due - v_user_balance
        );
      END IF;

      v_wallet_amount := v_additional_due;
      v_remaining_amount := 0;
    ELSE
      IF v_user_balance > 0 THEN
        v_wallet_amount := LEAST(v_user_balance, v_additional_due);
        v_remaining_amount := v_additional_due - v_wallet_amount;
      ELSE
        v_wallet_amount := 0;
        v_remaining_amount := v_additional_due;
      END IF;
    END IF;

    IF v_wallet_amount > 0 THEN
      UPDATE public.users
      SET balance = balance - v_wallet_amount
      WHERE id = p_user_id;

      v_new_balance := v_user_balance - v_wallet_amount;

      INSERT INTO public.wallet_transactions (
        user_id,
        amount,
        type,
        status,
        description,
        booking_id
      ) VALUES (
        p_user_id,
        v_wallet_amount,
        'debit',
        'completed',
        'Additional fare settled from wallet - Booking #' || v_booking.booking_number,
        p_booking_id
      );

      UPDATE public.bookings
      SET
        wallet_amount_used = COALESCE(wallet_amount_used, 0) + v_wallet_amount,
        wallet_escrow_amount = COALESCE(wallet_escrow_amount, 0) + v_wallet_amount,
        quoted_total_fare = LEAST(
          COALESCE(quoted_total_fare, total_fare, 0) + v_wallet_amount,
          COALESCE(total_fare, 0)
        ),
        updated_at = now()
      WHERE id = p_booking_id;
    ELSE
      v_new_balance := v_user_balance;
    END IF;

    RETURN json_build_object(
      'success', true,
      'wallet_deducted', v_wallet_amount,
      'remaining_to_pay', v_remaining_amount,
      'new_wallet_balance', v_new_balance,
      'fully_paid', (v_remaining_amount = 0),
      'booking_status', COALESCE(v_booking.payment_status::text, 'pending'),
      'message', CASE
        WHEN v_remaining_amount = 0 THEN 'Additional fare settled from wallet'
        WHEN v_wallet_amount > 0 THEN 'Wallet partially covered the additional fare'
        ELSE 'No wallet balance applied to the additional fare'
      END
    );
  END IF;

  IF COALESCE(v_booking.payment_status::text, '') = 'paid' THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Already paid',
      'payment_method', v_booking.payment_method
    );
  END IF;

  v_total_amount := COALESCE(v_booking.quoted_total_fare, v_booking.total_fare, 0);

  SELECT balance INTO v_user_balance
  FROM public.users
  WHERE id = p_user_id
  FOR UPDATE;

  IF v_user_balance IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'User not found');
  END IF;

  IF p_use_full_wallet THEN
    IF v_user_balance < v_total_amount THEN
      RETURN json_build_object(
        'success', false,
        'error', 'Insufficient balance',
        'required', v_total_amount,
        'available', v_user_balance,
        'shortfall', v_total_amount - v_user_balance
      );
    END IF;

    v_wallet_amount := v_total_amount;
    v_remaining_amount := 0;
  ELSE
    IF v_user_balance > 0 THEN
      v_wallet_amount := LEAST(v_user_balance, v_total_amount);
      v_remaining_amount := v_total_amount - v_wallet_amount;
    ELSE
      v_wallet_amount := 0;
      v_remaining_amount := v_total_amount;
    END IF;
  END IF;

  IF v_wallet_amount > 0 THEN
    UPDATE public.users
    SET balance = balance - v_wallet_amount
    WHERE id = p_user_id;

    v_new_balance := v_user_balance - v_wallet_amount;

    INSERT INTO public.wallet_transactions (
      user_id,
      amount,
      type,
      status,
      description,
      booking_id
    ) VALUES (
      p_user_id,
      v_wallet_amount,
      'debit',
      'completed',
      'Wallet escrow hold - Booking #' || v_booking.booking_number ||
        CASE
          WHEN v_remaining_amount > 0
            THEN ' (held Rs.' || trim(to_char(v_wallet_amount, 'FM999999990.00')) || ' of Rs.' || trim(to_char(v_total_amount, 'FM999999990.00')) || ')'
          ELSE ' (full wallet hold)'
        END,
      p_booking_id
    );
  ELSE
    v_new_balance := v_user_balance;
  END IF;

  IF v_remaining_amount = 0 THEN
    UPDATE public.bookings
    SET
      payment_status = 'paid',
      payment_method = 'wallet',
      wallet_amount_used = v_wallet_amount,
      wallet_escrow_amount = v_wallet_amount,
      wallet_escrow_status = CASE WHEN v_wallet_amount > 0 THEN 'held' ELSE 'none' END,
      wallet_escrow_held_at = CASE WHEN v_wallet_amount > 0 THEN COALESCE(wallet_escrow_held_at, now()) ELSE wallet_escrow_held_at END,
      wallet_escrow_released_at = NULL,
      wallet_escrow_refunded_at = NULL,
      quoted_total_fare = COALESCE(quoted_total_fare, total_fare),
      updated_at = now()
    WHERE id = p_booking_id;
  ELSE
    UPDATE public.bookings
    SET
      payment_status = 'partial_paid',
      payment_method = 'partial_wallet',
      wallet_amount_used = v_wallet_amount,
      wallet_escrow_amount = v_wallet_amount,
      wallet_escrow_status = CASE WHEN v_wallet_amount > 0 THEN 'held' ELSE 'none' END,
      wallet_escrow_held_at = CASE WHEN v_wallet_amount > 0 THEN COALESCE(wallet_escrow_held_at, now()) ELSE wallet_escrow_held_at END,
      wallet_escrow_released_at = NULL,
      wallet_escrow_refunded_at = NULL,
      payment_session_id = p_payment_session_id,
      quoted_total_fare = COALESCE(quoted_total_fare, total_fare),
      updated_at = now()
    WHERE id = p_booking_id;
  END IF;

  RETURN json_build_object(
    'success', true,
    'wallet_deducted', v_wallet_amount,
    'remaining_to_pay', v_remaining_amount,
    'new_wallet_balance', v_new_balance,
    'fully_paid', (v_remaining_amount = 0),
    'booking_status', CASE WHEN v_remaining_amount = 0 THEN 'paid' ELSE 'partial_paid' END,
    'message', CASE WHEN v_wallet_amount > 0 THEN 'Wallet amount placed on hold in escrow' ELSE 'No wallet balance applied' END
  );
EXCEPTION
  WHEN lock_not_available THEN
    RETURN json_build_object('success', false, 'error', 'Payment already in progress. Please wait.');
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', 'Payment failed: ' || SQLERRM);
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_booking_online_payment(
  p_booking_id uuid,
  p_amount numeric,
  p_payment_order_id text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_booking public.bookings%ROWTYPE;
  v_existing_method text;
  v_wallet_backed boolean;
  v_additional_due numeric(10,2);
  v_new_captured_total numeric(10,2);
BEGIN
  SELECT *
  INTO v_booking
  FROM public.bookings
  WHERE id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Booking not found');
  END IF;

  IF COALESCE(p_amount, 0) <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payment amount must be greater than zero');
  END IF;

  v_existing_method := COALESCE(v_booking.payment_method::text, 'cash');
  v_wallet_backed := v_existing_method IN ('wallet', 'partial_wallet', 'wallet_plus_online', 'wallet_plus_cash');
  v_additional_due := GREATEST(
    COALESCE(v_booking.total_fare, 0) - COALESCE(v_booking.quoted_total_fare, v_booking.total_fare, 0),
    0
  );

  v_new_captured_total := CASE
    WHEN v_additional_due > 0 THEN LEAST(
      COALESCE(v_booking.quoted_total_fare, v_booking.total_fare, 0) + p_amount,
      COALESCE(v_booking.total_fare, 0)
    )
    ELSE COALESCE(v_booking.quoted_total_fare, v_booking.total_fare, 0)
  END;

  UPDATE public.bookings
  SET
    payment_status = 'paid',
    payment_method = CASE
      WHEN v_wallet_backed THEN 'wallet_plus_online'::public.payment_method
      ELSE 'online'::public.payment_method
    END,
    online_payment_order_id = COALESCE(p_payment_order_id, online_payment_order_id),
    quoted_total_fare = v_new_captured_total,
    updated_at = now()
  WHERE id = p_booking_id;

  RETURN jsonb_build_object(
    'success', true,
    'booking_id', p_booking_id,
    'captured_total', v_new_captured_total,
    'remaining_due', GREATEST(COALESCE(v_booking.total_fare, 0) - v_new_captured_total, 0),
    'payment_method', CASE
      WHEN v_wallet_backed THEN 'wallet_plus_online'
      ELSE 'online'
    END
  );
END;
$$;

DROP FUNCTION IF EXISTS public.complete_trip_atomic(uuid, text, boolean);

CREATE OR REPLACE FUNCTION public.complete_trip_atomic(
  p_booking_id uuid,
  p_payment_method text,
  p_force_complete boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_booking public.bookings%ROWTYPE;
  v_already_paid boolean;
  v_existing_payment_method text;
  v_wallet_backed boolean;
  v_additional_due numeric(10,2);
  v_final_payment_method text;
BEGIN
  SELECT *
  INTO v_booking
  FROM public.bookings
  WHERE id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Booking not found');
  END IF;

  IF v_booking.status = 'completed' AND NOT p_force_complete THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Already completed (idempotent)',
      'driver_payout', v_booking.driver_payout
    );
  END IF;

  IF v_booking.status NOT IN ('in_progress', 'driver_arrived', 'completed') AND NOT p_force_complete THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Booking status is ' || v_booking.status || ', cannot complete'
    );
  END IF;

  v_existing_payment_method := COALESCE(v_booking.payment_method::text, 'cash');
  v_wallet_backed := v_existing_payment_method IN ('wallet', 'partial_wallet', 'wallet_plus_online', 'wallet_plus_cash');
  v_additional_due := CASE
    WHEN v_wallet_backed THEN GREATEST(
      COALESCE(v_booking.total_fare, 0) - COALESCE(v_booking.quoted_total_fare, v_booking.total_fare, 0),
      0
    )
    ELSE 0
  END;

  v_already_paid := v_booking.payment_status = 'paid'
    AND v_existing_payment_method <> 'cash'
    AND v_additional_due <= 0;

  IF v_wallet_backed AND v_additional_due > 0 THEN
    IF lower(COALESCE(p_payment_method, 'cash')) = 'online' THEN
      v_final_payment_method := 'wallet_plus_online';
    ELSE
      v_final_payment_method := 'wallet_plus_cash';
    END IF;
  ELSIF v_already_paid THEN
    v_final_payment_method := v_existing_payment_method;
  ELSE
    v_final_payment_method := lower(COALESCE(p_payment_method, 'cash'));
  END IF;

  UPDATE public.bookings
  SET
    status = 'completed',
    completed_at = COALESCE(completed_at, now()),
    delivery_confirmed_at = COALESCE(delivery_confirmed_at, now()),
    payment_status = 'paid'::public.payment_status,
    payment_method = v_final_payment_method::public.payment_method,
    updated_at = now()
  WHERE id = p_booking_id;

  SELECT *
  INTO v_booking
  FROM public.bookings
  WHERE id = p_booking_id;

  RETURN jsonb_build_object(
    'success', true,
    'booking_id', p_booking_id,
    'driver_id', v_booking.driver_id,
    'payment_method', v_booking.payment_method::text,
    'driver_payout', v_booking.driver_payout,
    'outstanding_additional_due', v_additional_due,
    'message', 'Trip completed successfully'
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', SQLERRM,
      'detail', SQLSTATE
    );
END;
$$;
