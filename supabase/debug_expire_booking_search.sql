-- Debug script: safely simulate the timeout refund path for one expired booking.
-- Replace the UUIDs before running in Supabase SQL editor.
-- This calls the same RPC the app now uses on timeout.

SELECT public.expire_booking_search(
  '00000000-0000-0000-0000-000000000000'::uuid, -- booking_id
  '00000000-0000-0000-0000-000000000000'::uuid  -- customer_id
);

