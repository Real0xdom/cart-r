-- Migration: 010_defer_otp_generation.sql
-- Purpose: Defer delivery OTP generation until arrival, replacing auto-generation

-- 1. Drop the auto-generation trigger (from 005_booking_enhancements.sql)
DROP TRIGGER IF EXISTS bookings_delivery_otp ON bookings;

-- 2. Create RPC function to generate OTP on demand
-- This will be called by the Driver App when arriving at destination
CREATE OR REPLACE FUNCTION initiate_delivery_otp(p_booking_id UUID, p_force_regenerate BOOLEAN DEFAULT FALSE)
RETURNS JSONB AS $$
DECLARE
  v_otp VARCHAR(6);
  v_booking RECORD;
  sms_message TEXT;
BEGIN
  -- Check if booking exists
  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Booking not found');
  END IF;

  -- If OTP already exists and NOT forcing regenerate, return it (idempotent)
  IF v_booking.delivery_otp IS NOT NULL AND NOT p_force_regenerate THEN
    RETURN jsonb_build_object('success', true, 'otp', v_booking.delivery_otp, 'status', 'existing');
  END IF;

  -- Generate new OTP
  v_otp := LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');

  -- Update booking
  UPDATE bookings 
  SET delivery_otp = v_otp
  WHERE id = p_booking_id;

  -- Automatically queue SMS if receiver phone exists
  IF v_booking.receiver_phone IS NOT NULL THEN
    sms_message := 'CARTR Delivery: Your delivery OTP is ' || v_otp || '. Share this with the driver upon delivery. Booking #' || COALESCE(v_booking.booking_number, SUBSTRING(p_booking_id::TEXT, 1, 8));
    
    INSERT INTO sms_queue (phone_number, message, booking_id, status, created_at)
    VALUES (
      '+91' || v_booking.receiver_phone,
      sms_message,
      p_booking_id,
      'pending',
      NOW()
    );
    
    RAISE NOTICE 'OTP generated and SMS queued for % (booking %)', v_booking.receiver_phone, p_booking_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'otp', v_otp, 'status', 'generated', 'regenerated', p_force_regenerate);
END;
$$ LANGUAGE plpgsql;

-- 3. Update SMS Queue Trigger to fire when delivery_otp is SET
-- (Previously caught status change 'in_progress', now catches OTP generation)
CREATE OR REPLACE FUNCTION queue_delivery_otp_sms()
RETURNS TRIGGER AS $$
DECLARE
  sms_message TEXT;
BEGIN
  -- Trigger when delivery_otp changes from NULL to VALUE
  -- OR when status changes to 'in_progress' AND otp exists (fallback)
  IF (OLD.delivery_otp IS NULL AND NEW.delivery_otp IS NOT NULL) 
     OR (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'in_progress' AND NEW.delivery_otp IS NOT NULL)
  THEN
    
    -- Ensure receiver phone exists
    IF NEW.receiver_phone IS NOT NULL THEN
       -- Construct SMS message
       sms_message := 'CARTR Delivery: Your delivery OTP is ' || NEW.delivery_otp || '. Share this with the driver upon delivery. Booking #' || COALESCE(NEW.booking_number, SUBSTRING(NEW.id::TEXT, 1, 8));
       
       -- Queue SMS
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
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
