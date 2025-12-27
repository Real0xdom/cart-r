-- Migration: 006_notify_drivers_trigger.sql
-- Purpose: Create function and trigger to notify nearby drivers on new booking

-- =====================================================
-- FUNCTION: Notify nearby drivers when booking is created
-- =====================================================
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
        -- Insert notification record (the send-notification function will be called via webhook)
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
            'fare_increased', COALESCE(NEW.fare_multiplier, 1) > 1
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

-- =====================================================
-- TRIGGER: Execute on new booking insert
-- =====================================================
DROP TRIGGER IF EXISTS notify_drivers_on_booking ON bookings;
CREATE TRIGGER notify_drivers_on_booking
  AFTER INSERT ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION notify_nearby_drivers();

-- =====================================================
-- FUNCTION: Notify customer on booking status change
-- =====================================================
CREATE OR REPLACE FUNCTION notify_customer_on_status_change()
RETURNS TRIGGER AS $$
DECLARE
  customer_token TEXT;
  notification_title TEXT;
  notification_body TEXT;
BEGIN
  -- Only trigger on status changes
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Get customer push token
    SELECT expo_push_token INTO customer_token
    FROM users
    WHERE id = NEW.customer_id;
    
    -- Skip if no push token
    IF customer_token IS NULL THEN
      RETURN NEW;
    END IF;
    
    -- Determine notification content based on status
    CASE NEW.status
      WHEN 'accepted' THEN
        notification_title := '✅ Driver Found!';
        notification_body := 'Your driver is on the way to pick up your goods.';
      WHEN 'driver_arrived' THEN
        notification_title := '📍 Driver Arrived';
        notification_body := 'Your driver has arrived at the pickup location.';
      WHEN 'in_progress' THEN
        notification_title := '🚚 Shipment Started';
        notification_body := 'Your goods are on the way to the destination.';
      WHEN 'completed' THEN
        notification_title := '🎉 Delivery Complete!';
        notification_body := 'Your shipment has been delivered successfully.';
      WHEN 'cancelled' THEN
        notification_title := '❌ Booking Cancelled';
        notification_body := COALESCE(NEW.cancellation_reason, 'Your booking has been cancelled.');
      ELSE
        RETURN NEW;
    END CASE;
    
    -- Insert notification record
    INSERT INTO notifications (
      user_id,
      title,
      body,
      data,
      notification_type,
      is_read
    ) VALUES (
      NEW.customer_id,
      notification_title,
      notification_body,
      jsonb_build_object(
        'booking_id', NEW.id,
        'type', 'status_update',
        'status', NEW.status
      ),
      'booking_update',
      false
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRIGGER: Execute on booking status update
-- =====================================================
DROP TRIGGER IF EXISTS notify_customer_on_booking_update ON bookings;
CREATE TRIGGER notify_customer_on_booking_update
  AFTER UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION notify_customer_on_status_change();
