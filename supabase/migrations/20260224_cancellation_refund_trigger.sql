-- ============================================================
-- reversal logic for cancelled bookings
-- If a booking was already credited (pending or available) and gets cancelled,
-- we must create a reversal ledger entry and deduct the balance.
-- ============================================================
CREATE OR REPLACE FUNCTION on_booking_cancelled()
RETURNS TRIGGER AS $$
DECLARE
    v_earning RECORD;
    v_wallet_id UUID;
    v_amount NUMERIC;
BEGIN
    IF NEW.status = 'cancelled' AND (OLD.status IS NULL OR OLD.status != 'cancelled') THEN
        
        -- Find the original earning transaction
        SELECT * INTO v_earning 
        FROM driver_wallet_transactions
        WHERE booking_id = NEW.id AND type = 'earning' AND status = 'completed'
        LIMIT 1;

        -- If an earning was credited, we need to reverse it
        IF v_earning.id IS NOT NULL THEN
            
            -- Make sure we haven't already reversed it
            IF NOT EXISTS (
                SELECT 1 FROM driver_wallet_transactions
                WHERE booking_id = NEW.id AND type = 'reversal'
            ) THEN
                
                SELECT id INTO v_wallet_id FROM driver_wallets WHERE driver_id = v_earning.driver_id;
                v_amount := v_earning.amount;
                
                -- Deduct from the appropriate balance
                IF v_earning.balance_type = 'pending' THEN
                    UPDATE driver_wallets
                    SET pending_balance = GREATEST(pending_balance - v_amount, 0),
                        total_earned = GREATEST(total_earned - v_amount, 0)
                    WHERE id = v_wallet_id;
                ELSE
                    UPDATE driver_wallets
                    SET available_balance = GREATEST(available_balance - v_amount, 0),
                        total_earned = GREATEST(total_earned - v_amount, 0)
                    WHERE id = v_wallet_id;
                END IF;
                
                -- Create the reversal ledger entry
                INSERT INTO driver_wallet_transactions (
                    driver_id, booking_id, type, amount, balance_type, direction, status, description
                ) VALUES (
                    v_earning.driver_id, NEW.id, 'reversal', v_amount, v_earning.balance_type, 'debit', 'completed',
                    'Earnings reversed due to trip cancellation'
                );

                -- Update driver stats
                IF NEW.driver_id IS NOT NULL THEN
                    UPDATE drivers
                    SET total_earnings = GREATEST(total_earnings - v_amount, 0)
                    WHERE id = NEW.driver_id;
                END IF;
            END IF;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if any
DROP TRIGGER IF EXISTS trigger_booking_cancelled ON bookings;

-- Create the trigger
CREATE TRIGGER trigger_booking_cancelled
AFTER UPDATE ON bookings
FOR EACH ROW
EXECUTE FUNCTION on_booking_cancelled();
