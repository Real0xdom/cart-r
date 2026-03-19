-- Migration: Add payment confirmation fields
-- This enables customers to confirm how they paid, helping detect commission bypass

-- Add fields to bookings table for customer payment confirmation
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS 
  payment_confirmed_by_customer boolean DEFAULT false;

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS 
  customer_reported_payment_method text;
-- Values: 'cartr_app', 'cash_to_driver', 'driver_personal_upi'

-- Add payment flags counter to drivers table (tracks suspicious reports)
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS 
  payment_flags integer DEFAULT 0;

-- RPC function for customer to confirm payment method
CREATE OR REPLACE FUNCTION confirm_customer_payment(
  p_booking_id uuid,
  p_payment_method text  -- 'cartr_app', 'cash_to_driver', 'driver_personal_upi'
)
RETURNS json AS $$
DECLARE
  v_driver_id uuid;
BEGIN
  -- Get driver ID from booking
  SELECT driver_id INTO v_driver_id 
  FROM bookings 
  WHERE id = p_booking_id;

  -- Update booking with customer's reported payment method
  UPDATE bookings 
  SET 
    payment_confirmed_by_customer = true,
    customer_reported_payment_method = p_payment_method,
    updated_at = now()
  WHERE id = p_booking_id;

  -- If driver used personal UPI (bypassing platform), flag them
  IF p_payment_method = 'driver_personal_upi' THEN
    UPDATE drivers 
    SET payment_flags = COALESCE(payment_flags, 0) + 1
    WHERE id = v_driver_id;
    
    -- Log this for audit
    INSERT INTO audit_logs (table_name, record_id, action, new_data, created_at)
    VALUES (
      'drivers',
      v_driver_id,
      'payment_flag',
      jsonb_build_object(
        'booking_id', p_booking_id,
        'reported_method', p_payment_method,
        'reason', 'Customer reported driver used personal UPI'
      ),
      now()
    );
  END IF;

  RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION confirm_customer_payment(uuid, text) TO authenticated;
