-- Fix driver wallet crediting logic for cash rides
-- For cash rides, do not increase the driver's available balance since they already collected the cash payment directly from the customer.

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
        -- Driver already collected full fare in cash.
        -- Update total_earned ONLY, do not give them withdrawable money for cash rides
        UPDATE driver_wallets
        SET total_earned = total_earned + v_driver_share
        WHERE id = v_wallet_id;
    ELSE
        -- Online payment, credit pending balance
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
             THEN 'Cash earning (Already collected offline)'
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
