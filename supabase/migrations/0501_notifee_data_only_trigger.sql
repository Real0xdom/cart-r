-- Migration: 050_notifee_data_only_trigger.sql
-- Purpose: Update notify_nearby_drivers function to include is_data_only flag for true headless background pushes

CREATE OR REPLACE FUNCTION notify_nearby_drivers()
RETURNS TRIGGER AS $$
DECLARE
  driver_record RECORD;
  notification_count INTEGER := 0;
  max_distance_km NUMERIC := 10; -- Maximum distance to notify drivers
  driver_distance_km NUMERIC;
BEGIN
  -- Only trigger on new pending bookings
  IF NEW.status = 'pending' THEN
    -- Find all online drivers with matching vehicle type
    FOR driver_record IN
      SELECT 
        d.id as driver_id,
        d.user_id,
        u.expo_push_token,
        d.current_latitude,
        d.current_longitude,
        -- Calculate distance using Haversine formula
        (
          6371 * acos(
            cos(radians(NEW.origin_latitude)) * 
            cos(radians(d.current_latitude)) * 
            cos(radians(d.current_longitude) - radians(NEW.origin_longitude)) + 
            sin(radians(NEW.origin_latitude)) * 
            sin(radians(d.current_latitude))
          )
        ) as distance_km
      FROM drivers d
      JOIN users u ON d.user_id = u.id
      WHERE d.is_online = true
        AND d.is_verified = true
        AND d.vehicle_type = NEW.vehicle_type
        AND d.current_latitude IS NOT NULL
        AND d.current_longitude IS NOT NULL
        AND u.expo_push_token IS NOT NULL
      ORDER BY distance_km ASC
      LIMIT 20 -- Notify max 20 nearby drivers
    LOOP
      -- Only notify if within max distance
      IF driver_record.distance_km <= max_distance_km THEN
        -- Insert notification record (the process-notifications edge function will poll this)
        INSERT INTO notifications (
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
            SUBSTRING(NEW.origin_address FROM 1 FOR 30) || ' → ' || 
            SUBSTRING(NEW.destination_address FROM 1 FOR 30),
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
$$ LANGUAGE plpgsql;
