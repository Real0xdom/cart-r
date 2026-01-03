-- ============================================
-- RPC Function to check if user exists by phone
-- This bypasses RLS to allow pre-login phone check
-- Migration: 011_check_phone_exists.sql
-- ============================================

-- Create function to check if phone exists
CREATE OR REPLACE FUNCTION check_phone_exists(phone_number TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with creator's privileges, bypassing RLS
SET search_path = public
AS $$
DECLARE
  user_exists BOOLEAN;
BEGIN
  -- Check both formats: with and without + prefix
  SELECT EXISTS (
    SELECT 1 FROM users 
    WHERE phone = phone_number 
       OR phone = REPLACE(phone_number, '+', '')
       OR '+' || phone = phone_number
  ) INTO user_exists;
  
  RETURN user_exists;
END;
$$;

-- Grant execute permission to anonymous users (for pre-login check)
GRANT EXECUTE ON FUNCTION check_phone_exists(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION check_phone_exists(TEXT) TO authenticated;

-- Test the function (run in SQL editor)
-- SELECT check_phone_exists('+917744066077');
-- SELECT check_phone_exists('917744066077');
