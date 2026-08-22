-- Migration: 008_delivery_otp_notification.sql
-- Purpose: Add trigger to notify receiver of delivery OTP when shipment starts

-- =====================================================
-- Enhanced notification function to support phone number
-- =====================================================
CREATE OR REPLACE FUNCTION notify_receiver_delivery_otp()
RETURNS TRIGGER AS $$
DECLARE
  notification_body TEXT;
BEGIN
  -- Only trigger when status changes to 'in_progress' 
  -- AND delivery_otp exists AND receiver details exist
  IF OLD.status IS DISTINCT FROM NEW.status 
     AND NEW.status = 'in_progress' 
     AND NEW.delivery_otp IS NOT NULL
     AND NEW.receiver_phone IS NOT NULL THEN
    
    notification_body := 'Your delivery OTP is: ' || NEW.delivery_otp || '. Please share this with the driver upon delivery.';
    
    -- Insert notification for the CUSTOMER (sender) to share withreceiver
    -- Since we don't have receiver in users table, we notify the customer
    INSERT INTO notifications (
      user_id,
      title,
      body,
      data,
      notification_type,
      is_read
    ) VALUES (
      NEW.customer_id,
      '📦 Delivery OTP Generated',
      'Share OTP ' || NEW.delivery_otp || ' with ' || COALESCE(NEW.receiver_name, 'the receiver') || ' at ' || NEW.receiver_phone || ' for delivery confirmation.',
      jsonb_build_object(
        'booking_id', NEW.id,
        'type', 'delivery_otp',
        'delivery_otp', NEW.delivery_otp,
        'receiver_name', NEW.receiver_name,
        'receiver_phone', NEW.receiver_phone,
        'booking_number', NEW.booking_number
      ),
      'delivery_otp',
      false
    );
    
    -- TODO: In production, integrate with SMS service to send OTP directly to receiver_phone
    -- For now, we notify the customer/sender who can manually inform the receiver
    
    RAISE NOTICE 'Delivery OTP notification created for booking %', NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS notify_delivery_otp ON bookings;
CREATE TRIGGER notify_delivery_otp
  AFTER UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION notify_receiver_delivery_otp();

-- =====================================================
-- Add comment for future SMS integration
-- =====================================================
COMMENT ON FUNCTION notify_receiver_delivery_otp() IS 
'Sends delivery OTP notification when shipment starts. Currently notifies customer app. 
TODO: Integrate with SMS service (Twilio/AWS SNS) to send OTP directly to receiver_phone';
