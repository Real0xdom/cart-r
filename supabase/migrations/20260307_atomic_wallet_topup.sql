-- Fix for read-then-write TOCTOU race condition in wallet top-ups
-- This ensures balance is incremented atomically AND the transaction is marked completed in a single step

CREATE OR REPLACE FUNCTION atomic_credit_wallet_idempotent(p_user_id UUID, p_amount NUMERIC, p_order_id TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_txn_id UUID;
  v_status TEXT;
BEGIN
  -- 1. Lock the transaction row to prevent race conditions
  -- We SELECT ... FOR UPDATE so concurrent calls will block here
  SELECT id, status INTO v_txn_id, v_status
  FROM wallet_transactions
  WHERE payment_order_id = p_order_id
  FOR UPDATE;

  -- 2. If no transaction found, or already completed, return false (did not credit)
  IF NOT FOUND OR v_status = 'completed' THEN
    RETURN FALSE;
  END IF;

  -- 3. We are the first to hit this safely, credit the wallet
  UPDATE users 
  SET balance = COALESCE(balance, 0) + p_amount 
  WHERE id = p_user_id;

  -- 4. Mark transaction as completed safely
  UPDATE wallet_transactions
  SET status = 'completed',
      description = CASE WHEN description = 'Wallet top-up' THEN 'Wallet top-up via online' ELSE description END,
      updated_at = NOW()
  WHERE id = v_txn_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
