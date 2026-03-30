-- Migration: 0116_fix_delivery_otp_sms_trigger.sql
-- Purpose: Fix SMS OTP delivery — ensure SMS is sent whenever OTP is generated/regenerated
-- Root causes found:
--   1. bookings_delivery_otp BEFORE INSERT trigger auto-generates OTP at creation,
--      so initiate_delivery_otp returns existing without UPDATE → no SMS trigger fires
--   2. queue_delivery_otp_sms only fired during 'in_progress' status transitions
--   3. process_sms_queue trigger on sms_queue may not be invoking edge function
--   4. Phone stored with +91 prefix — now storing clean 10-digit number

-- ============================================================
-- 1. DROP the bookings_delivery_otp BEFORE INSERT trigger
--    OTP generation is now DEFERRED to initiate_delivery_otp RPC
-- ============================================================
DROP TRIGGER IF EXISTS bookings_delivery_otp ON bookings;

-- ============================================================
-- 2. Fix queue_delivery_otp_sms — fire whenever delivery_otp changes
--    No longer restricted to 'in_progress' status
-- ============================================================
CREATE OR REPLACE FUNCTION queue_delivery_otp_sms()
RETURNS TRIGGER AS $$
DECLARE
  sms_message TEXT;
  clean_phone TEXT;
BEGIN
  -- Fire whenever delivery_otp changes (set first time OR regenerated)
  IF (OLD.delivery_otp IS DISTINCT FROM NEW.delivery_otp AND NEW.delivery_otp IS NOT NULL)
  THEN
    IF NEW.receiver_phone IS NOT NULL AND LENGTH(TRIM(NEW.receiver_phone)) >= 10 THEN
       -- Clean phone: strip everything except digits, take last 10
       clean_phone := RIGHT(REGEXP_REPLACE(TRIM(NEW.receiver_phone), '[^0-9]', '', 'g'), 10);

       -- Short OTP-style message (high delivery rate, bypasses DND filters)
       sms_message := NEW.delivery_otp || ' is your Cartr delivery code.';

       -- Delete any previous pending SMS for this booking to avoid duplicates
       DELETE FROM sms_queue
       WHERE booking_id = NEW.id
       AND status = 'pending';

       -- Queue the SMS with clean 10-digit phone number
       INSERT INTO sms_queue (phone_number, message, booking_id, status, created_at, purpose)
       VALUES (
         clean_phone,
         sms_message,
         NEW.id,
         'pending',
         NOW(),
         'delivery_otp'
       );

       RAISE NOTICE 'Delivery OTP SMS queued for phone % (booking %)', clean_phone, NEW.id;
    ELSE
       RAISE NOTICE 'No valid receiver_phone for booking %, skipping SMS', NEW.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
DROP TRIGGER IF EXISTS queue_delivery_otp_sms_trigger ON bookings;
CREATE TRIGGER queue_delivery_otp_sms_trigger
  AFTER UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION queue_delivery_otp_sms();

-- ============================================================
-- 3. Ensure process_sms_queue trigger exists on sms_queue
-- ============================================================
CREATE OR REPLACE FUNCTION process_sms_queue()
RETURNS TRIGGER AS $$
DECLARE
  request_id BIGINT;
BEGIN
  IF NEW.status = 'pending' THEN
     SELECT net.http_post(
         url := 'https://epevjbiymsvwmmzybzib.supabase.co/functions/v1/send-sms',
         headers := jsonb_build_object(
             'Content-Type', 'application/json',
             'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVwZXZqYml5bXN2d21tenliemliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyMjQyODAsImV4cCI6MjA3NzgwMDI4MH0.TTO9koYOJFjjFNMc7g9_blvnpcM_QIb0Zwj13hW0NXI'
         )
     ) INTO request_id;
     RAISE NOTICE 'Triggered send-sms edge function (Request ID: %). SMS ID: %', request_id, NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Ensure the trigger on sms_queue exists
DROP TRIGGER IF EXISTS sms_queue_notify_trigger ON sms_queue;
CREATE TRIGGER sms_queue_notify_trigger
  AFTER INSERT ON sms_queue
  FOR EACH ROW
  EXECUTE FUNCTION process_sms_queue();

-- ============================================================
-- 4. Clean up stale pending entries (before the fix)
-- ============================================================
UPDATE sms_queue
SET status = 'failed', error_message = 'Cleaned up by migration 0116 — stale pending entry'
WHERE status = 'pending' AND attempts = 0;
