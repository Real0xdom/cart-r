-- Queued ride support for bookings MVP
-- Adds single queued ride support per driver, queue promotion on completion,
-- shared cancellation cleanup, and availability filtering updates.

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS queued_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_bookings_driver_queued
  ON public.bookings(driver_id, queued_at)
  WHERE status = 'queued';

CREATE UNIQUE INDEX IF NOT EXISTS ux_bookings_one_queued_per_driver
  ON public.bookings(driver_id)
  WHERE status = 'queued' AND driver_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.enqueue_notification(
  p_user_id uuid,
  p_title text,
  p_body text,
  p_data jsonb DEFAULT '{}'::jsonb,
  p_notification_type text DEFAULT 'booking_update'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.notifications (
    user_id,
    title,
    body,
    data,
    notification_type,
    is_read
  ) VALUES (
    p_user_id,
    p_title,
    p_body,
    COALESCE(p_data, '{}'::jsonb),
    p_notification_type,
    false
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.requeue_booking_for_search(
  p_booking_id uuid,
  p_skip_driver_id uuid DEFAULT NULL,
  p_reason text DEFAULT NULL,
  p_customer_title text DEFAULT 'Searching for a new driver',
  p_customer_body text DEFAULT 'Your previous driver is no longer available. Searching for a new driver now.'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
    RETURN false;
  END IF;

  IF p_skip_driver_id IS NOT NULL THEN
    INSERT INTO public.driver_rejections (booking_id, driver_id)
    VALUES (p_booking_id, p_skip_driver_id)
    ON CONFLICT (booking_id, driver_id) DO NOTHING;
  END IF;

  UPDATE public.bookings
  SET
    status = 'pending',
    driver_id = NULL,
    queued_at = NULL,
    accepted_at = NULL,
    driver_arrived_at = NULL,
    started_at = NULL,
    completed_at = NULL,
    cancelled_at = NULL,
    cancelled_by = NULL,
    cancellation_reason = COALESCE(NULLIF(trim(p_reason), ''), cancellation_reason),
    updated_at = now()
  WHERE id = p_booking_id;

  PERFORM public.enqueue_notification(
    v_booking.customer_id,
    p_customer_title,
    p_customer_body,
    jsonb_build_object(
      'booking_id', v_booking.id,
      'type', 'queue_reentered_search',
      'status', 'pending',
      'booking_number', v_booking.booking_number
    ),
    'booking_update'
  );

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.promote_next_queued_booking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next_booking_id uuid;
BEGIN
  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' AND NEW.driver_id IS NOT NULL THEN
    SELECT b.id
    INTO v_next_booking_id
    FROM public.bookings AS b
    WHERE b.driver_id = NEW.driver_id
      AND b.status = 'queued'
    ORDER BY b.queued_at ASC NULLS LAST, b.created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    IF v_next_booking_id IS NOT NULL THEN
      UPDATE public.bookings
      SET
        status = 'accepted',
        accepted_at = now(),
        updated_at = now()
      WHERE id = v_next_booking_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_promote_next_queued_booking ON public.bookings;
CREATE TRIGGER trg_promote_next_queued_booking
  AFTER UPDATE ON public.bookings
  FOR EACH ROW
  WHEN (NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed')
  EXECUTE FUNCTION public.promote_next_queued_booking();

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

  IF v_booking.expires_at IS NOT NULL AND v_booking.expires_at < now() THEN
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

GRANT EXECUTE ON FUNCTION public.accept_booking_atomic(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.cancel_booking_by_customer_v2(
  p_booking_id uuid,
  p_customer_user_id uuid,
  p_reason text DEFAULT 'Cancelled by customer'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking public.bookings%ROWTYPE;
  v_driver_user_id uuid;
  v_queued_booking_id uuid;
BEGIN
  SELECT *
  INTO v_booking
  FROM public.bookings
  WHERE id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Booking not found');
  END IF;

  IF v_booking.customer_id IS DISTINCT FROM p_customer_user_id OR auth.uid() IS DISTINCT FROM p_customer_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized booking access');
  END IF;

  IF v_booking.status NOT IN ('pending', 'accepted', 'driver_arrived', 'in_progress', 'queued') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Booking cannot be cancelled in its current state');
  END IF;

  IF v_booking.status = 'queued' THEN
    UPDATE public.bookings
    SET
      status = 'cancelled',
      cancelled_at = now(),
      cancelled_by = p_customer_user_id,
      cancellation_reason = COALESCE(NULLIF(trim(p_reason), ''), 'Cancelled by customer'),
      updated_at = now()
    WHERE id = p_booking_id;

    IF v_booking.driver_id IS NOT NULL THEN
      SELECT d.user_id
      INTO v_driver_user_id
      FROM public.drivers AS d
      WHERE d.id = v_booking.driver_id;

      PERFORM public.enqueue_notification(
        v_driver_user_id,
        'Queued ride cancelled',
        'Your next ride has been cancelled by the customer.',
        jsonb_build_object(
          'booking_id', v_booking.id,
          'type', 'queued_customer_cancelled',
          'status', 'cancelled'
        ),
        'booking_update'
      );
    END IF;

    RETURN jsonb_build_object('success', true, 'message', 'Queued booking cancelled successfully');
  END IF;

  IF v_booking.status IN ('accepted', 'driver_arrived', 'in_progress') AND v_booking.driver_id IS NOT NULL THEN
    SELECT b.id
    INTO v_queued_booking_id
    FROM public.bookings AS b
    WHERE b.driver_id = v_booking.driver_id
      AND b.status = 'queued'
    ORDER BY b.queued_at ASC NULLS LAST, b.created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    IF v_queued_booking_id IS NOT NULL THEN
      PERFORM public.requeue_booking_for_search(
        v_queued_booking_id,
        v_booking.driver_id,
        'Previous active ride was cancelled',
        'Searching for a new driver',
        'Your driver is no longer available. Searching for a new driver now.'
      );
    END IF;
  END IF;

  UPDATE public.bookings
  SET
    status = 'cancelled',
    cancelled_at = now(),
    cancelled_by = p_customer_user_id,
    cancellation_reason = COALESCE(NULLIF(trim(p_reason), ''), 'Cancelled by customer'),
    updated_at = now()
  WHERE id = p_booking_id;

  RETURN jsonb_build_object('success', true, 'message', 'Booking cancelled successfully');
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_booking_by_customer_v2(uuid, uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.cancel_booking_by_driver(
  p_booking_id uuid,
  p_driver_id uuid,
  p_reason text DEFAULT 'Cancelled by driver before pickup'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking public.bookings%ROWTYPE;
  v_driver_user_id uuid;
  v_queued_booking_id uuid;
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

  SELECT d.user_id
  INTO v_driver_user_id
  FROM public.drivers AS d
  WHERE d.id = p_driver_id;

  IF v_booking.status = 'queued' THEN
    PERFORM public.requeue_booking_for_search(
      p_booking_id,
      p_driver_id,
      'Queued ride cancelled by driver',
      'Searching for a new driver',
      'Your driver cancelled before starting your queued ride. Searching for a new driver now.'
    );

    RETURN jsonb_build_object(
      'success', true,
      'booking_id', p_booking_id,
      'message', 'Queued booking returned to search'
    );
  END IF;

  IF v_booking.status NOT IN ('accepted', 'driver_arrived', 'in_progress') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Driver can only cancel an active or queued trip before completion'
    );
  END IF;

  SELECT b.id
  INTO v_queued_booking_id
  FROM public.bookings AS b
  WHERE b.driver_id = p_driver_id
    AND b.status = 'queued'
  ORDER BY b.queued_at ASC NULLS LAST, b.created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

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

  IF v_queued_booking_id IS NOT NULL THEN
    PERFORM public.requeue_booking_for_search(
      v_queued_booking_id,
      p_driver_id,
      'Previous active ride was cancelled',
      'Searching for a new driver',
      'Your driver is no longer available. Searching for a new driver now.'
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'booking_id', p_booking_id,
    'message', 'Booking cancelled and queue cleaned up'
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_cancel_booking(
  p_booking_id uuid,
  p_reason text DEFAULT 'Cancelled by admin'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking public.bookings%ROWTYPE;
  v_queued_booking_id uuid;
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

  IF v_booking.status = 'queued' THEN
    UPDATE public.bookings
    SET
      status = 'cancelled',
      cancelled_at = now(),
      cancellation_reason = COALESCE(NULLIF(trim(p_reason), ''), 'Cancelled by admin'),
      updated_at = now()
    WHERE id = p_booking_id;

    IF v_booking.driver_id IS NOT NULL THEN
      SELECT d.user_id
      INTO v_driver_user_id
      FROM public.drivers AS d
      WHERE d.id = v_booking.driver_id;

      PERFORM public.enqueue_notification(
        v_driver_user_id,
        'Queued ride cancelled',
        'An admin cancelled your queued ride.',
        jsonb_build_object(
          'booking_id', v_booking.id,
          'type', 'queued_admin_cancelled',
          'status', 'cancelled'
        ),
        'booking_update'
      );
    END IF;

    RETURN jsonb_build_object('success', true, 'message', 'Queued booking cancelled successfully');
  END IF;

  IF v_booking.status IN ('accepted', 'driver_arrived', 'in_progress') AND v_booking.driver_id IS NOT NULL THEN
    SELECT b.id
    INTO v_queued_booking_id
    FROM public.bookings AS b
    WHERE b.driver_id = v_booking.driver_id
      AND b.status = 'queued'
    ORDER BY b.queued_at ASC NULLS LAST, b.created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    IF v_queued_booking_id IS NOT NULL THEN
      PERFORM public.requeue_booking_for_search(
        v_queued_booking_id,
        v_booking.driver_id,
        'Previous active ride was cancelled by admin',
        'Searching for a new driver',
        'Your assigned driver is no longer available. Searching for a new driver now.'
      );
    END IF;
  END IF;

  UPDATE public.bookings
  SET
    status = 'cancelled',
    cancelled_at = now(),
    cancellation_reason = COALESCE(NULLIF(trim(p_reason), ''), 'Cancelled by admin'),
    updated_at = now()
  WHERE id = p_booking_id;

  RETURN jsonb_build_object('success', true, 'message', 'Booking cancelled successfully');
END;
$$;

CREATE OR REPLACE FUNCTION public.find_nearby_drivers(
  pickup_lat decimal,
  pickup_lng decimal,
  radius_km decimal DEFAULT 10,
  required_vehicle_type public.vehicle_type DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  vehicle_type public.vehicle_type,
  vehicle_number varchar,
  vehicle_model varchar,
  rating decimal,
  current_latitude decimal,
  current_longitude decimal,
  distance_km decimal,
  user_name varchar,
  user_phone varchar,
  user_avatar text
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id,
    d.user_id,
    d.vehicle_type,
    d.vehicle_number,
    d.vehicle_model,
    d.rating,
    d.current_latitude,
    d.current_longitude,
    (6371 * acos(
      LEAST(1.0,
        cos(radians(pickup_lat)) * cos(radians(d.current_latitude)) *
        cos(radians(d.current_longitude) - radians(pickup_lng)) +
        sin(radians(pickup_lat)) * sin(radians(d.current_latitude))
      )
    ))::decimal AS distance_km,
    u.name AS user_name,
    u.phone AS user_phone,
    u.avatar_url AS user_avatar
  FROM public.drivers AS d
  JOIN public.users AS u ON d.user_id = u.id
  WHERE d.is_online = true
    AND d.verification_status = 'approved'
    AND d.current_latitude IS NOT NULL
    AND d.current_longitude IS NOT NULL
    AND (required_vehicle_type IS NULL OR d.vehicle_type = required_vehicle_type)
    AND NOT EXISTS (
      SELECT 1
      FROM public.bookings AS bq
      WHERE bq.driver_id = d.id
        AND bq.status = 'queued'
    )
    AND d.current_latitude BETWEEN (pickup_lat - (radius_km / 111.0)) AND (pickup_lat + (radius_km / 111.0))
    AND d.current_longitude BETWEEN (pickup_lng - (radius_km / (111.0 * cos(radians(pickup_lat)))))
                                 AND (pickup_lng + (radius_km / (111.0 * cos(radians(pickup_lat)))))
  HAVING (6371 * acos(
    LEAST(1.0,
      cos(radians(pickup_lat)) * cos(radians(d.current_latitude)) *
      cos(radians(d.current_longitude) - radians(pickup_lng)) +
      sin(radians(pickup_lat)) * sin(radians(d.current_latitude))
    )
  )) <= radius_km
  ORDER BY distance_km ASC, d.rating DESC
  LIMIT 20;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.notify_nearby_drivers()
RETURNS trigger AS $$
DECLARE
  driver_record RECORD;
  notification_count integer := 0;
  max_distance_km numeric;
BEGIN
  IF NEW.status = 'pending'
     AND NEW.driver_id IS NULL
     AND (
       TG_OP = 'INSERT'
       OR OLD.status IS DISTINCT FROM NEW.status
       OR OLD.driver_payout IS DISTINCT FROM NEW.driver_payout
       OR OLD.tip_amount IS DISTINCT FROM NEW.tip_amount
       OR OLD.fare_multiplier IS DISTINCT FROM NEW.fare_multiplier
       OR OLD.expires_at IS DISTINCT FROM NEW.expires_at
     ) THEN
    SELECT COALESCE(driver_search_radius_km, 10)
    INTO max_distance_km
    FROM public.fare_config
    WHERE vehicle_type = NEW.vehicle_type;

    IF max_distance_km IS NULL THEN
      max_distance_km := 10;
    END IF;

    FOR driver_record IN
      SELECT
        d.id AS driver_id,
        d.user_id,
        u.expo_push_token,
        (
          6371 * acos(
            LEAST(1, GREATEST(-1,
              cos(radians(NEW.origin_latitude)) *
              cos(radians(d.current_latitude)) *
              cos(radians(d.current_longitude) - radians(NEW.origin_longitude)) +
              sin(radians(NEW.origin_latitude)) *
              sin(radians(d.current_latitude))
            ))
          )
        ) AS distance_km
      FROM public.drivers AS d
      JOIN public.users AS u ON d.user_id = u.id
      WHERE d.is_online = true
        AND d.verification_status = 'approved'
        AND d.vehicle_type = NEW.vehicle_type
        AND d.current_latitude IS NOT NULL
        AND d.current_longitude IS NOT NULL
        AND u.expo_push_token IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM public.bookings AS bq
          WHERE bq.driver_id = d.id
            AND bq.status = 'queued'
        )
      ORDER BY distance_km ASC
      LIMIT 20
    LOOP
      IF driver_record.distance_km <= max_distance_km THEN
        INSERT INTO public.notifications (
          user_id,
          title,
          body,
          data,
          notification_type,
          is_read
        ) VALUES (
          driver_record.user_id,
          '🚨 New Ride Request!',
          '₹' || COALESCE(NEW.driver_payout, NEW.total_fare) || ' - ' ||
            substring(NEW.origin_address FROM 1 FOR 30) || ' → ' ||
            substring(NEW.destination_address FROM 1 FOR 30),
          jsonb_build_object(
            'booking_id', NEW.id,
            'type', 'new_booking',
            'fare', COALESCE(NEW.driver_payout, NEW.total_fare),
            'distance_km', ROUND(NEW.estimated_distance::numeric, 1),
            'vehicle_type', NEW.vehicle_type,
            'has_tip', COALESCE(NEW.tip_amount, 0) > 0,
            'fare_increased', COALESCE(NEW.fare_multiplier, 1) > 1,
            'is_data_only', true
          ),
          'booking_request',
          false
        );

        notification_count := notification_count + 1;
      END IF;
    END LOOP;

    RAISE NOTICE 'Notified % drivers for booking %', notification_count, NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS notify_drivers_on_booking ON public.bookings;
CREATE TRIGGER notify_drivers_on_booking
  AFTER INSERT OR UPDATE OF status, driver_payout, tip_amount, fare_multiplier, expires_at ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_nearby_drivers();

CREATE OR REPLACE FUNCTION public.notify_customer_on_status_change()
RETURNS trigger AS $$
DECLARE
  notification_title text;
  notification_body text;
  should_notify boolean := true;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    CASE NEW.status
      WHEN 'queued' THEN
        notification_title := 'Driver queued';
        notification_body := 'Your driver is completing a nearby trip. You''re next.';
      WHEN 'accepted' THEN
        notification_title := CASE WHEN OLD.status = 'queued' THEN 'Driver ready' ELSE 'Driver Found!' END;
        notification_body := CASE
          WHEN OLD.status = 'queued' THEN 'Your driver is ready and heading to you now.'
          ELSE 'Your driver is on the way to pick up your goods.'
        END;
      WHEN 'driver_arrived' THEN
        notification_title := 'Driver Arrived';
        notification_body := 'Your driver has arrived at the pickup location. Please hand over the package.';
      WHEN 'in_progress' THEN
        notification_title := 'Shipment Started';
        notification_body := 'Your goods are on the way to ' || COALESCE(NEW.receiver_name, 'the receiver') || '.';
      WHEN 'completed' THEN
        notification_title := 'Delivery Complete!';
        notification_body := 'Your shipment has been delivered successfully. Thank you for using CARTR!';
      WHEN 'cancelled' THEN
        notification_title := 'Booking Cancelled';
        notification_body := COALESCE(NEW.cancellation_reason, 'Your booking has been cancelled.');
      ELSE
        should_notify := false;
    END CASE;

    IF should_notify THEN
      PERFORM public.enqueue_notification(
        NEW.customer_id,
        notification_title,
        notification_body,
        jsonb_build_object(
          'booking_id', NEW.id,
          'type', 'status_update',
          'status', NEW.status,
          'booking_number', NEW.booking_number
        ),
        'booking_update'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP POLICY IF EXISTS "Customers can see assigned drivers" ON public.drivers;
CREATE POLICY "Customers can see assigned drivers" ON public.drivers
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.bookings AS b
      WHERE b.driver_id = public.drivers.id
        AND b.customer_id = auth.uid()
        AND b.status IN ('queued', 'accepted', 'driver_arrived', 'in_progress', 'completed')
    )
  );

DROP POLICY IF EXISTS "Customers can see assigned driver user profile" ON public.users;
CREATE POLICY "Customers can see assigned driver user profile" ON public.users
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.drivers AS d
      JOIN public.bookings AS b ON b.driver_id = d.id
      WHERE d.user_id = public.users.id
        AND b.customer_id = auth.uid()
        AND b.status IN ('queued', 'accepted', 'driver_arrived', 'in_progress', 'completed')
    )
  );
