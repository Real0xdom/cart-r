-- Migration: 011_auto_sms_queue_processing.sql
-- Purpose: Automatically process SMS queue when new entries are added

-- Enable the pg_net extension to make HTTP requests
CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA extensions;

-- =====================================================
-- Create function to invoke send-sms edge function
-- =====================================================
CREATE OR REPLACE FUNCTION process_sms_queue()
RETURNS TRIGGER AS $$
DECLARE
  request_id BIGINT;
BEGIN
  -- Only process if status is 'pending'
  IF NEW.status = 'pending' THEN
    
    -- Invoke Edge Function using pg_net
    -- Note: You MUST replace PROJECT_REF with your actual Supabase project reference
    -- or use the internal Kong URL if running locally/on-platform
    
    -- Using the public URL structure: https://<project_ref>.supabase.co/functions/v1/send-sms
    
    -- For local development/testing, we just log.
    -- In production, this should be:
     SELECT net.http_post(
         url := 'https://' || current_setting('app.settings.project_ref', true) || '.supabase.co/functions/v1/send-sms',
         headers := jsonb_build_object(
             'Content-Type', 'application/json',
             'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
         )
     ) INTO request_id;

    RAISE NOTICE 'Triggered send-sms edge function via pg_net (Request ID: %). SMS ID: %', request_id, NEW.id;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to notify when SMS is queued
DROP TRIGGER IF EXISTS sms_queue_notify_trigger ON sms_queue;
CREATE TRIGGER sms_queue_notify_trigger
  AFTER INSERT ON sms_queue
  FOR EACH ROW
  EXECUTE FUNCTION process_sms_queue();

-- =====================================================
-- Helper function to manually trigger SMS processing
-- =====================================================
CREATE OR REPLACE FUNCTION send_pending_sms()
RETURNS TABLE(
  pending_count BIGINT,
  message TEXT
) AS $$
DECLARE
  v_count BIGINT;
BEGIN
  -- Count pending SMS
  SELECT COUNT(*) INTO v_count
  FROM sms_queue
  WHERE status = 'pending' AND attempts < 3;
  
  RETURN QUERY SELECT 
    v_count,
    'Call the send-sms edge function to process ' || v_count || ' pending SMS'::TEXT;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Comments
-- =====================================================
COMMENT ON FUNCTION process_sms_queue IS 
'Trigger function that fires when SMS is queued. Logs notification for processing.';

COMMENT ON FUNCTION send_pending_sms IS 
'Helper function to check how many SMS are pending. Returns count and instructions.';

-- =====================================================
-- IMPORTANT: Setup Instructions
-- =====================================================
-- To enable automatic SMS processing, you need to set up ONE of these:
--
-- OPTION 1: Supabase Cron Job (RECOMMENDED)
-- Go to Supabase Dashboard → Database → Cron Jobs
-- Create a new cron job:
--   Name: process-sms-queue
--   Schedule: */10 * * * * (every 10 seconds) or */30 * * * * (every 30 seconds)
--   Command: SELECT net.http_post(
--              url := 'YOUR_SUPABASE_PROJECT_URL/functions/v1/send-sms',
--              headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb
--            );
--
-- OPTION 2: pg_net extension (requires enabling in Supabase)
-- Modify process_sms_queue() to use pg_net.http_post()
--
-- OPTION 3: Application-side polling
-- Create a periodic job in your backend that calls the send-sms edge function every 10-30 seconds
