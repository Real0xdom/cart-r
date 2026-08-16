-- Migration: Add direct push delivery to notify_nearby_drivers trigger
-- This ensures that driver ride request notifications are sent immediately
-- via Expo Push API using pg_net, fixing the issue where closed/killed
-- apps never receive the notification to wake up the background task.

CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.notify_nearby_drivers()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'net'
AS $function$
DECLARE
  driver_record RECORD;
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

    -- Loop through nearby drivers
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
        -- Don't notify if driver already has a queued ride
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
        -- 1. Insert into notifications table for history
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

        -- 2. Build the Expo Push payload for this driver
        IF driver_record.expo_push_token LIKE 'ExponentPushToken[%' THEN
          push_payloads := push_payloads || jsonb_build_object(
            'to', driver_record.expo_push_token,
            'title', '🚨 New Ride Request!',
            'body', 'Tap to review ride details',
            'data', jsonb_build_object(
              'booking_id', NEW.id,
              'type', 'new_booking',
              'is_data_only', true
            ),
            'sound', 'default',
            'priority', 'high',
            'channelId', 'driver_ride_request_urgent',
            '_displayInForeground', true
          );
        END IF;

        notification_count := notification_count + 1;
      END IF;
    END LOOP;

    -- 3. Send the HTTP request to Expo Push API if we have valid tokens
    IF jsonb_array_length(push_payloads) > 0 THEN
      SELECT net.http_post(
          url:='https://exp.host/--/api/v2/push/send',
          headers:='{"Accept": "application/json", "Accept-Encoding": "gzip, deflate", "Content-Type": "application/json"}'::jsonb,
          body:=push_payloads
      ) INTO request_id;
      
      RAISE NOTICE 'Dispatched Expo Push API request % for % drivers. Booking %', request_id, notification_count, NEW.id;
    END IF;

    RAISE NOTICE 'Notified % drivers for booking %', notification_count, NEW.id;
  END IF;

  RETURN NEW;
END;
$function$;
