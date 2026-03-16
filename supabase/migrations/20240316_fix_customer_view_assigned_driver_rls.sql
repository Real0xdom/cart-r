-- Migration: fix_customer_view_assigned_driver_rls.sql
-- Purpose: Allow customers to read the profile of the driver assigned to their active booking.
-- Without this, customers cannot see driver details (name, model, rating) until the driver 
-- is explicitly "online", which might fail during active rides or due to strict policies.
-- This also fixes the issue where the customer app stays in "Searching" state because it
-- can't read the assigned driver's profile immediately after acceptance.

-- 1. Update DRIVERS table policies
DROP POLICY IF EXISTS "Customers can see assigned drivers" ON public.drivers;
CREATE POLICY "Customers can see assigned drivers" ON public.drivers
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.driver_id = public.drivers.id
      AND b.customer_id = auth.uid()
      AND b.status IN ('accepted', 'driver_arrived', 'in_progress', 'completed')
    )
  );

-- 2. Update USERS table policies
-- Customers need to see the driver's user profile (name, phone, avatar) to show the driver card.
DROP POLICY IF EXISTS "Customers can see assigned driver user profile" ON public.users;
CREATE POLICY "Customers can see assigned driver user profile" ON public.users
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.drivers d
      JOIN public.bookings b ON b.driver_id = d.id
      WHERE d.user_id = public.users.id
      AND b.customer_id = auth.uid()
      AND b.status IN ('accepted', 'driver_arrived', 'in_progress', 'completed')
    )
  );

-- 3. Verify driver_locations policy (already exists but ensure it's correct)
-- It already exists in 004 but we'll ensure it covers 'completed' for final tracking/receipts
DROP POLICY IF EXISTS "Customers can read driver location during trip" ON public.driver_locations;
CREATE POLICY "Customers can read driver location during trip" ON public.driver_locations
  FOR SELECT
  TO authenticated
  USING (
    driver_id IN (
      SELECT driver_id FROM public.bookings 
      WHERE customer_id = auth.uid() 
      AND status IN ('accepted', 'driver_arrived', 'in_progress', 'completed')
    )
  );
