-- Migration: 0115_finalize_delivery_otp_robust.sql
-- Purpose: Finalize robust Indian SMS delivery with short format and fixed headers

-- 1. Update queue_delivery_otp_sms with Short Format and In-Progress logic
CREATE OR REPLACE FUNCTION queue_delivery_otp_sms()
RETURNS TRIGGER AS $$
DECLARE
  sms_message TEXT;
BEGIN
  -- Send SMS ONLY when status becomes 'in_progress' OR when OTP is refreshed while 'in_progress'
  IF (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'in_progress' AND NEW.delivery_otp IS NOT NULL)
     OR (NEW.status = 'in_progress' AND OLD.delivery_otp IS DISTINCT FROM NEW.delivery_otp AND NEW.delivery_otp IS NOT NULL)
  THEN
    IF NEW.receiver_phone IS NOT NULL THEN
       -- ROBUST SHORT FORMAT: Similar to Auth OTP for high delivery rates
       sms_message := NEW.delivery_otp || ' is your Cartr delivery OTP. Share this with the driver. Valid for this trip only.';
       
       INSERT INTO sms_queue (phone_number, message, booking_id, status, created_at, purpose)
       VALUES (
         '+91' || NEW.receiver_phone,
         sms_message,
         NEW.id,
         'pending',
         NOW(),
         'general'
       );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Sync process_sms_queue with Fixed URL and Header
-- (Using the confirmed working project URL and Anon key)
CREATE OR REPLACE FUNCTION process_sms_queue()
RETURNS TRIGGER AS $$
DECLARE
  request_id BIGINT;
BEGIN
  IF NEW.status = 'pending' THEN
     -- Force call to edge function via pg_net
     SELECT net.http_post(
         url := 'https://epevjbiymsvwmmzybzib.supabase.co/functions/v1/send-sms',
         headers := jsonb_build_object(
             'Content-Type', 'application/json',
             'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVwZXZqYml5bXN2d21tenliemliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyMjQyODAsImV4cCI6MjA3NzgwMDI4MH0.TTO9koYOJFjjFNMc7g9_blvnpcM_QIb0Zwj13hW0NXI'
         )
     ) INTO request_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
