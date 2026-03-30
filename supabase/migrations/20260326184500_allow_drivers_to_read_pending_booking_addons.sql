-- Drivers can already read pending, unassigned bookings via bookings RLS.
-- This companion policy lets them also read the related booking_addons rows
-- for those visible pending ride requests.

DROP POLICY IF EXISTS "Drivers can view pending booking addons" ON public.booking_addons;

CREATE POLICY "Drivers can view pending booking addons"
ON public.booking_addons
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.bookings b
    JOIN public.drivers d
      ON d.user_id = auth.uid()
    WHERE b.id = booking_addons.booking_id
      AND b.status = 'pending'
      AND b.driver_id IS NULL
      AND d.verification_status = 'approved'
      AND d.is_online = true
  )
);
