-- =====================================================
-- WALLET PAYMENT SYSTEM - DATABASE FUNCTIONS
-- =====================================================
-- Features:
-- 1. Pay full amount from wallet
-- 2. Pay partial from wallet + remaining via online payment
-- 3. Race condition protection (row locks)
-- 4. Idempotency checks
-- 5. Atomic transactions
-- =====================================================

-- Function 1: Pay with Wallet (Full or Partial)
-- =====================================================
CREATE OR REPLACE FUNCTION pay_with_wallet(
  p_booking_id UUID,
  p_user_id UUID,
  p_use_full_wallet BOOLEAN DEFAULT true,
  p_payment_session_id TEXT DEFAULT NULL
) RETURNS JSON AS $$
DECLARE
  v_booking RECORD;
  v_user_balance DECIMAL;
  v_total_amount DECIMAL;
  v_wallet_amount DECIMAL;
  v_remaining_amount DECIMAL;
  v_new_balance DECIMAL;
BEGIN
  -- ===== STEP 1: Get booking with row lock =====
  -- Prevents concurrent payment attempts
  SELECT * INTO v_booking
  FROM bookings
  WHERE id = p_booking_id
  FOR UPDATE NOWAIT; -- Fail fast if already locked
  
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false, 
      'error', 'Booking not found'
    );
  END IF;
  
  -- ===== STEP 2: Validate ownership =====
  IF v_booking.customer_id != p_user_id THEN
    RETURN json_build_object(
      'success', false, 
      'error', 'Unauthorized - not your booking'
    );
  END IF;
  
  -- ===== STEP 3: Check if already paid =====
  -- Idempotency check
  IF v_booking.payment_status = 'paid' THEN
    RETURN json_build_object(
      'success', false, 
      'error', 'Already paid',
      'payment_method', v_booking.payment_method
    );
  END IF;

  v_total_amount := v_booking.total_fare;
  
  -- ===== STEP 4: Get user balance with row lock =====
  SELECT balance INTO v_user_balance
  FROM users
  WHERE id = p_user_id
  FOR UPDATE;
  
  IF v_user_balance IS NULL THEN
    RETURN json_build_object(
      'success', false, 
      'error', 'User not found'
    );
  END IF;
  
  -- ===== STEP 5: Calculate wallet usage =====
  IF p_use_full_wallet THEN
    -- User wants to pay everything from wallet
    IF v_user_balance < v_total_amount THEN
      RETURN json_build_object(
        'success', false,
        'error', 'Insufficient balance',
        'required', v_total_amount,
        'available', v_user_balance,
        'shortfall', v_total_amount - v_user_balance
      );
    END IF;
    
    v_wallet_amount := v_total_amount;
    v_remaining_amount := 0;
  ELSE
    -- Partial payment: Use all wallet + pay remaining online
    IF v_user_balance > 0 THEN
      v_wallet_amount := LEAST(v_user_balance, v_total_amount);
      v_remaining_amount := v_total_amount - v_wallet_amount;
    ELSE
      v_wallet_amount := 0;
      v_remaining_amount := v_total_amount;
    END IF;
  END IF;
  
  -- ===== STEP 6: Deduct from wallet (ATOMIC) =====
  IF v_wallet_amount > 0 THEN
    UPDATE users
    SET balance = balance - v_wallet_amount
    WHERE id = p_user_id;
    
    v_new_balance := v_user_balance - v_wallet_amount;
    
    -- Create wallet transaction record
    INSERT INTO wallet_transactions (
      user_id,
      amount,
      type,
      status,
      description,
      booking_id
    ) VALUES (
      p_user_id,
      v_wallet_amount,
      'debit',
      'completed',
      'Trip payment - Booking #' || v_booking.booking_number || 
        CASE 
          WHEN v_remaining_amount > 0 
          THEN ' (Partial: ₹' || v_wallet_amount || ' of ₹' || v_total_amount || ')'
          ELSE ' (Full payment)'
        END,
      p_booking_id
    );
  ELSE
    v_new_balance := v_user_balance;
  END IF;

  -- ===== STEP 7: Update booking payment status =====
  IF v_remaining_amount = 0 THEN
    -- Fully paid from wallet
    UPDATE bookings
    SET 
      payment_status = 'paid',
      payment_method = 'wallet',
      completed_at = NOW()
    WHERE id = p_booking_id;
  ELSE
    -- Partial payment - mark as partial_paid
    UPDATE bookings
    SET 
      payment_status = 'partial_paid',
      payment_method = 'partial_wallet',
      wallet_amount_used = v_wallet_amount,
      payment_session_id = p_payment_session_id
    WHERE id = p_booking_id;
  END IF;
  
  -- ===== STEP 8: Return success =====
  RETURN json_build_object(
    'success', true,
    'wallet_deducted', v_wallet_amount,
    'remaining_to_pay', v_remaining_amount,
    'new_wallet_balance', v_new_balance,
    'fully_paid', (v_remaining_amount = 0),
    'booking_status', CASE 
      WHEN v_remaining_amount = 0 THEN 'paid'
      ELSE 'partial_paid'
    END
  );

