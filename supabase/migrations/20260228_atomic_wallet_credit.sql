-- Fix for read-then-write TOCTOU race condition in wallet top-ups
-- This ensures balance is incremented atomically

CREATE OR REPLACE FUNCTION atomic_credit_wallet(p_user_id UUID, p_amount NUMERIC)
RETURNS VOID AS $$
BEGIN
  -- We use an atomic update instead of selecting and then updating
  UPDATE users 
  SET balance = COALESCE(balance, 0) + p_amount 
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
