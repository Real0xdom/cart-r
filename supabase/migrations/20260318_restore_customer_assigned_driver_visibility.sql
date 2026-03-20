-- Restore customer visibility into the driver assigned to their booking.
-- This is required for the customer app's booking re-hydration query:
-- bookings -> drivers -> users
-- Without these policies the booking can move to "accepted" while the joined
-- driver relation stays null for the customer, leaving the app on the
-- "Finding Driver" screen even though the booking was accepted.

DROP POLICY IF EXISTS "Customers can see assigned drivers" ON public.drivers;
CREATE POLICY "Customers can see assigned drivers" ON public.drivers
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.bookings b
      WHERE b.driver_id = public.drivers.id
        AND b.customer_id = auth.uid()
        AND b.status IN ('accepted', 'driver_arrived', 'in_progress', 'completed')
    )
  );

DROP POLICY IF EXISTS "Customers can see assigned driver user profile" ON public.users;
CREATE POLICY "Customers can see assigned driver user profile" ON public.users
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.drivers d
      JOIN public.bookings b ON b.driver_id = d.id
      WHERE d.user_id = public.users.id
        AND b.customer_id = auth.uid()
        AND b.status IN ('accepted', 'driver_arrived', 'in_progress', 'completed')
    )
  );
