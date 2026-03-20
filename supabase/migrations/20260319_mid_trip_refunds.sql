-- Extend refund handling to mid-trip cancellations with proration.

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS quoted_total_fare numeric(10,2),
  ADD COLUMN IF NOT EXISTS cancellation_penalty_amount numeric(10,2) DEFAULT 0;

INSERT INTO public.platform_settings (key, value, description, is_public)
VALUES (
  'cancellation',
  '{"driver_mid_trip_penalty_rate": 10}',
  'Cancellation configuration used for refund and penalty calculations.',
  false
)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.calculate_booking_progress_distance(p_booking_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
AS $$
  WITH ordered_points AS (
    SELECT
      latitude,
      longitude,
      lag(latitude) OVER (ORDER BY recorded_at, id) AS prev_latitude,
      lag(longitude) OVER (ORDER BY recorded_at, id) AS prev_longitude
    FROM public.driver_locations
    WHERE booking_id = p_booking_id
  )
  SELECT COALESCE(SUM(
    CASE
      WHEN prev_latitude IS NULL OR prev_longitude IS NULL THEN 0
      ELSE
        6371 * acos(
          LEAST(1.0, GREATEST(-1.0,
            cos(radians(prev_latitude)) *
            cos(radians(latitude)) *
            cos(radians(longitude) - radians(prev_longitude)) +
            sin(radians(prev_latitude)) *
            sin(radians(latitude))
          ))
        )
    END
  ), 0)::numeric
  FROM ordered_points;
$$;

CREATE OR REPLACE FUNCTION public.apply_mid_trip_cancellation_financials()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_elapsed_minutes numeric := 0;
  v_covered_minutes integer := 0;
  v_distance_ratio numeric := 0;
  v_duration_ratio numeric := 0;
  v_covered_distance numeric := 0;
  v_distance_rate numeric := 0;
  v_time_rate numeric := 0;
  v_distance_component numeric := 0;
  v_time_component numeric := 0;
  v_completed_fare numeric := 0;
  v_penalty_rate numeric := 0;
  v_penalty_amount numeric := 0;
  v_driver_user_id uuid;
  v_is_driver_cancel boolean := false;
BEGIN
  IF NEW.status = 'cancelled'
     AND OLD.status = 'in_progress' THEN

    NEW.quoted_total_fare := COALESCE(OLD.quoted_total_fare, OLD.total_fare);

    SELECT user_id INTO v_driver_user_id
    FROM public.drivers
    WHERE id = OLD.driver_id;

    v_is_driver_cancel := NEW.cancelled_by IS NOT NULL AND NEW.cancelled_by = v_driver_user_id;

    v_elapsed_minutes := GREATEST(
      COALESCE(OLD.actual_duration, 0),
      EXTRACT(EPOCH FROM (COALESCE(NEW.cancelled_at, now()) - COALESCE(OLD.started_at, now()))) / 60.0
    );
    v_covered_minutes := GREATEST(1, CEIL(v_elapsed_minutes));

    v_distance_rate := CASE
      WHEN COALESCE(OLD.estimated_distance, 0) > 0 THEN COALESCE(OLD.distance_fare, 0) / OLD.estimated_distance
      ELSE 0
    END;
    v_time_rate := CASE
      WHEN COALESCE(OLD.estimated_duration, 0) > 0 THEN COALESCE(OLD.time_fare, 0) / OLD.estimated_duration
      ELSE 0
    END;

    v_covered_distance := GREATEST(
      COALESCE(OLD.actual_distance, 0),
      COALESCE(public.calculate_booking_progress_distance(OLD.id), 0)
    );

    IF v_covered_distance <= 0 AND COALESCE(OLD.estimated_distance, 0) > 0 AND COALESCE(OLD.estimated_duration, 0) > 0 THEN
      v_duration_ratio := LEAST(1, v_elapsed_minutes / NULLIF(OLD.estimated_duration, 0));
      v_covered_distance := ROUND(OLD.estimated_distance * COALESCE(v_duration_ratio, 0), 2);
    END IF;

    v_distance_ratio := CASE
      WHEN COALESCE(OLD.estimated_distance, 0) > 0 THEN LEAST(1, v_covered_distance / OLD.estimated_distance)
      ELSE 0
    END;

    IF COALESCE(OLD.estimated_duration, 0) > 0 THEN
      v_covered_minutes := GREATEST(1, LEAST(v_covered_minutes, OLD.estimated_duration));
    END IF;

    v_distance_component := ROUND(v_covered_distance * v_distance_rate, 2);
    v_time_component := ROUND(v_covered_minutes * v_time_rate, 2);

    v_completed_fare := ROUND(
      GREATEST(
        COALESCE(OLD.base_fare, 0)
        + v_distance_component
        + v_time_component
        + COALESCE(OLD.waiting_charges, 0)
        + COALESCE(OLD.addon_charges, 0)
        - COALESCE(OLD.discount_amount, 0),
        COALESCE(OLD.base_fare, 0)
      ),
      2
    );
    v_completed_fare := LEAST(v_completed_fare, COALESCE(OLD.quoted_total_fare, OLD.total_fare));

    v_penalty_rate := COALESCE((public.get_platform_setting('cancellation')->>'driver_mid_trip_penalty_rate')::numeric, 10);
    v_penalty_amount := CASE
      WHEN v_is_driver_cancel THEN ROUND(GREATEST(COALESCE(OLD.quoted_total_fare, OLD.total_fare) - v_completed_fare, 0) * v_penalty_rate / 100.0, 2)
      ELSE 0
    END;

    NEW.actual_duration := v_covered_minutes;
    NEW.actual_distance := ROUND(v_covered_distance, 2);
    NEW.distance_fare := v_distance_component;
    NEW.time_fare := v_time_component;
    NEW.tip_amount := 0;
    NEW.total_fare := v_completed_fare;
    NEW.driver_payout := GREATEST(ROUND(v_completed_fare * 0.85, 2) - v_penalty_amount, 0);
    NEW.cancellation_penalty_amount := v_penalty_amount;
    NEW.refund_reason := CASE
      WHEN v_is_driver_cancel THEN 'driver_cancelled_mid_trip'
      ELSE 'customer_cancelled_mid_trip'
    END;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apply_mid_trip_cancellation_financials ON public.bookings;
CREATE TRIGGER trg_apply_mid_trip_cancellation_financials
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_mid_trip_cancellation_financials();

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
  v_refund_reason text;
  v_refund_source text := 'none';
  v_supabase_url text;
  v_service_role_key text;
  v_request_id bigint;
  v_is_mid_trip boolean := false;
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled' THEN
    v_is_mid_trip := COALESCE(OLD.started_at, NEW.started_at) IS NOT NULL OR OLD.status = 'in_progress';

    IF COALESCE(NEW.payment_method::text, 'cash') = 'wallet' THEN
      v_wallet_captured := CASE
        WHEN COALESCE(NEW.payment_status::text, '') IN ('paid', 'partial_paid') THEN COALESCE(NEW.wallet_amount_used, COALESCE(NEW.quoted_total_fare, NEW.total_fare), 0)
        ELSE 0
      END;
    ELSIF COALESCE(NEW.payment_method::text, 'cash') = 'partial_wallet' THEN
      v_wallet_captured := COALESCE(NEW.wallet_amount_used, 0);
    ELSIF COALESCE(NEW.payment_method::text, 'cash') = 'wallet_plus_online' THEN
      v_wallet_captured := COALESCE(NEW.wallet_amount_used, 0);
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
        'refund_reason', v_refund_reason,
        'completed_fare', NEW.total_fare,
        'driver_payout', NEW.driver_payout,
        'penalty_amount', COALESCE(NEW.cancellation_penalty_amount, 0)
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

CREATE OR REPLACE FUNCTION public.on_booking_cancelled()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_earning RECORD;
  v_wallet_id uuid;
  v_target_payout numeric := COALESCE(NEW.driver_payout, 0);
  v_reversal_amount numeric := 0;
BEGIN
  IF NEW.status = 'cancelled' AND (OLD.status IS NULL OR OLD.status != 'cancelled') THEN
    SELECT *
    INTO v_earning
    FROM public.driver_wallet_transactions
    WHERE booking_id = NEW.id
      AND type = 'earning'
      AND status = 'completed'
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_earning.id IS NOT NULL THEN
      SELECT id INTO v_wallet_id
      FROM public.driver_wallets
      WHERE driver_id = v_earning.driver_id;

      IF COALESCE(OLD.started_at, NEW.started_at) IS NOT NULL OR OLD.status = 'in_progress' THEN
        v_reversal_amount := GREATEST(v_earning.amount - v_target_payout, 0);

        IF v_reversal_amount > 0
           AND NOT EXISTS (
             SELECT 1
             FROM public.driver_wallet_transactions
             WHERE booking_id = NEW.id
               AND type = 'reversal'
               AND description = 'Partial earning reversal due to mid-trip cancellation'
           ) THEN
          IF v_earning.balance_type = 'pending' THEN
            UPDATE public.driver_wallets
            SET
              pending_balance = pending_balance - v_reversal_amount,
              total_earned = total_earned - v_reversal_amount,
              updated_at = now()
            WHERE id = v_wallet_id;
          ELSE
            UPDATE public.driver_wallets
            SET
              available_balance = available_balance - v_reversal_amount,
              total_earned = total_earned - v_reversal_amount,
              updated_at = now()
            WHERE id = v_wallet_id;
          END IF;

          INSERT INTO public.driver_wallet_transactions (
            driver_id, booking_id, type, amount, balance_type, direction, status, description
          ) VALUES (
            v_earning.driver_id, NEW.id, 'reversal', v_reversal_amount, v_earning.balance_type, 'debit', 'completed',
            'Partial earning reversal due to mid-trip cancellation'
          );

          UPDATE public.drivers
          SET
            total_earnings = GREATEST(COALESCE(total_earnings, 0) - v_reversal_amount, 0),
            updated_at = now()
          WHERE id = NEW.driver_id;
        END IF;

        IF v_earning.balance_type = 'pending'
           AND v_target_payout > 0
           AND NOT EXISTS (
             SELECT 1
             FROM public.driver_wallet_transactions
             WHERE booking_id = NEW.id
               AND type = 'release'
               AND description = 'Completed portion released after mid-trip cancellation'
           ) THEN
          UPDATE public.driver_wallets
          SET
            pending_balance = pending_balance - v_target_payout,
            available_balance = available_balance + v_target_payout,
            updated_at = now()
          WHERE id = v_wallet_id;

          INSERT INTO public.driver_wallet_transactions (
            driver_id, booking_id, type, amount, balance_type, direction, status, description
          ) VALUES (
            v_earning.driver_id, NEW.id, 'release', v_target_payout, 'available', 'credit', 'completed',
            'Completed portion released after mid-trip cancellation'
          );
        END IF;
      ELSE
        v_reversal_amount := v_earning.amount;

        IF v_reversal_amount > 0
           AND NOT EXISTS (
             SELECT 1 FROM public.driver_wallet_transactions
             WHERE booking_id = NEW.id AND type = 'reversal'
           ) THEN
          IF v_earning.balance_type = 'pending' THEN
            UPDATE public.driver_wallets
            SET
              pending_balance = pending_balance - v_reversal_amount,
              total_earned = total_earned - v_reversal_amount,
              updated_at = now()
            WHERE id = v_wallet_id;
          ELSE
            UPDATE public.driver_wallets
            SET
              available_balance = available_balance - v_reversal_amount,
              total_earned = total_earned - v_reversal_amount,
              updated_at = now()
            WHERE id = v_wallet_id;
          END IF;

          INSERT INTO public.driver_wallet_transactions (
            driver_id, booking_id, type, amount, balance_type, direction, status, description
          ) VALUES (
            v_earning.driver_id, NEW.id, 'reversal', v_reversal_amount, v_earning.balance_type, 'debit', 'completed',
            'Earnings reversed due to trip cancellation'
          );

          UPDATE public.drivers
          SET
            total_earnings = GREATEST(COALESCE(total_earnings, 0) - v_reversal_amount, 0),
            updated_at = now()
          WHERE id = NEW.driver_id;
        END IF;
      END IF;
    ELSIF v_target_payout > 0 AND NEW.driver_id IS NOT NULL THEN
      v_wallet_id := public.ensure_driver_wallet(NEW.driver_id);

      UPDATE public.driver_wallets
      SET
        available_balance = available_balance + v_target_payout,
        total_earned = total_earned + v_target_payout,
        updated_at = now()
      WHERE id = v_wallet_id;

      INSERT INTO public.driver_wallet_transactions (
        driver_id, booking_id, type, amount, balance_type, direction, status, description
      ) VALUES (
        NEW.driver_id, NEW.id, 'adjustment', v_target_payout, 'available', 'credit', 'completed',
        'Driver payout for completed portion after mid-trip cancellation'
      );

      UPDATE public.drivers
      SET
        total_earnings = COALESCE(total_earnings, 0) + v_target_payout,
        updated_at = now()
      WHERE id = NEW.driver_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
