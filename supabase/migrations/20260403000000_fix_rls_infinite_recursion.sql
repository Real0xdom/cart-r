-- Fix infinite recursion in RLS policies

-- 1. Helper for drivers reading their own profile/bookings
CREATE OR REPLACE FUNCTION public.get_driver_id_by_user(uid uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id FROM public.drivers WHERE user_id = uid LIMIT 1;
$$;

-- 2. Helper for customers seeing their assigned drivers
CREATE OR REPLACE FUNCTION public.customer_has_active_booking_with_driver(c_uid uuid, d_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.bookings
    WHERE customer_id = c_uid
      AND driver_id = d_id
      AND status IN ('queued', 'accepted', 'driver_arrived', 'in_progress', 'completed')
  );
$$;

-- 3. Helper for customers seeing their assigned driver's user profile
CREATE OR REPLACE FUNCTION public.customer_has_active_booking_with_driver_user(c_uid uuid, d_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.bookings b
    JOIN public.drivers d ON b.driver_id = d.id
    WHERE b.customer_id = c_uid
      AND d.user_id = d_user_id
      AND b.status IN ('queued', 'accepted', 'driver_arrived', 'in_progress', 'completed')
  );
$$;


-- Update Bookings policies
DROP POLICY IF EXISTS "Drivers can read assigned bookings" ON bookings;
CREATE POLICY "Drivers can read assigned bookings" ON bookings
  FOR SELECT USING (
    driver_id = public.get_driver_id_by_user(auth.uid())
  );

DROP POLICY IF EXISTS "Drivers can update assigned bookings" ON bookings;
CREATE POLICY "Drivers can update assigned bookings" ON bookings
  FOR UPDATE USING (
    driver_id = public.get_driver_id_by_user(auth.uid())
  );

-- Update Drivers policies
DROP POLICY IF EXISTS "Customers can see assigned drivers" ON public.drivers;
CREATE POLICY "Customers can see assigned drivers" ON public.drivers
  FOR SELECT TO authenticated USING (
    public.customer_has_active_booking_with_driver(auth.uid(), id)
  );

-- Update Users policies
DROP POLICY IF EXISTS "Customers can see assigned driver user profile" ON public.users;
CREATE POLICY "Customers can see assigned driver user profile" ON public.users
  FOR SELECT TO authenticated USING (
    public.customer_has_active_booking_with_driver_user(auth.uid(), id)
  );
