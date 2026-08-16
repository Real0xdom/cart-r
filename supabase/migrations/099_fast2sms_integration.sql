-- Migration: 099_fast2sms_integration.sql
-- Purpose: Add tables and functions for Fast2SMS OTP integration

-- =====================================================
-- Fast2SMS OTP Tracking Table
-- =====================================================
CREATE TABLE IF NOT EXISTS fast2sms_otp_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL,
  otp_code VARCHAR(6) NOT NULL,
  purpose TEXT NOT NULL, -- 'auth', 'delivery', 'registration'
  status TEXT DEFAULT 'pending', -- pending, verified, expired, failed
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  expires_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_fast2sms_otp_phone ON fast2sms_otp_requests(phone_number, status, expires_at);
CREATE INDEX IF NOT EXISTS idx_fast2sms_otp_purpose ON fast2sms_otp_requests(purpose, status);
CREATE INDEX IF NOT EXISTS idx_fast2sms_otp_user ON fast2sms_otp_requests(user_id);

-- =====================================================
-- Function to Generate and Store OTP
-- =====================================================
CREATE OR REPLACE FUNCTION generate_fast2sms_otp(
  p_phone_number TEXT,
  p_purpose TEXT,
  p_user_id UUID DEFAULT NULL,
  p_booking_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS TEXT AS $$
DECLARE
  v_otp TEXT;
  v_expires_at TIMESTAMPTZ;
  v_normalized_phone TEXT;
  -- Dev testing configuration
  DEV_NUMBERS TEXT[] := ARRAY['7744066077', '917744066077'];
  DEV_FIXED_OTP TEXT := '123456';
BEGIN
  -- Normalize phone number (remove +, 91 prefix, spaces)
  v_normalized_phone := REGEXP_REPLACE(REGEXP_REPLACE(p_phone_number, '\+', '', 'g'), '\s', '', 'g');
  v_normalized_phone := REGEXP_REPLACE(v_normalized_phone, '^91', '', 'g');
  
  -- Check if this is a dev testing number
  IF v_normalized_phone = ANY(DEV_NUMBERS) THEN
    v_otp := DEV_FIXED_OTP;
    -- Longer expiry for dev testing
    v_expires_at := NOW() + INTERVAL '30 minutes';
  ELSE
    -- Generate random 6-digit OTP for production
    v_otp := LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
    v_expires_at := NOW() + INTERVAL '5 minutes';
  END IF;

  -- Mark any existing pending OTPs as expired
  UPDATE fast2sms_otp_requests
  SET status = 'expired'
  WHERE phone_number = p_phone_number
    AND purpose = p_purpose
    AND status = 'pending';

  -- Insert new OTP
  INSERT INTO fast2sms_otp_requests (
    phone_number,
    otp_code,
    purpose,
    status,
    expires_at,
    user_id,
    booking_id,
    metadata
  ) VALUES (
    p_phone_number,
    v_otp,
    p_purpose,
    'pending',
    v_expires_at,
    p_user_id,
    p_booking_id,
    p_metadata
  );

  RETURN v_otp;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- Function to Verify OTP
-- =====================================================
CREATE OR REPLACE FUNCTION verify_fast2sms_otp(
  p_phone_number TEXT,
  p_otp_code TEXT,
  p_purpose TEXT DEFAULT 'auth'
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT,
  user_id UUID,
  booking_id UUID
) AS $$
DECLARE
  v_record RECORD;
BEGIN
  -- Find the most recent pending OTP for this phone and purpose
  SELECT *
  INTO v_record
  FROM fast2sms_otp_requests
  WHERE phone_number = p_phone_number
    AND purpose = p_purpose
    AND status = 'pending'
    AND expires_at > NOW()
  ORDER BY created_at DESC
  LIMIT 1;

  -- Check if OTP exists
  IF v_record IS NULL THEN
    RETURN QUERY SELECT false, 'No valid OTP found. Please request a new OTP.', NULL::UUID, NULL::UUID;
    RETURN;
  END IF;

  -- Check attempts
  IF v_record.attempts >= v_record.max_attempts THEN
    -- Mark as expired due to too many attempts
    UPDATE fast2sms_otp_requests
    SET status = 'expired'
    WHERE id = v_record.id;

    RETURN QUERY SELECT false, 'Too many failed attempts. Please request a new OTP.', NULL::UUID, NULL::UUID;
    RETURN;
  END IF;

  -- Verify OTP
  IF v_record.otp_code = p_otp_code THEN
    -- Mark as verified
    UPDATE fast2sms_otp_requests
    SET status = 'verified',
        verified_at = NOW()
    WHERE id = v_record.id;

    RETURN QUERY SELECT true, 'OTP verified successfully', v_record.user_id, v_record.booking_id;
    RETURN;
  ELSE
    -- Increment attempts
    UPDATE fast2sms_otp_requests
    SET attempts = attempts + 1
    WHERE id = v_record.id;

    RETURN QUERY SELECT false, 'Invalid OTP. Please try again.', NULL::UUID, NULL::UUID;
    RETURN;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- Function to Create/Update User after OTP Verification
-- =====================================================
CREATE OR REPLACE FUNCTION create_or_update_user_after_otp(
  p_phone TEXT,
  p_role TEXT DEFAULT 'customer',
  p_name TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS TABLE (
  user_id UUID,
  is_new_user BOOLEAN,
  email TEXT
) AS $$
DECLARE
  v_user_id UUID;
  v_is_new BOOLEAN := false;
  v_email TEXT;
BEGIN
  -- Check if user exists
  SELECT id, email
  INTO v_user_id, v_email
  FROM users
  WHERE phone = p_phone
  LIMIT 1;

  -- If not exists, create new user
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    v_is_new := true;
    v_email := COALESCE(
      p_metadata->>'email',
      REPLACE(p_phone, '+', '') || '@phone.cart-r.app'
    );

    INSERT INTO users (
      id,
      phone,
      email,
      name,
      role,
      created_at,
      updated_at
    ) VALUES (
      v_user_id,
      p_phone,
      v_email,
      COALESCE(p_name, 'User'),
      p_role,
      NOW(),
      NOW()
    );
  ELSE
    -- Update existing user's last activity
    UPDATE users
    SET updated_at = NOW(),
        last_login_at = NOW()
    WHERE id = v_user_id;
  END IF;

  RETURN QUERY SELECT v_user_id, v_is_new, v_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- Function to Queue Fast2SMS Message
-- =====================================================
CREATE OR REPLACE FUNCTION queue_fast2sms_message(
  p_phone_number TEXT,
  p_message TEXT,
  p_purpose TEXT,
  p_booking_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO sms_queue (
    phone_number,
    message,
    status,
    purpose,
    booking_id,
    metadata,
    created_at
  ) VALUES (
    p_phone_number,
    p_message,
    'pending',
    p_purpose,
    p_booking_id,
    p_metadata,
    NOW()
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- Add purpose column to sms_queue if not exists
-- =====================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sms_queue' AND column_name = 'purpose'
  ) THEN
    ALTER TABLE sms_queue ADD COLUMN purpose TEXT DEFAULT 'general';
  END IF;
END $$;

-- =====================================================
-- Comments
-- =====================================================
COMMENT ON TABLE fast2sms_otp_requests IS 
'Tracks OTP requests sent via Fast2SMS. Includes verification status and attempts.';

COMMENT ON FUNCTION generate_fast2sms_otp IS 
'Generates a 6-digit OTP and stores it in the database. Returns the OTP code.';

COMMENT ON FUNCTION verify_fast2sms_otp IS 
'Verifies an OTP code for a phone number. Returns success status and user/booking info.';
