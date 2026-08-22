-- FINAL PRODUCTION READINESS SETUP
-- 1. FIX DRIVER NOTIFICATION TRIGGER (To support Scheduled Bookings)
-- This updates the trigger to also run when a booking is UPDATED to 'pending'
-- This is critical for scheduled rides moving from 'scheduled' -> 'pending'

-- Drop the old combined trigger if it tried to create
DROP TRIGGER IF EXISTS notify_drivers_on_booking ON bookings;
DROP TRIGGER IF EXISTS notify_drivers_on_booking_insert ON bookings;
DROP TRIGGER IF EXISTS notify_drivers_on_booking_update ON bookings;

-- Handle NEW bookings that start as pending
CREATE TRIGGER notify_drivers_on_booking_insert
AFTER INSERT ON bookings
FOR EACH ROW
WHEN (NEW.status = 'pending')
EXECUTE FUNCTION notify_nearby_drivers();

-- Handle SCHEDULED bookings that are UPDATED to pending
CREATE TRIGGER notify_drivers_on_booking_update
AFTER UPDATE OF status ON bookings
FOR EACH ROW
WHEN (NEW.status = 'pending' AND OLD.status != 'pending')
EXECUTE FUNCTION notify_nearby_drivers();


-- 2. SETUP DRIVER DOCUMENT STORAGE BUCKET
-- This creates the bucket and sets up security policies for driver onboarding

-- Create the bucket
insert into storage.buckets (id, name, public) 
values ('driver-documents', 'driver-documents', true)
on conflict (id) do nothing;

-- NOTE: RLS is enabled by default on storage.objects in Supabase.
-- Attempting to "ALTER TABLE" it causes ownership errors. 
-- We only need to create the policies.

-- Policy 1: Anyone can view driver documents via public URL
DROP POLICY IF EXISTS "Anyone can view driver documents" ON storage.objects;
create policy "Anyone can view driver documents"
on storage.objects for select
to public
using ( bucket_id = 'driver-documents' );

-- Policy 2: Drivers can upload their own documents (authenticated only)
DROP POLICY IF EXISTS "Drivers can upload documents" ON storage.objects;
create policy "Drivers can upload documents"
on storage.objects for insert
to authenticated
with check ( bucket_id = 'driver-documents' );

-- Policy 3: Drivers can manage (update/delete) their own documents
DROP POLICY IF EXISTS "Drivers can manage their own documents" ON storage.objects;
create policy "Drivers can manage their own documents"
on storage.objects for all
to authenticated
using ( bucket_id = 'driver-documents' AND (auth.uid()::text = (storage.foldername(name))[1]) );
