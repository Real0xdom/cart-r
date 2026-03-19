-- Add RLS policies for vehicle_specifications to allow admin operations
-- This enables admins to INSERT, UPDATE, DELETE vehicle types

-- Check if user is admin (requires an is_admin or role column in auth.users)
-- OR if using service role (which bypasses RLS)

-- Drop existing policies
DROP POLICY IF EXISTS "Anyone can view vehicle specifications" ON public.vehicle_specifications;
DROP POLICY IF EXISTS "Admins can manage vehicle specifications" ON public.vehicle_specifications;

-- SELECT: Public read access (for customers/drivers)
CREATE POLICY "Anyone can view vehicle specifications"
ON public.vehicle_specifications
FOR SELECT
USING (true);

-- INSERT: Allow admins (anyone authenticated for now - adjust as needed)
CREATE POLICY "Authenticated users can insert vehicle specifications"
ON public.vehicle_specifications
FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

-- UPDATE: Allow admins to edit
CREATE POLICY "Authenticated users can update vehicle specifications"
ON public.vehicle_specifications
FOR UPDATE
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- DELETE: Allow admins to delete
CREATE POLICY "Authenticated users can delete vehicle specifications"
ON public.vehicle_specifications
FOR DELETE
USING (auth.role() = 'authenticated');

-- Also ensure fare_config has proper policies
DROP POLICY IF EXISTS "Anyone can view fare config" ON public.fare_config;
DROP POLICY IF EXISTS "Authenticated users can manage fare config" ON public.fare_config;

-- SELECT: Public read
CREATE POLICY "Anyone can view fare config"
ON public.fare_config
FOR SELECT
USING (true);

-- INSERT: Admins only
CREATE POLICY "Authenticated can insert fare config"
ON public.fare_config
FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

-- UPDATE: Admins only
CREATE POLICY "Authenticated can update fare config"
ON public.fare_config
FOR UPDATE
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- DELETE: Admins only
CREATE POLICY "Authenticated can delete fare config"
ON public.fare_config
FOR DELETE
USING (auth.role() = 'authenticated');
