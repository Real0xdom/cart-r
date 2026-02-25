-- Attach wallet-crediting triggers to bookings table
-- The trigger functions on_booking_payment_received and on_booking_completed
-- were defined in 20260224_fintech_wallet_system.sql but never attached as triggers.
-- This migration attaches them so driver wallets are automatically credited.

-- ============================================================
-- Trigger 1: on_booking_payment_received
-- Fires when payment_status changes to 'paid' (BEFORE trip completion)
-- Credits driver's pending_balance via credit_driver_earning
-- ============================================================
DROP TRIGGER IF EXISTS trg_booking_payment_received ON bookings;
CREATE TRIGGER trg_booking_payment_received
    AFTER UPDATE ON bookings
    FOR EACH ROW
    WHEN (NEW.payment_status = 'paid' AND (OLD.payment_status IS DISTINCT FROM 'paid'))
    EXECUTE FUNCTION on_booking_payment_received();

-- ============================================================
-- Trigger 2: on_booking_completed
-- Fires when status changes to 'completed'
-- For cash: credits directly to available_balance
-- For online: releases pending_balance to available_balance
-- Also updates driver stats (total_trips, total_earnings)
-- ============================================================
-- First drop the OLD trigger from migration 024 that only updated stats
DROP TRIGGER IF EXISTS on_booking_completed_update_stats ON bookings;

DROP TRIGGER IF EXISTS trg_booking_completed ON bookings;
CREATE TRIGGER trg_booking_completed
    AFTER UPDATE ON bookings
    FOR EACH ROW
    WHEN (NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed'))
    EXECUTE FUNCTION on_booking_completed();
