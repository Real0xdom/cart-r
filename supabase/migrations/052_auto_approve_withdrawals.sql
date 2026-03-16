-- Add auto_approve support for withdrawals
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
    v_auto_approve BOOLEAN;
    v_withdrawal_id UUID;
    v_status TEXT;
    v_desc TEXT;
BEGIN
    v_min_withdrawal := COALESCE((get_platform_setting('payout')->>'min_withdrawal')::DECIMAL, 100);
    v_max_withdrawal := COALESCE((get_platform_setting('payout')->>'max_withdrawal')::DECIMAL, 50000);
    v_kyc_required := COALESCE((get_platform_setting('kyc')->>'required_for_payout')::BOOLEAN, true);
    v_auto_approve := COALESCE((get_platform_setting('payout')->>'auto_approve')::BOOLEAN, false);
    
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
    
    v_status := CASE WHEN v_auto_approve THEN 'approved' ELSE 'pending' END;
    v_desc := CASE 
        WHEN v_auto_approve THEN 'Withdrawal auto-approved by platform rules' 
        ELSE 'Withdrawal requested - awaiting approval' 
    END;
    
    INSERT INTO withdrawals (driver_id, amount, status, idempotency_key, wallet_id, admin_notes)
    VALUES (p_driver_id, p_amount, v_status, p_idempotency_key, v_wallet_id, CASE WHEN v_auto_approve THEN 'Auto-approved by system setting' ELSE NULL END)
    RETURNING id INTO v_withdrawal_id;
    
    INSERT INTO driver_wallet_transactions
        (driver_id, withdrawal_id, type, amount, balance_type, direction, status, description)
    VALUES (p_driver_id, v_withdrawal_id, 'withdrawal', p_amount, 'available', 'debit', v_status, v_desc);
    
    RETURN jsonb_build_object('success', true, 'withdrawal_id', v_withdrawal_id, 'status', v_status);
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
