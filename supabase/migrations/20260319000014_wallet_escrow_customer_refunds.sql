-- Customer wallet escrow for booking payments.
-- Holds wallet-funded booking amounts until the trip is consumed or refunded.

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS wallet_escrow_amount numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS wallet_escrow_status text DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS wallet_escrow_held_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS wallet_escrow_released_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS wallet_escrow_refunded_at timestamp with time zone;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'bookings_wallet_escrow_status_check'
  ) THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_wallet_escrow_status_check
      CHECK (
        wallet_escrow_status IN (
          'none',
          'held',
          'released',
          'refunded',
          'partially_refunded',
          'failed'
        )
      );
  END IF;
END $$;

UPDATE public.bookings
SET
  wallet_escrow_amount = CASE
    WHEN COALESCE(wallet_escrow_amount, 0) > 0 THEN wallet_escrow_amount
    WHEN payment_method::text IN ('wallet', 'partial_wallet', 'wallet_plus_online')
      THEN COALESCE(wallet_amount_used, quoted_total_fare, total_fare, 0)
    ELSE 0
  END,
  wallet_escrow_status = CASE
    WHEN status = 'completed' AND payment_method::text IN ('wallet', 'partial_wallet', 'wallet_plus_online')
      THEN 'released'
    WHEN status = 'cancelled' AND refund_status = 'succeeded'
      THEN 'refunded'
    WHEN status IN ('pending', 'accepted', 'driver_arrived', 'in_progress')
      AND payment_method::text IN ('wallet', 'partial_wallet', 'wallet_plus_online')
      THEN 'held'
    ELSE COALESCE(wallet_escrow_status, 'none')
  END,
  wallet_escrow_held_at = CASE
    WHEN payment_method::text IN ('wallet', 'partial_wallet', 'wallet_plus_online')
      THEN COALESCE(wallet_escrow_held_at, updated_at, created_at, now())
    ELSE wallet_escrow_held_at
  END,
  wallet_escrow_released_at = CASE
    WHEN status = 'completed' AND payment_method::text IN ('wallet', 'partial_wallet', 'wallet_plus_online')
      THEN COALESCE(wallet_escrow_released_at, completed_at, updated_at, now())
    ELSE wallet_escrow_released_at
  END,
  wallet_escrow_refunded_at = CASE
    WHEN status = 'cancelled' AND refund_status = 'succeeded'
      THEN COALESCE(wallet_escrow_refunded_at, refund_completed_at, updated_at, now())
    ELSE wallet_escrow_refunded_at
  END
WHERE payment_method::text IN ('wallet', 'partial_wallet', 'wallet_plus_online');

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

  IF COALESCE(v_booking.wallet_escrow_status, 'none') = 'held'
     AND COALESCE(v_booking.wallet_escrow_amount, 0) > 0 THEN
    SELECT balance INTO v_user_balance
    FROM public.users
    WHERE id = p_user_id;

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

