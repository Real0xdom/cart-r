-- Migration: 044_fix_notification_triggers_security.sql
-- Purpose: Fix "new row violates row level security" error on notifications table
-- by adding SECURITY DEFINER to trigger functions that insert into notifications.
-- This allows customers to indirectly create notifications when updating their bookings.

-- 1. Fix notify_customer_on_status_change
CREATE OR REPLACE FUNCTION notify_customer_on_status_change()
RETURNS TRIGGER AS $$
DECLARE
  notification_title TEXT;
  notification_body TEXT;
  should_notify BOOLEAN := true;
BEGIN
  -- Only trigger on status changes
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    
    -- Determine notification content based on status
    CASE NEW.status
      WHEN 'accepted' THEN
        notification_title := '✅ Driver Found!';
        notification_body := 'Your driver is on the way to pick up your goods.';
      WHEN 'driver_arrived' THEN
        notification_title := '📍 Driver Arrived';
        notification_body := 'Your driver has arrived at the pickup location. Please hand over the package.';
      WHEN 'in_progress' THEN
        notification_title := '🚚 Shipment Started';
        notification_body := 'Your goods are on the way to ' || COALESCE(NEW.receiver_name, 'the receiver') || '.';
      WHEN 'completed' THEN
        notification_title := '🎉 Delivery Complete!';
        notification_body := 'Your shipment has been delivered successfully. Thank you for using CARTR!';
      WHEN 'cancelled' THEN
        notification_title := '❌ Booking Cancelled';
        notification_body := COALESCE(NEW.cancellation_reason, 'Your booking has been cancelled.');
      ELSE
        should_notify := false;
    END CASE;
    
    IF should_notify THEN
      -- Insert notification record
      INSERT INTO public.notifications (
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
          'status', NEW.status,
          'booking_number', NEW.booking_number
        ),
        'booking_update',
        false
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Fix notify_nearby_drivers
CREATE OR REPLACE FUNCTION public.notify_nearby_drivers()
RETURNS TRIGGER AS $$
DECLARE
  driver_record RECORD;
  notification_count INTEGER := 0;
  max_distance_km NUMERIC;
  driver_distance_km NUMERIC;
BEGIN
  -- Only trigger on new pending bookings
  IF NEW.status = 'pending' THEN
    -- Get radius from fare_config for this vehicle type
    SELECT COALESCE(driver_search_radius_km, 10) INTO max_distance_km
    FROM public.fare_config
    WHERE vehicle_type = NEW.vehicle_type;
    
    IF max_distance_km IS NULL THEN
      max_distance_km := 10; -- Default fallback
    END IF;
    
    -- Find all online, APPROVED drivers with matching vehicle type
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
            LEAST(1, GREATEST(-1, -- Clamp to avoid NaN from floating point errors
              cos(radians(NEW.origin_latitude)) * 
              cos(radians(d.current_latitude)) * 
              cos(radians(d.current_longitude) - radians(NEW.origin_longitude)) + 
              sin(radians(NEW.origin_latitude)) * 
              sin(radians(d.current_latitude))
            ))
          )
        ) as distance_km
      FROM public.drivers d
      JOIN public.users u ON d.user_id = u.id
      WHERE d.is_online = true
        AND d.verification_status = 'approved'
        AND d.vehicle_type = NEW.vehicle_type
        AND d.current_latitude IS NOT NULL
        AND d.current_longitude IS NOT NULL
        AND u.expo_push_token IS NOT NULL
      ORDER BY distance_km ASC
      LIMIT 20 -- Notify max 20 nearby drivers
    LOOP
      -- Only notify if within max distance
      IF driver_record.distance_km <= max_distance_km THEN
        -- Insert notification record
        INSERT INTO public.notifications (
          user_id,
          title,
          body,
          data,
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

-- 3. Fix notify_receiver_delivery_otp
CREATE OR REPLACE FUNCTION notify_receiver_delivery_otp()
RETURNS TRIGGER AS $$
DECLARE
  notification_body TEXT;
BEGIN
  -- Only trigger when status changes to 'in_progress' 
  -- AND delivery_otp exists AND receiver details exist
  IF OLD.status IS DISTINCT FROM NEW.status 
     AND NEW.status = 'in_progress' 
     AND NEW.delivery_otp IS NOT NULL
     AND NEW.receiver_phone IS NOT NULL THEN
    
    notification_body := 'Your delivery OTP is: ' || NEW.delivery_otp || '. Please share this with the driver upon delivery.';
    
    -- Insert notification for the CUSTOMER (sender) to share with receiver
    INSERT INTO public.notifications (
      user_id,
      title,
      body,
      data,
      notification_type,
      is_read
    ) VALUES (
      NEW.customer_id,
      '📦 Delivery OTP Generated',
      'Share OTP ' || NEW.delivery_otp || ' with ' || COALESCE(NEW.receiver_name, 'the receiver') || ' at ' || NEW.receiver_phone || ' for delivery confirmation.',
      jsonb_build_object(
        'booking_id', NEW.id,
        'type', 'delivery_otp',
        'delivery_otp', NEW.delivery_otp,
        'receiver_name', NEW.receiver_name,
        'receiver_phone', NEW.receiver_phone,
        'booking_number', NEW.booking_number
      ),
      'delivery_otp',
      false
    );
    
    RAISE NOTICE 'Delivery OTP notification created for booking %', NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Note: notify_on_booking_completion already had SECURITY DEFINER in 025, but we don't need to touch it if it's already working.
-- If search_path needs to be set there too, we could add it, but the others are the primary culprits for user-triggered actions.

SELECT 'Migration 044_fix_notification_triggers_security completed successfully' as result;
