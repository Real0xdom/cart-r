-- Migration: 007_notification_webhook.sql
-- Purpose: Create function to send push notifications via edge function on booking status changes

-- =====================================================
-- Enable required extensions
-- =====================================================
CREATE EXTENSION IF NOT EXISTS http;

-- =====================================================
-- FUNCTION: Send notification via Edge Function
-- =====================================================
CREATE OR REPLACE FUNCTION send_notification_to_user(
  p_user_id UUID,
  p_title TEXT,
  p_body TEXT,
  p_data JSONB DEFAULT '{}'
) RETURNS void AS $$
DECLARE
  v_supabase_url TEXT;
  v_service_key TEXT;
BEGIN
  -- Get Supabase URL and service key from secrets
  -- Note: In production, these should be stored as database secrets
  v_supabase_url := current_setting('app.settings.supabase_url', true);
  v_service_key := current_setting('app.settings.service_role_key', true);
  
  -- If secrets not configured, log and skip
  IF v_supabase_url IS NULL OR v_service_key IS NULL THEN
    RAISE NOTICE 'Supabase configuration not set, skipping notification';
    RETURN;
  END IF;
  
  -- Call the send-notification edge function
  PERFORM http_post(
    v_supabase_url || '/functions/v1/send-notification',
    jsonb_build_object(
      'userId', p_user_id,
      'title', p_title,
      'body', p_body,
      'data', p_data
    )::text,
    'application/json',
    ARRAY[
      ('Authorization', 'Bearer ' || v_service_key)::http_header
    ]
  );
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't fail the transaction
  RAISE NOTICE 'Failed to send notification: %', SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Alternative: Insert into notifications table for background processing
-- The notifications table can be polled by a cron job or edge function
-- =====================================================

-- This trigger inserts into notifications table, which we already created
-- The send-notification function can be called by a separate process that
-- polls this table for new unprocessed notifications

-- Function to process notification queue
CREATE OR REPLACE FUNCTION process_notification_queue()
RETURNS void AS $$
DECLARE
  notification_record RECORD;
  user_token TEXT;
BEGIN
  -- Find unprocessed notifications
  FOR notification_record IN
    SELECT n.*, u.expo_push_token
    FROM notifications n
    JOIN users u ON n.user_id = u.id
    WHERE n.processed_at IS NULL
      AND u.expo_push_token IS NOT NULL
    ORDER BY n.created_at ASC
    LIMIT 50
  LOOP
    -- Mark as processed (the edge function will handle actual sending)
    UPDATE notifications 
    SET processed_at = NOW()
    WHERE id = notification_record.id;
    
    RAISE NOTICE 'Queued notification % for processing', notification_record.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Update the customer notification trigger to be more robust
-- =====================================================
CREATE OR REPLACE FUNCTION notify_customer_on_status_change()
RETURNS TRIGGER AS $$
DECLARE
  notification_title TEXT;
  notification_body TEXT;
  should_notify BOOLEAN := true;
BEGIN
  -- Only trigger on status changes
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    
    -- Determine notification content based on status
    CASE NEW.status
      WHEN 'accepted' THEN
        notification_title := '✅ Driver Found!';
        notification_body := 'Your driver is on the way to pick up your goods.';
      WHEN 'driver_arrived' THEN
        notification_title := '📍 Driver Arrived';
        notification_body := 'Your driver has arrived at the pickup location. Please hand over the package.';
      WHEN 'in_progress' THEN
        notification_title := '🚚 Shipment Started';
        notification_body := 'Your goods are on the way to ' || COALESCE(NEW.receiver_name, 'the receiver') || '.';
      WHEN 'completed' THEN
        notification_title := '🎉 Delivery Complete!';
        notification_body := 'Your shipment has been delivered successfully. Thank you for using CARTR!';
      WHEN 'cancelled' THEN
        notification_title := '❌ Booking Cancelled';
        notification_body := COALESCE(NEW.cancellation_reason, 'Your booking has been cancelled.');
      ELSE
        should_notify := false;
    END CASE;
    
    IF should_notify THEN
      -- Insert notification record
      INSERT INTO notifications (
        user_id,
        title,
        body,
        data,
        notification_type,
        is_read
      ) VALUES (
        NEW.customer_id,
        notification_title,
        notification_body,
        jsonb_build_object(
          'booking_id', NEW.id,
          'type', 'status_update',
          'status', NEW.status,
          'booking_number', NEW.booking_number
        ),
        'booking_update',
        false
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger with updated function
DROP TRIGGER IF EXISTS notify_customer_on_booking_update ON bookings;
CREATE TRIGGER notify_customer_on_booking_update
  AFTER UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION notify_customer_on_status_change();

-- =====================================================
-- Add processed_at column to notifications if not exists
-- =====================================================
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS notification_type TEXT DEFAULT 'general';

-- Index for processing queue
CREATE INDEX IF NOT EXISTS idx_notifications_unprocessed 
  ON notifications (created_at) 
  WHERE processed_at IS NULL;
