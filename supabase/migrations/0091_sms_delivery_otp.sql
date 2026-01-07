-- Migration: 009_sms_delivery_otp.sql
-- Purpose: Queue delivery OTP SMS when shipment starts (Simplified)

-- =====================================================
-- Create SMS Queue Table
-- =====================================================
CREATE TABLE IF NOT EXISTS sms_queue (
  id BIGSERIAL PRIMARY KEY,
  phone_number TEXT NOT NULL,
  message TEXT NOT NULL,
  booking_id UUID,
  status TEXT DEFAULT 'pending', -- pending, sent, failed
  attempts INTEGER DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sms_queue_status ON sms_queue(status, created_at);
CREATE INDEX IF NOT EXISTS idx_sms_queue_booking ON sms_queue(booking_id);

-- =====================================================
-- TRIGGER: Queue delivery OTP SMS when trip starts
-- =====================================================
CREATE OR REPLACE FUNCTION queue_delivery_otp_sms()
RETURNS TRIGGER AS $$
DECLARE
  sms_message TEXT;
BEGIN
  -- When trip starts (in_progress) and delivery_otp exists
  IF OLD.status IS DISTINCT FROM NEW.status 
     AND NEW.status = 'in_progress' 
     AND NEW.delivery_otp IS NOT NULL
     AND NEW.receiver_phone IS NOT NULL THEN
    
    -- Construct SMS message
    sms_message := 'CARTR Delivery: Your delivery OTP is ' || NEW.delivery_otp || '. Share this with the driver upon delivery. Booking #' || COALESCE(NEW.booking_number, SUBSTRING(NEW.id::TEXT, 1, 8));
    
    -- Queue SMS (application code will send it)
    INSERT INTO sms_queue (phone_number, message, booking_id, status, created_at)
    VALUES (
      '+91' || NEW.receiver_phone,
      sms_message,
      NEW.id,
      'pending',
      NOW()
    );
    
    RAISE NOTICE 'Delivery OTP SMS queued for % (booking %)', NEW.receiver_phone, NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create/Replace trigger
DROP TRIGGER IF EXISTS queue_delivery_otp_sms_trigger ON bookings;
CREATE TRIGGER queue_delivery_otp_sms_trigger
  AFTER UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION queue_delivery_otp_sms();

-- =====================================================
-- Comments
-- =====================================================
COMMENT ON TABLE sms_queue IS 
'Queue for outgoing SMS messages. Application code (Edge Function/Backend) processes this queue and sends actual SMS via Twilio/MSG91.';
