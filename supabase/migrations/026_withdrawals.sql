-- Create withdrawals table and related functions with Idempotency and Race Protection

-- 1. Add bank_details to drivers table if not exists
ALTER TABLE drivers 
ADD COLUMN IF NOT EXISTS bank_details JSONB DEFAULT NULL;

-- 2. Create withdrawals table
CREATE TABLE IF NOT EXISTS withdrawals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID REFERENCES drivers(id) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
    status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'paid')),
    notes TEXT,
    transaction_id TEXT, -- For storing bank reference/payment gateway ID
    idempotency_key TEXT UNIQUE, -- PREVENT DOUBLE PROCESSING
    admin_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

-- 3. Create function to calculate driver balance (Total Earnings - Approved/Pending Withdrawals)
CREATE OR REPLACE FUNCTION get_driver_balance(p_driver_id UUID)
RETURNS DECIMAL(10, 2) AS $$
DECLARE
    v_total_earnings DECIMAL(10, 2);
    v_total_withdrawals DECIMAL(10, 2);
BEGIN
    -- Get total earnings from completed bookings
    -- Using driver_payout if available, else total_fare (fallback)
    SELECT COALESCE(SUM(COALESCE(driver_payout, total_fare)), 0)
    INTO v_total_earnings
    FROM bookings
    WHERE driver_id = p_driver_id 
    AND status = 'completed';

    -- Get total withdrawals (pending, approved, paid)
    SELECT COALESCE(SUM(amount), 0)
    INTO v_total_withdrawals
    FROM withdrawals
    WHERE driver_id = p_driver_id 
    AND status IN ('pending', 'approved', 'paid');

    RETURN v_total_earnings - v_total_withdrawals;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Enable RLS
ALTER TABLE withdrawals ENABLE ROW LEVEL SECURITY;

-- 5. Helper function to request withdrawal (Atomic & Idempotent)
CREATE OR REPLACE FUNCTION request_withdrawal(
    p_driver_id UUID, 
    p_amount DECIMAL(10, 2),
    p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_balance DECIMAL(10, 2);
    v_bank_details JSONB;
BEGIN
    -- 1. Idempotency Check (Early Return)
    IF p_idempotency_key IS NOT NULL THEN
        IF EXISTS (SELECT 1 FROM withdrawals WHERE idempotency_key = p_idempotency_key) THEN
            RETURN jsonb_build_object('success', false, 'error', 'Withdrawal already requested with this key (Idempotency)');
        END IF;
    END IF;

    -- 2. Acquire Advisory Lock for this driver to prevent Race Conditions
    -- This ensures only one withdrawal request per driver runs at a time
    PERFORM pg_advisory_xact_lock(hashtext('withdrawal_' || p_driver_id::text));

    -- 3. Check if driver has bank details
    SELECT bank_details INTO v_bank_details
    FROM drivers
    WHERE id = p_driver_id;

    IF v_bank_details IS NULL OR v_bank_details = 'null'::jsonb THEN
        RETURN jsonb_build_object('success', false, 'error', 'Please add bank details first');
    END IF;

    -- 4. Check balance (Atomic due to lock)
    v_balance := get_driver_balance(p_driver_id);
    
    IF v_balance < p_amount THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance: ₹' || v_balance);
    END IF;

    -- 5. Create withdrawal request
    INSERT INTO withdrawals (driver_id, amount, status, idempotency_key)
    VALUES (p_driver_id, p_amount, 'pending', p_idempotency_key);

    RETURN jsonb_build_object('success', true);

EXCEPTION WHEN OTHERS THEN
    -- Put nice error handling here
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Policies
CREATE POLICY "Drivers can view their own withdrawals"
    ON withdrawals FOR SELECT
    USING (auth.uid() IN (SELECT user_id FROM drivers WHERE id = withdrawals.driver_id));

CREATE POLICY "Admins can view all withdrawals"
    ON withdrawals FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Admins can update withdrawals"
    ON withdrawals FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );
