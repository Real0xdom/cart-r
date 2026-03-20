-- MVP booking refund automation for pre-trip cancellations
-- Rules implemented:
-- 1. Customer cancellation before trip start => full refund of captured payment.
-- 2. Driver cancellation before pickup => full refund of captured payment.
-- 3. Refund metadata is stored on bookings for auditability.

CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA extensions;

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS refund_status text,
  ADD COLUMN IF NOT EXISTS refund_amount numeric(10,2),
  ADD COLUMN IF NOT EXISTS refund_reason text,
  ADD COLUMN IF NOT EXISTS refund_error text,
  ADD COLUMN IF NOT EXISTS refund_id text,
  ADD COLUMN IF NOT EXISTS refund_source text,
  ADD COLUMN IF NOT EXISTS refund_initiated_at timestamptz,
  ADD COLUMN IF NOT EXISTS refund_completed_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'bookings_refund_status_check'
  ) THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_refund_status_check
      CHECK (
        refund_status IS NULL
        OR refund_status = ANY (
          ARRAY['pending', 'processing', 'succeeded', 'failed', 'not_applicable']
        )
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_bookings_refund_status
  ON public.bookings(refund_status)
  WHERE refund_status IS NOT NULL;

CREATE OR REPLACE FUNCTION public.cancel_booking_by_driver(
  p_booking_id uuid,
  p_driver_id uuid,
  p_reason text DEFAULT 'Cancelled by driver before pickup'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_booking public.bookings%ROWTYPE;
  v_driver_user_id uuid;
BEGIN
  SELECT *
  INTO v_booking
  FROM public.bookings
  WHERE id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Booking not found');
  END IF;

  IF v_booking.driver_id IS DISTINCT FROM p_driver_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Driver not assigned to this booking');
  END IF;

  IF v_booking.status NOT IN ('accepted', 'driver_arrived', 'in_progress') THEN
    RETURN jsonb_build_object(
      'success',
      false,
      'error',
      'Driver can only cancel an active trip before completion'
    );
  END IF;

  SELECT d.user_id
  INTO v_driver_user_id
  FROM public.drivers AS d
  WHERE d.id = p_driver_id;

  UPDATE public.bookings
  SET
    status = 'cancelled',
    cancelled_at = now(),
    cancelled_by = v_driver_user_id,
    cancellation_reason = COALESCE(
      NULLIF(trim(p_reason), ''),
      CASE
        WHEN v_booking.status = 'in_progress' THEN 'Cancelled by driver mid-trip'
        ELSE 'Cancelled by driver before pickup'
      END
    ),
    updated_at = now()
  WHERE id = p_booking_id;

  RETURN jsonb_build_object(
    'success',
    true,
    'booking_id',
    p_booking_id,
    'message',
    'Booking cancelled and refund flow queued'
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

CREATE OR REPLACE FUNCTION public.queue_booking_refund()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_wallet_refund numeric(10,2) := 0;
  v_online_refund numeric(10,2) := 0;
  v_total_refund numeric(10,2) := 0;
  v_refund_reason text;
  v_refund_source text := 'none';
  v_supabase_url text;
  v_service_role_key text;
  v_request_id bigint;
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled' THEN
    -- Refunds only apply before the trip has started.
    IF COALESCE(OLD.started_at, NEW.started_at) IS NOT NULL OR OLD.status IN ('in_progress', 'completed') THEN
      UPDATE public.bookings
      SET
        refund_status = 'not_applicable',
        refund_amount = 0,
        refund_reason = COALESCE(NEW.refund_reason, 'Cancellation happened after trip start'),
        refund_source = 'none',
        refund_error = NULL,
        updated_at = now()
      WHERE id = NEW.id;

      RETURN NEW;
    END IF;

    IF COALESCE(NEW.payment_method::text, 'cash') = 'wallet' THEN
      v_wallet_refund := CASE
        WHEN COALESCE(NEW.payment_status::text, '') IN ('paid', 'partial_paid') THEN COALESCE(NEW.wallet_amount_used, NEW.total_fare, 0)
        ELSE 0
      END;
    ELSIF COALESCE(NEW.payment_method::text, 'cash') = 'partial_wallet' THEN
      v_wallet_refund := COALESCE(NEW.wallet_amount_used, 0);
    ELSIF COALESCE(NEW.payment_method::text, 'cash') = 'wallet_plus_online' THEN
      v_wallet_refund := COALESCE(NEW.wallet_amount_used, 0);
      IF COALESCE(NEW.payment_status::text, '') = 'paid' THEN
        v_online_refund := GREATEST(COALESCE(NEW.total_fare, 0) - v_wallet_refund, 0);
      END IF;
    ELSIF COALESCE(NEW.payment_method::text, 'cash') = 'online' THEN
      IF COALESCE(NEW.payment_status::text, '') = 'paid' THEN
        v_online_refund := COALESCE(NEW.total_fare, 0);
      END IF;
    END IF;

    v_total_refund := COALESCE(v_wallet_refund, 0) + COALESCE(v_online_refund, 0);

    IF NEW.cancelled_by = NEW.customer_id THEN
      v_refund_reason := 'customer_cancelled_before_trip_start';
    ELSIF COALESCE(NEW.cancellation_reason, '') ILIKE '%driver%' THEN
      v_refund_reason := 'driver_cancelled_before_pickup';
    ELSE
      v_refund_reason := 'cancelled_before_trip_start';
    END IF;

    IF v_wallet_refund > 0 AND v_online_refund > 0 THEN
      v_refund_source := 'wallet_and_original_payment_source';
    ELSIF v_online_refund > 0 THEN
      v_refund_source := 'original_payment_source';
    ELSIF v_wallet_refund > 0 THEN
      v_refund_source := 'wallet';
    END IF;

    IF v_total_refund <= 0 THEN
      UPDATE public.bookings
      SET
        refund_status = 'not_applicable',
        refund_amount = 0,
        refund_reason = v_refund_reason,
        refund_source = v_refund_source,
        refund_error = NULL,
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
      'Your refund of Rs.' || trim(to_char(v_total_refund, 'FM999999990.00')) || ' has been initiated. Funds usually return in 7 to 10 business days.',
      jsonb_build_object(
        'booking_id', NEW.id,
        'type', 'refund_initiated',
        'refund_amount', v_total_refund,
        'refund_reason', v_refund_reason
      ),
      'refund_update',
      false
    );

    v_supabase_url := COALESCE(
      current_setting('app.settings.supabase_url', true),
      CASE
        WHEN current_setting('app.settings.project_ref', true) IS NOT NULL
        THEN 'https://' || current_setting('app.settings.project_ref', true) || '.supabase.co'
        ELSE NULL
      END
    );
    v_service_role_key := current_setting('app.settings.service_role_key', true);

    IF v_supabase_url IS NULL THEN
      UPDATE public.bookings
      SET
        refund_status = 'failed',
        refund_error = 'Supabase URL is not configured for refund processing',
        updated_at = now()
      WHERE id = NEW.id;

      RETURN NEW;
    END IF;

    SELECT extensions.net.http_post(
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

DROP TRIGGER IF EXISTS trg_booking_refund_request ON public.bookings;
CREATE TRIGGER trg_booking_refund_request
  AFTER UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.queue_booking_refund();
