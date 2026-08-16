-- Reduce duplicate notification delivery across direct push, queued push,
-- and legacy completion triggers.

CREATE OR REPLACE FUNCTION public.notify_nearby_drivers()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'net'
AS $function$
DECLARE
  driver_record RECORD;
  driver_push_token text;
  notification_count integer := 0;
  max_distance_km numeric;
  push_payloads jsonb := '[]'::jsonb;
  request_id bigint;
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
        driver_tokens.tokens AS expo_push_tokens,
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
      LEFT JOIN LATERAL (
        SELECT array_agg(DISTINCT pt.token ORDER BY pt.token) AS tokens
        FROM public.push_tokens AS pt
        WHERE pt.user_id = d.user_id
          AND pt.is_active = true
          AND pt.app_type = 'driver'
          AND pt.token IS NOT NULL
      ) AS driver_tokens ON true
      WHERE d.is_online = true
        AND d.verification_status = 'approved'
        AND d.vehicle_type = NEW.vehicle_type
        AND d.current_latitude IS NOT NULL
        AND d.current_longitude IS NOT NULL
        AND array_length(driver_tokens.tokens, 1) > 0
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
          is_read,
          processed_at
        ) VALUES (
          driver_record.user_id,
          'New Ride Request!',
          'Rs ' || COALESCE(NEW.driver_payout, NEW.total_fare) || ' - ' ||
            substring(NEW.origin_address FROM 1 FOR 30) || ' -> ' ||
            substring(NEW.destination_address FROM 1 FOR 30),
          jsonb_build_object(
            'booking_id', NEW.id,
            'type', 'new_booking',
            'fare', COALESCE(NEW.driver_payout, NEW.total_fare),
            'distance_km', ROUND(NEW.estimated_distance::numeric, 1),
            'vehicle_type', NEW.vehicle_type,
            'has_tip', COALESCE(NEW.tip_amount, 0) > 0,
            'fare_increased', COALESCE(NEW.fare_multiplier, 1) > 1,
            'is_data_only', true,
            'target_app', 'driver',
            'delivery_mode', 'direct'
          ),
          'booking_request',
          false,
          now()
        );

        IF driver_record.expo_push_tokens IS NOT NULL THEN
          FOREACH driver_push_token IN ARRAY driver_record.expo_push_tokens
          LOOP
            IF driver_push_token LIKE 'ExponentPushToken[%' THEN
              push_payloads := push_payloads || jsonb_build_object(
                'to', driver_push_token,
                'title', 'New Ride Request!',
                'body', 'Tap to review ride details',
                'data', jsonb_build_object(
                  'booking_id', NEW.id,
                  'type', 'new_booking',
                  'is_data_only', true,
                  'target_app', 'driver',
                  'delivery_mode', 'direct'
                ),
                'sound', 'default',
                'priority', 'high',
                'channelId', 'driver_ride_request_urgent',
                '_displayInForeground', true
              );
            END IF;
          END LOOP;
        END IF;

        notification_count := notification_count + 1;
      END IF;
    END LOOP;

    IF jsonb_array_length(push_payloads) > 0 THEN
      SELECT net.http_post(
        url := 'https://exp.host/--/api/v2/push/send',
        headers := '{"Accept":"application/json","Accept-Encoding":"gzip, deflate","Content-Type":"application/json"}'::jsonb,
        body := push_payloads
      ) INTO request_id;

      RAISE NOTICE 'Dispatched Expo Push API request % for booking %', request_id, NEW.id;
    END IF;

    RAISE NOTICE 'Notified % drivers for booking %', notification_count, NEW.id;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_on_booking_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
    driver_user_id uuid;
BEGIN
    IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
        SELECT user_id INTO driver_user_id
        FROM public.drivers
        WHERE id = NEW.driver_id;

        IF driver_user_id IS NOT NULL THEN
            INSERT INTO public.notifications (
                user_id,
                title,
                body,
                data,
                notification_type,
                is_read
            )
            VALUES (
                driver_user_id,
                'Trip Completed',
                'You earned Rs ' || COALESCE(NEW.driver_payout, NEW.total_fare, 0)::text || ' for trip ' || NEW.booking_number,
                jsonb_build_object(
                  'booking_id', NEW.id,
                  'type', 'trip_completed',
                  'status', NEW.status,
                  'booking_number', NEW.booking_number,
                  'target_app', 'driver'
                ),
                'trip_completed',
                false
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$function$;