CREATE OR REPLACE FUNCTION public.complete_partial_payment(
  p_booking_id uuid,
  p_payment_order_id text,
  p_amount_paid numeric
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_booking RECORD;
BEGIN
  SELECT *
  INTO v_booking
  FROM public.bookings
  WHERE id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Booking not found');
  END IF;

  IF v_booking.payment_status <> 'partial_paid' THEN
    RETURN json_build_object('success', false, 'error', 'Not a partial payment booking');
  END IF;

  UPDATE public.bookings
  SET
    payment_status = 'paid',
    payment_method = 'wallet_plus_online',
    online_payment_order_id = p_payment_order_id,
    quoted_total_fare = COALESCE(quoted_total_fare, total_fare),
    wallet_escrow_amount = COALESCE(wallet_escrow_amount, wallet_amount_used, 0),
    wallet_escrow_status = CASE
      WHEN COALESCE(wallet_amount_used, 0) > 0 THEN COALESCE(NULLIF(wallet_escrow_status, 'none'), 'held')
      ELSE COALESCE(wallet_escrow_status, 'none')
    END,
    wallet_escrow_held_at = CASE
      WHEN COALESCE(wallet_amount_used, 0) > 0 THEN COALESCE(wallet_escrow_held_at, now())
      ELSE wallet_escrow_held_at
    END,
    updated_at = now()
  WHERE id = p_booking_id;

  RETURN json_build_object(
    'success', true,
    'wallet_amount', v_booking.wallet_amount_used,
    'online_amount', p_amount_paid,
    'total_amount', COALESCE(v_booking.quoted_total_fare, v_booking.total_fare)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.release_wallet_escrow_on_settlement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.status = 'completed'
     AND OLD.status IS DISTINCT FROM 'completed'
     AND COALESCE(NEW.wallet_escrow_amount, 0) > 0
     AND COALESCE(NEW.wallet_escrow_status, 'none') = 'held' THEN
    UPDATE public.bookings
    SET
      wallet_escrow_status = 'released',
      wallet_escrow_released_at = COALESCE(wallet_escrow_released_at, now()),
      updated_at = now()
    WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_release_wallet_escrow_on_settlement ON public.bookings;
CREATE TRIGGER trg_release_wallet_escrow_on_settlement
  AFTER UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.release_wallet_escrow_on_settlement();

CREATE OR REPLACE FUNCTION public.queue_booking_refund()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_wallet_captured numeric(10,2) := 0;
  v_online_captured numeric(10,2) := 0;
  v_total_captured numeric(10,2) := 0;
  v_total_refund numeric(10,2) := 0;
  v_wallet_refund numeric(10,2) := 0;
  v_online_refund numeric(10,2) := 0;
  v_refund_reason text;
  v_refund_source text := 'none';
  v_notification_body text;
  v_supabase_url text;
  v_service_role_key text;
  v_request_id bigint;
  v_is_mid_trip boolean := false;
  v_wallet_refund_ref text;
  v_existing_wallet_txn uuid;
  v_wallet_credit_succeeded boolean := false;
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled' THEN
    v_is_mid_trip := COALESCE(OLD.started_at, NEW.started_at) IS NOT NULL OR OLD.status = 'in_progress';

    IF COALESCE(NEW.payment_method::text, 'cash') = 'wallet' THEN
      v_wallet_captured := CASE
        WHEN COALESCE(NEW.payment_status::text, '') IN ('paid', 'partial_paid')
          THEN COALESCE(NEW.wallet_escrow_amount, NEW.wallet_amount_used, COALESCE(NEW.quoted_total_fare, NEW.total_fare), 0)
        ELSE 0
      END;
    ELSIF COALESCE(NEW.payment_method::text, 'cash') = 'partial_wallet' THEN
      v_wallet_captured := COALESCE(NEW.wallet_escrow_amount, NEW.wallet_amount_used, 0);
    ELSIF COALESCE(NEW.payment_method::text, 'cash') = 'wallet_plus_online' THEN
      v_wallet_captured := COALESCE(NEW.wallet_escrow_amount, NEW.wallet_amount_used, 0);
      IF COALESCE(NEW.payment_status::text, '') = 'paid' THEN
        v_online_captured := GREATEST(COALESCE(NEW.quoted_total_fare, NEW.total_fare) - v_wallet_captured, 0);
      END IF;
    ELSIF COALESCE(NEW.payment_method::text, 'cash') = 'online' THEN
      IF COALESCE(NEW.payment_status::text, '') = 'paid' THEN
        v_online_captured := COALESCE(NEW.quoted_total_fare, NEW.total_fare, 0);
      END IF;
    END IF;

    v_total_captured := COALESCE(v_wallet_captured, 0) + COALESCE(v_online_captured, 0);

    IF NEW.refund_reason IS NOT NULL THEN
      v_refund_reason := NEW.refund_reason;
    ELSIF NEW.cancelled_by = NEW.customer_id THEN
      v_refund_reason := CASE WHEN v_is_mid_trip THEN 'customer_cancelled_mid_trip' ELSE 'customer_cancelled_before_trip_start' END;
    ELSIF COALESCE(NEW.cancellation_reason, '') ILIKE '%driver%' THEN
      v_refund_reason := CASE WHEN v_is_mid_trip THEN 'driver_cancelled_mid_trip' ELSE 'driver_cancelled_before_pickup' END;
    ELSE
      v_refund_reason := CASE WHEN v_is_mid_trip THEN 'cancelled_mid_trip' ELSE 'cancelled_before_trip_start' END;
    END IF;

    v_total_refund := CASE
      WHEN v_is_mid_trip THEN GREATEST(v_total_captured - COALESCE(NEW.total_fare, 0), 0)
      ELSE v_total_captured
    END;
    v_wallet_refund := LEAST(v_total_refund, v_wallet_captured);
    v_online_refund := GREATEST(v_total_refund - v_wallet_refund, 0);

    IF v_wallet_captured > 0 AND v_total_refund > 0 THEN
      v_refund_source := CASE
        WHEN v_total_refund > v_wallet_captured THEN 'wallet_and_original_payment_source'
        ELSE 'wallet'
      END;
    ELSIF v_total_refund > 0 THEN
      v_refund_source := 'original_payment_source';
    END IF;

    IF v_total_refund <= 0 THEN
      UPDATE public.bookings
      SET
        refund_status = 'not_applicable',
        refund_amount = 0,
        refund_reason = v_refund_reason,
        refund_source = v_refund_source,
        refund_error = NULL,
        wallet_escrow_status = CASE
          WHEN COALESCE(wallet_escrow_amount, 0) > 0 AND COALESCE(wallet_escrow_status, 'none') = 'held'
            THEN 'released'
          ELSE wallet_escrow_status
        END,
        wallet_escrow_released_at = CASE
          WHEN COALESCE(wallet_escrow_amount, 0) > 0 AND COALESCE(wallet_escrow_status, 'none') = 'held'
            THEN COALESCE(wallet_escrow_released_at, now())
          ELSE wallet_escrow_released_at
        END,
        updated_at = now()
      WHERE id = NEW.id;

      RETURN NEW;
    END IF;

    UPDATE public.bookings
    SET
      refund_status = 'pending',
      refund_amount = v_total_refund,
      refund_reason = v_refund_reason,
      refund_source = v_refund_source,
      refund_error = NULL,
      refund_initiated_at = COALESCE(refund_initiated_at, now()),
      updated_at = now()
    WHERE id = NEW.id;

    IF v_wallet_refund > 0 THEN
      v_wallet_refund_ref := 'BOOKING_REFUND_' || NEW.id || '_WALLET';

      SELECT id
      INTO v_existing_wallet_txn
      FROM public.wallet_transactions
      WHERE payment_order_id = v_wallet_refund_ref
      LIMIT 1;

      IF v_existing_wallet_txn IS NULL THEN
        INSERT INTO public.wallet_transactions (
          user_id,
          amount,
          type,
          status,
          payment_order_id,
          booking_id,
          description
        ) VALUES (
          NEW.customer_id,
          v_wallet_refund,
          'credit',
          'pending',
          v_wallet_refund_ref,
          NEW.id,
          'Trip refund - Booking #' || NEW.booking_number
        )
        RETURNING id INTO v_existing_wallet_txn;
      END IF;

      SELECT public.atomic_credit_wallet_idempotent(
        NEW.customer_id,
        v_wallet_refund,
        v_wallet_refund_ref
      )
      INTO v_wallet_credit_succeeded;

      IF NOT v_wallet_credit_succeeded THEN
        SELECT EXISTS (
          SELECT 1
          FROM public.wallet_transactions
          WHERE payment_order_id = v_wallet_refund_ref
            AND status = 'completed'
        )
        INTO v_wallet_credit_succeeded;
      END IF;

      UPDATE public.bookings
      SET
        wallet_escrow_status = CASE
          WHEN v_wallet_credit_succeeded AND v_online_refund <= 0 THEN 'refunded'
          WHEN v_wallet_credit_succeeded THEN 'partially_refunded'
          ELSE 'failed'
        END,
        wallet_escrow_refunded_at = CASE
          WHEN v_wallet_credit_succeeded THEN COALESCE(wallet_escrow_refunded_at, now())
          ELSE wallet_escrow_refunded_at
        END,
        refund_status = CASE
          WHEN v_wallet_credit_succeeded AND v_online_refund <= 0 THEN 'succeeded'
          WHEN v_wallet_credit_succeeded THEN refund_status
          ELSE 'failed'
        END,
        refund_completed_at = CASE
          WHEN v_wallet_credit_succeeded AND v_online_refund <= 0 THEN COALESCE(refund_completed_at, now())
          ELSE refund_completed_at
        END,
        refund_error = CASE
          WHEN v_wallet_credit_succeeded THEN NULL
          ELSE 'Wallet refund could not be completed automatically'
        END,
        payment_status = CASE
          WHEN v_wallet_credit_succeeded AND v_online_refund <= 0 THEN 'refunded'::payment_status
          ELSE payment_status
        END,
        updated_at = now()
      WHERE id = NEW.id;

      IF NOT v_wallet_credit_succeeded THEN
        INSERT INTO public.notifications (
          user_id,
          title,
          body,
          data,
          notification_type,
          is_read
        ) VALUES (
          NEW.customer_id,
          'Refund delayed',
          'We could not return your wallet hold automatically. Our team has been notified and will help shortly.',
          jsonb_build_object(
            'booking_id', NEW.id,
            'type', 'refund_update',
            'refund_status', 'failed',
            'refund_amount', v_total_refund
          ),
          'refund_update',
          false
        );

        RETURN NEW;
      END IF;
    END IF;

    v_notification_body := CASE
      WHEN v_wallet_refund > 0 AND v_online_refund > 0 THEN
        'Your wallet hold refund has been initiated and should return shortly. Any online refund usually reaches your original payment source in 7 to 10 business days.'
      WHEN v_wallet_refund > 0 THEN
        'Your wallet hold refund has been initiated and should return to your wallet shortly.'
      ELSE
        'Your refund has been initiated. Funds usually return to your original payment source in 7 to 10 business days.'
    END;

    INSERT INTO public.notifications (
      user_id,
      title,
      body,
      data,
      notification_type,
      is_read
    ) VALUES (
      NEW.customer_id,
      'Refund initiated',
      v_notification_body,
      jsonb_build_object(
        'booking_id', NEW.id,
        'type', 'refund_initiated',
        'refund_amount', v_total_refund,
        'wallet_refund_amount', v_wallet_refund,
        'online_refund_amount', v_online_refund,
        'refund_reason', v_refund_reason,
        'completed_fare', NEW.total_fare,
        'driver_payout', NEW.driver_payout,
        'penalty_amount', COALESCE(NEW.cancellation_penalty_amount, 0)
      ),
      'refund_update',
      false
    );

    IF v_online_refund <= 0 THEN
      RETURN NEW;
    END IF;

    v_supabase_url := COALESCE(
      current_setting('app.settings.supabase_url', true),
      CASE
        WHEN current_setting('app.settings.project_ref', true) IS NOT NULL
        THEN 'https://' || current_setting('app.settings.project_ref', true) || '.supabase.co'
        ELSE NULL
      END,
      'https://epevjbiymsvwmmzybzib.supabase.co'
    );
    v_service_role_key := current_setting('app.settings.service_role_key', true);

    IF v_supabase_url IS NULL THEN
      UPDATE public.bookings
      SET
        refund_status = 'failed',
        refund_error = 'Supabase URL is not configured for refund processing',
        wallet_escrow_status = CASE
          WHEN COALESCE(wallet_escrow_amount, 0) > 0 THEN 'failed'
          ELSE wallet_escrow_status
        END,
        updated_at = now()
      WHERE id = NEW.id;

      RETURN NEW;
    END IF;

    SELECT net.http_post(
      url := v_supabase_url || '/functions/v1/process-booking-refund',
      headers := CASE
        WHEN v_service_role_key IS NULL OR v_service_role_key = ''
        THEN jsonb_build_object('Content-Type', 'application/json')
        ELSE jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_service_role_key
        )
      END,
      body := jsonb_build_object(
        'booking_id', NEW.id,
        'trigger', 'booking_cancelled'
      )
    ) INTO v_request_id;

    RAISE NOTICE 'Queued refund processing request % for booking %', v_request_id, NEW.id;
  END IF;

  RETURN NEW;
END;
$$;