EXCEPTION
  WHEN lock_not_available THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Payment already in progress. Please wait.'
    );
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Payment failed: ' || SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function 2: Complete Partial Payment (after online payment succeeds)
-- =====================================================
CREATE OR REPLACE FUNCTION complete_partial_payment(
  p_booking_id UUID,
  p_payment_order_id TEXT,
  p_amount_paid DECIMAL
) RETURNS JSON AS $$
DECLARE
  v_booking RECORD;
BEGIN
  -- Get booking with lock
  SELECT * INTO v_booking
  FROM bookings
  WHERE id = p_booking_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Booking not found');
  END IF;
  
  -- Verify this was a partial payment
  IF v_booking.payment_status != 'partial_paid' THEN
    RETURN json_build_object(
      'success', false, 
      'error', 'Not a partial payment booking'
    );
  END IF;
  
  -- Mark as fully paid
  UPDATE bookings
  SET 
    payment_status = 'paid',
    payment_method = 'wallet_plus_online',
    online_payment_order_id = p_payment_order_id,
    completed_at = NOW()
  WHERE id = p_booking_id;
  
  RETURN json_build_object(
    'success', true,
    'wallet_amount', v_booking.wallet_amount_used,
    'online_amount', p_amount_paid,
    'total_amount', v_booking.total_fare
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add columns to bookings table if they don't exist
-- =====================================================
DO $$ 
BEGIN
  -- Add wallet_amount_used column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'bookings' AND column_name = 'wallet_amount_used'
  ) THEN
    ALTER TABLE bookings ADD COLUMN wallet_amount_used DECIMAL(10,2) DEFAULT 0;
  END IF;
  
  -- Add payment_session_id column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'bookings' AND column_name = 'payment_session_id'
  ) THEN
    ALTER TABLE bookings ADD COLUMN payment_session_id TEXT;
  END IF;
  
  -- Add online_payment_order_id column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'bookings' AND column_name = 'online_payment_order_id'
  ) THEN
    ALTER TABLE bookings ADD COLUMN online_payment_order_id TEXT;
  END IF;
END $$;

-- Update payment_method enum to include new types
-- =====================================================
ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'wallet';
ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'partial_wallet';
ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'wallet_plus_online';

-- Create indexes for performance
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_bookings_payment_status 
  ON bookings(payment_status);

CREATE INDEX IF NOT EXISTS idx_bookings_payment_session_id 
  ON bookings(payment_session_id) 
  WHERE payment_session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_booking 
  ON wallet_transactions(booking_id) 
  WHERE booking_id IS NOT NULL;

COMMENT ON FUNCTION pay_with_wallet IS 'Pay for booking using wallet balance (full or partial). Includes race condition protection and idempotency.';
COMMENT ON FUNCTION complete_partial_payment IS 'Complete a partial wallet payment after online payment succeeds.';
