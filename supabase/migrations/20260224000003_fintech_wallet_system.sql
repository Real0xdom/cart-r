-- Fintech System Migration
-- This migration captures the fintech functions already deployed to Supabase.
-- Tables (driver_wallets, driver_wallet_transactions, platform_settings) and
-- columns (drivers.beneficiary_id/beneficiary_status, withdrawals.wallet_id/payout_*) 
-- already exist. This migration recreates the RPC functions for source control.

-- ============================================================
-- Helper: get_platform_setting
-- ============================================================
CREATE OR REPLACE FUNCTION get_platform_setting(p_key TEXT) 
RETURNS JSONB AS $$
BEGIN
    RETURN (SELECT value FROM platform_settings WHERE key = p_key LIMIT 1);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================================
-- ensure_driver_wallet: Creates wallet if it doesn't exist
-- ============================================================
CREATE OR REPLACE FUNCTION ensure_driver_wallet(p_driver_id UUID)
RETURNS UUID AS $$
DECLARE
    v_wallet_id UUID;
BEGIN
    SELECT id INTO v_wallet_id FROM driver_wallets WHERE driver_id = p_driver_id;
    IF v_wallet_id IS NULL THEN
        INSERT INTO driver_wallets (driver_id, pending_balance, available_balance, total_earned, total_withdrawn)
        VALUES (p_driver_id, 0, 0, 0, 0)
        ON CONFLICT (driver_id) DO NOTHING
        RETURNING id INTO v_wallet_id;
        
        IF v_wallet_id IS NULL THEN
            SELECT id INTO v_wallet_id FROM driver_wallets WHERE driver_id = p_driver_id;
        END IF;
    END IF;
    RETURN v_wallet_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- credit_driver_earning: Credits earning to driver wallet
-- Handles commission split, idempotency, cash vs online
-- ============================================================
CREATE OR REPLACE FUNCTION credit_driver_earning(
    p_driver_id UUID, 
    p_booking_id UUID, 
    p_total_fare NUMERIC, 
    p_is_cash BOOLEAN DEFAULT false
)
RETURNS JSONB AS $$
DECLARE
    v_wallet_id UUID;
    v_commission_rate DECIMAL(5,2);
    v_driver_share DECIMAL(10,2);
    v_platform_fee DECIMAL(10,2);
    v_existing_earning UUID;
    v_balance_target TEXT;
BEGIN
    -- Idempotency
    SELECT id INTO v_existing_earning
    FROM driver_wallet_transactions
    WHERE booking_id = p_booking_id AND type = 'earning' AND driver_id = p_driver_id
    LIMIT 1;
    
    IF v_existing_earning IS NOT NULL THEN
        RETURN jsonb_build_object('success', true, 'message', 'Already credited');
    END IF;
    
    -- Get commission rate
    SELECT COALESCE((get_platform_setting('commission')->>'default_rate')::DECIMAL, 15)
    INTO v_commission_rate;
    
    -- Calculate split
    v_platform_fee := ROUND(p_total_fare * v_commission_rate / 100, 2);
    v_driver_share := p_total_fare - v_platform_fee;
    
    v_balance_target := CASE WHEN p_is_cash THEN 'available' ELSE 'pending' END;
    
    v_wallet_id := ensure_driver_wallet(p_driver_id);
    
    IF p_is_cash THEN
        UPDATE driver_wallets
        SET available_balance = available_balance + v_driver_share,
            total_earned = total_earned + v_driver_share
        WHERE id = v_wallet_id;
    ELSE
        UPDATE driver_wallets
        SET pending_balance = pending_balance + v_driver_share,
            total_earned = total_earned + v_driver_share
        WHERE id = v_wallet_id;
    END IF;
    
    INSERT INTO driver_wallet_transactions
        (driver_id, booking_id, type, amount, balance_type, direction, status, description, metadata)
    VALUES
        (p_driver_id, p_booking_id, 'earning', v_driver_share, v_balance_target, 'credit', 'completed',
         CASE WHEN p_is_cash 
             THEN 'Cash earning (available immediately)'
             ELSE 'Online earning (pending delivery confirmation)'
         END,
         jsonb_build_object(
             'total_fare', p_total_fare,
             'commission_rate', v_commission_rate,
             'platform_fee', v_platform_fee,
             'payment_type', CASE WHEN p_is_cash THEN 'cash' ELSE 'online' END
         ));
    
    UPDATE bookings
    SET driver_payout = v_driver_share
    WHERE id = p_booking_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'driver_share', v_driver_share,
        'platform_fee', v_platform_fee,
        'commission_rate', v_commission_rate,
        'balance_type', v_balance_target
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- release_pending_earning: Moves funds from pending to available
-- ============================================================
CREATE OR REPLACE FUNCTION release_pending_earning(p_booking_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_earning RECORD;
    v_wallet_id UUID;
BEGIN
    SELECT dwt.driver_id, dwt.amount INTO v_earning
    FROM driver_wallet_transactions dwt
    WHERE dwt.booking_id = p_booking_id 
      AND dwt.type = 'earning' 
      AND dwt.balance_type = 'pending'
    LIMIT 1;
    
    IF v_earning.driver_id IS NULL THEN
        RETURN jsonb_build_object('success', true, 'message', 'No pending earning to release');
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM driver_wallet_transactions
        WHERE booking_id = p_booking_id AND type = 'release'
    ) THEN
        RETURN jsonb_build_object('success', true, 'message', 'Already released');
    END IF;
    
    SELECT id INTO v_wallet_id FROM driver_wallets WHERE driver_id = v_earning.driver_id;
    
    UPDATE driver_wallets
    SET pending_balance = GREATEST(pending_balance - v_earning.amount, 0),
        available_balance = available_balance + v_earning.amount
    WHERE id = v_wallet_id;
    
    INSERT INTO driver_wallet_transactions
        (driver_id, booking_id, type, amount, balance_type, direction, status, description)
    VALUES
        (v_earning.driver_id, p_booking_id, 'release', v_earning.amount, 'available', 'credit', 'completed',
         'Earning released after trip completion');
    
    RETURN jsonb_build_object('success', true, 'released', v_earning.amount);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- get_driver_wallet_info: Returns full wallet info for a driver
