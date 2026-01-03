-- Migration: 013_fix_rls_and_notifications.sql
-- Purpose: Fix two critical bugs:
--   1. RLS policy preventing customers from cancelling bookings
--   2. notify_nearby_drivers() using non-existent is_verified column

-- =====================================================
-- FIX 1: RLS POLICY FOR BOOKING CANCELLATION
-- =====================================================
-- The current "Customers can update own bookings" policy is too restrictive.
-- We need to allow customers to cancel their own bookings.

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Customers can update own bookings" ON public.bookings;

-- Create a more permissive update policy for customers
-- They can update their own bookings if:
-- 1. The booking belongs to them (customer_id = auth.uid())
-- 2. The booking is in a cancellable state (pending or accepted)
CREATE POLICY "Customers can update own bookings" ON public.bookings
  FOR UPDATE 
  USING (customer_id = auth.uid())
  WITH CHECK (
    customer_id = auth.uid() 
    AND (
      -- Allow updates while pending/accepted (normal flow)
      status IN ('pending', 'accepted')
      -- OR allow cancellation (setting status to cancelled)
      OR status = 'cancelled'
    )
  );

-- =====================================================
-- FIX 2: DRIVER NOTIFICATION TRIGGER
-- =====================================================
-- The notify_nearby_drivers() function incorrectly uses 
-- d.is_verified = true instead of d.verification_status = 'approved'

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
    -- FIX: Changed d.is_verified = true to d.verification_status = 'approved'
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
        AND d.verification_status = 'approved'  -- FIXED: was d.is_verified = true
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
$$ LANGUAGE plpgsql;

-- Recreate the trigger to use the updated function
DROP TRIGGER IF EXISTS notify_drivers_on_booking ON public.bookings;
CREATE TRIGGER notify_drivers_on_booking
  AFTER INSERT ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_nearby_drivers();

-- =====================================================
-- FIX 3: RLS POLICY FOR DRIVERS TO READ PENDING BOOKINGS
-- =====================================================
-- Drivers need to read pending bookings to see available ride requests!
-- Without this policy, drivers cannot query for pending bookings to accept.

DROP POLICY IF EXISTS "Drivers can read pending bookings" ON public.bookings;
CREATE POLICY "Drivers can read pending bookings" ON public.bookings
  FOR SELECT 
  USING (
    -- Allow reading if the booking is pending and unassigned
    status = 'pending'
    AND driver_id IS NULL
    -- And the current user is an approved, online driver
    AND EXISTS (
      SELECT 1 FROM public.drivers d
      WHERE d.user_id = auth.uid()
        AND d.verification_status = 'approved'
        AND d.is_online = true
    )
  );

-- =====================================================
-- VERIFICATION QUERIES (run these to check driver setup)
-- =====================================================
-- Uncomment and run these to debug:

-- Check if drivers are properly set up:
-- SELECT d.id, d.user_id, d.vehicle_type, d.is_online, d.verification_status,
--        d.current_latitude, d.current_longitude, u.expo_push_token
-- FROM drivers d
-- JOIN users u ON d.user_id = u.id
-- WHERE d.is_online = true;

-- Check if any drivers match the criteria:
-- SELECT d.id, d.user_id, d.vehicle_type, d.is_online, d.verification_status,
--        d.current_latitude IS NOT NULL as has_lat,
--        d.current_longitude IS NOT NULL as has_lng,
--        u.expo_push_token IS NOT NULL as has_push_token
-- FROM drivers d
-- JOIN users u ON d.user_id = u.id
-- WHERE d.is_online = true AND d.verification_status = 'approved';

SELECT 'Migration 013_fix_rls_and_notifications completed successfully' as result;
