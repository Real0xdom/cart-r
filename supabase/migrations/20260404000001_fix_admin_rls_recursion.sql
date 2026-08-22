-- 1. Create a SECURITY DEFINER function to safely check for admin privileges 
-- without triggering Row Level Security (RLS) policies on the users table.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admins
    WHERE id = auth.uid()
  );
$$;

-- 2. Fix the "Admins can view all users" policy on public.users
DROP POLICY IF EXISTS "Admins can view all users" ON public.users;
CREATE POLICY "Admins can view all users" ON public.users
  FOR SELECT TO authenticated USING (public.is_admin());

-- 3. Fix the "Only admins can modify service areas" policy on public.service_areas
DROP POLICY IF EXISTS "Only admins can modify service areas" ON public.service_areas;
CREATE POLICY "Only admins can modify service areas" ON public.service_areas
  FOR ALL TO authenticated USING (public.is_admin());

-- 4. Fix the "Admins can view all expansion interests" policy on public.expansion_interests
DROP POLICY IF EXISTS "Admins can view all expansion interests" ON public.expansion_interests;
CREATE POLICY "Admins can view all expansion interests" ON public.expansion_interests
  FOR SELECT TO authenticated USING (public.is_admin());