-- ============================================================
CREATE OR REPLACE FUNCTION get_driver_wallet_info(p_driver_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_wallet RECORD;
    v_driver RECORD;
    v_pending_withdrawals DECIMAL(10,2);
BEGIN
    PERFORM ensure_driver_wallet(p_driver_id);
    
    SELECT * INTO v_wallet FROM driver_wallets WHERE driver_id = p_driver_id;
    SELECT bank_details, beneficiary_status, verification_status 
    INTO v_driver FROM drivers WHERE id = p_driver_id;
    
    SELECT COALESCE(SUM(amount), 0) INTO v_pending_withdrawals
    FROM withdrawals
    WHERE driver_id = p_driver_id AND status IN ('pending', 'approved');
    
    RETURN jsonb_build_object(
        'pending_balance', COALESCE(v_wallet.pending_balance, 0),
        'available_balance', COALESCE(v_wallet.available_balance, 0),
        'total_earned', COALESCE(v_wallet.total_earned, 0),
        'total_withdrawn', COALESCE(v_wallet.total_withdrawn, 0),
        'pending_withdrawals', v_pending_withdrawals,
        'bank_details', v_driver.bank_details,
        'beneficiary_status', v_driver.beneficiary_status,
        'verification_status', v_driver.verification_status
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Updated get_driver_balance: Uses driver_wallets table
-- ============================================================
CREATE OR REPLACE FUNCTION get_driver_balance(p_driver_id UUID)
RETURNS DECIMAL(10, 2) AS $$
DECLARE
    v_balance DECIMAL(10, 2);
BEGIN
    SELECT available_balance INTO v_balance FROM driver_wallets WHERE driver_id = p_driver_id;
    RETURN COALESCE(v_balance, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Updated request_withdrawal: Atomic with wallet deduction
-- ============================================================
CREATE OR REPLACE FUNCTION request_withdrawal(
    p_driver_id UUID, 
    p_amount NUMERIC, 
    p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_balance DECIMAL(10,2);
    v_wallet_id UUID;
    v_bank_details JSONB;
    v_min_withdrawal DECIMAL(10,2);
    v_max_withdrawal DECIMAL(10,2);
    v_kyc_required BOOLEAN;
    v_withdrawal_id UUID;
BEGIN
    v_min_withdrawal := COALESCE((get_platform_setting('payout')->>'min_withdrawal')::DECIMAL, 100);
    v_max_withdrawal := COALESCE((get_platform_setting('payout')->>'max_withdrawal')::DECIMAL, 50000);
    v_kyc_required := COALESCE((get_platform_setting('kyc')->>'required_for_payout')::BOOLEAN, true);
    
    IF p_idempotency_key IS NOT NULL THEN
        IF EXISTS (SELECT 1 FROM withdrawals WHERE idempotency_key = p_idempotency_key) THEN
            RETURN jsonb_build_object('success', false, 'error', 'Withdrawal already submitted');
        END IF;
    END IF;
    
    PERFORM pg_advisory_xact_lock(hashtext('withdrawal_' || p_driver_id::text));
    
    IF v_kyc_required THEN
        IF NOT EXISTS (
            SELECT 1 FROM drivers 
            WHERE id = p_driver_id AND verification_status = 'verified'
        ) THEN
            RETURN jsonb_build_object('success', false, 'error', 'KYC verification required for withdrawal');
        END IF;
    END IF;
    
    SELECT bank_details INTO v_bank_details FROM drivers WHERE id = p_driver_id;
    IF v_bank_details IS NULL OR v_bank_details = 'null'::jsonb OR v_bank_details = '{}'::jsonb THEN
        RETURN jsonb_build_object('success', false, 'error', 'Please add bank details first');
    END IF;
    
    IF p_amount < v_min_withdrawal THEN
        RETURN jsonb_build_object('success', false, 'error', 'Minimum withdrawal is ₹' || v_min_withdrawal);
    END IF;
    IF p_amount > v_max_withdrawal THEN
        RETURN jsonb_build_object('success', false, 'error', 'Maximum withdrawal is ₹' || v_max_withdrawal);
    END IF;
    
    v_balance := get_driver_balance(p_driver_id);
    IF v_balance < p_amount THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance. Available: ₹' || v_balance);
    END IF;
    
    SELECT id INTO v_wallet_id FROM driver_wallets WHERE driver_id = p_driver_id;
    
    UPDATE driver_wallets
    SET available_balance = available_balance - p_amount
    WHERE id = v_wallet_id;
    
    INSERT INTO withdrawals (driver_id, amount, status, idempotency_key, wallet_id)
    VALUES (p_driver_id, p_amount, 'pending', p_idempotency_key, v_wallet_id)
    RETURNING id INTO v_withdrawal_id;
    
    INSERT INTO driver_wallet_transactions
        (driver_id, withdrawal_id, type, amount, balance_type, direction, status, description)
    VALUES (p_driver_id, v_withdrawal_id, 'withdrawal', p_amount, 'available', 'debit', 'pending',
           'Withdrawal requested - awaiting approval');
    
    RETURN jsonb_build_object('success', true, 'withdrawal_id', v_withdrawal_id);
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- approve_withdrawal: Admin approves withdrawal
-- ============================================================
CREATE OR REPLACE FUNCTION approve_withdrawal(
    p_withdrawal_id UUID, 
    p_admin_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_withdrawal RECORD;
BEGIN
    SELECT * INTO v_withdrawal FROM withdrawals 
    WHERE id = p_withdrawal_id FOR UPDATE NOWAIT;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Withdrawal not found');
    END IF;
    
    IF v_withdrawal.status != 'pending' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Withdrawal is not pending (current: ' || v_withdrawal.status || ')');
    END IF;
    
    UPDATE withdrawals
    SET status = 'approved',
        admin_notes = p_admin_notes,
        updated_at = NOW()
    WHERE id = p_withdrawal_id;
    
    RETURN jsonb_build_object('success', true, 'message', 'Withdrawal approved');
    
EXCEPTION 
    WHEN lock_not_available THEN
        RETURN jsonb_build_object('success', false, 'error', 'Another admin is processing this withdrawal');
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- reject_withdrawal: Admin rejects and refunds withdrawal
-- ============================================================
CREATE OR REPLACE FUNCTION reject_withdrawal(
    p_withdrawal_id UUID, 
    p_reason TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_withdrawal RECORD;
BEGIN
    IF p_reason IS NULL OR TRIM(p_reason) = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Rejection reason is required');
    END IF;
    
    SELECT * INTO v_withdrawal FROM withdrawals 
    WHERE id = p_withdrawal_id FOR UPDATE NOWAIT;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Withdrawal not found');
    END IF;
    
    IF v_withdrawal.status NOT IN ('pending', 'approved') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cannot reject withdrawal (current: ' || v_withdrawal.status || ')');
    END IF;
    
    -- Refund to available balance
    UPDATE driver_wallets
    SET available_balance = available_balance + v_withdrawal.amount
    WHERE driver_id = v_withdrawal.driver_id;
    
    UPDATE withdrawals
    SET status = 'rejected',
        admin_notes = p_reason,
        updated_at = NOW()
    WHERE id = p_withdrawal_id;
    
    INSERT INTO driver_wallet_transactions
        (driver_id, withdrawal_id, type, amount, balance_type, direction, status, description)
    VALUES (v_withdrawal.driver_id, p_withdrawal_id, 'reversal', v_withdrawal.amount, 'available', 'credit', 'completed',
           'Withdrawal rejected: ' || p_reason);
    
    -- Mark original withdrawal transaction as failed
    UPDATE driver_wallet_transactions
    SET status = 'failed'
    WHERE withdrawal_id = p_withdrawal_id AND type = 'withdrawal';
    
    RETURN jsonb_build_object('success', true, 'message', 'Withdrawal rejected and balance returned');
    
EXCEPTION 
    WHEN lock_not_available THEN
        RETURN jsonb_build_object('success', false, 'error', 'Another admin is processing this withdrawal');
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Trigger: on_booking_payment_received
-- Auto-credits driver when payment_status goes to 'paid'
-- ============================================================
CREATE OR REPLACE FUNCTION on_booking_payment_received()
RETURNS TRIGGER AS $$
DECLARE
    v_fare DECIMAL(10,2);
BEGIN
    IF NEW.payment_status = 'paid' 
       AND (OLD.payment_status IS NULL OR OLD.payment_status != 'paid')
       AND NEW.status != 'completed'
       AND NEW.driver_id IS NOT NULL THEN
        
        v_fare := COALESCE(NEW.total_fare, 0);
        
        IF v_fare > 0 THEN
            IF NOT EXISTS (
                SELECT 1 FROM driver_wallet_transactions
                WHERE booking_id = NEW.id AND type = 'earning'
            ) THEN
                PERFORM credit_driver_earning(
                    NEW.driver_id,
                    NEW.id,
                    v_fare,
                    false
                );
            END IF;
        END IF;
        
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Trigger: on_booking_completed 
-- Auto-credits cash earnings or releases pending escrow
-- ============================================================
CREATE OR REPLACE FUNCTION on_booking_completed()
RETURNS TRIGGER AS $$
DECLARE
    v_is_cash BOOLEAN;
    v_fare DECIMAL(10,2);
BEGIN
    IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
        
        -- Update driver stats
        IF NEW.driver_id IS NOT NULL THEN
            UPDATE drivers
            SET 
                total_trips = COALESCE(total_trips, 0) + 1,
                total_earnings = COALESCE(total_earnings, 0) + COALESCE(NEW.driver_payout, NEW.total_fare, 0),
                updated_at = NOW()
            WHERE id = NEW.driver_id;
        END IF;
        
        v_is_cash := COALESCE(NEW.payment_method::text, 'cash') IN ('cash', 'Cash');
        v_fare := COALESCE(NEW.total_fare, 0);
        
        IF NEW.driver_id IS NOT NULL AND v_fare > 0 THEN
            IF NOT EXISTS (
                SELECT 1 FROM driver_wallet_transactions
                WHERE booking_id = NEW.id AND type = 'earning' AND driver_id = NEW.driver_id
            ) THEN
                -- No earning yet — credit now (cash trips)
                PERFORM credit_driver_earning(
                    NEW.driver_id,
                    NEW.id,
                    v_fare,
                    v_is_cash
                );
            ELSE
                -- Earning exists in pending — release to available
                PERFORM release_pending_earning(NEW.id);
            END IF;
        END IF;
        
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Seed platform_settings (idempotent)
-- ============================================================
INSERT INTO platform_settings (key, value, description, is_public) VALUES
    ('commission', '{"default_rate": 15, "by_vehicle_type": {}}', 'Default commission rate in percentage. by_vehicle_type allows per-vehicle overrides.', false),
    ('payout', '{"min_withdrawal": 100, "max_withdrawal": 50000, "auto_approve": false, "batch_processing": false}', 'Payout configuration for driver withdrawals.', false),
    ('kyc', '{"required_for_payout": true, "verified_status": "verified"}', 'KYC requirements for driver payouts.', false)
ON CONFLICT (key) DO NOTHING;
