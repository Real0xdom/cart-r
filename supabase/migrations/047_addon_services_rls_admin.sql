-- Add RLS policies for addon_services to allow admin insert/update/delete
-- Without these, "Add Addon" in admin fails with row-level security violation

-- INSERT: Allow authenticated users (admin app) to create addon services
CREATE POLICY "Authenticated users can insert addon services"
ON public.addon_services
FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

-- UPDATE: Allow authenticated users to update addon services
CREATE POLICY "Authenticated users can update addon services"
ON public.addon_services
FOR UPDATE
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- DELETE: Allow authenticated users to delete addon services
CREATE POLICY "Authenticated users can delete addon services"
ON public.addon_services
FOR DELETE
USING (auth.role() = 'authenticated');
