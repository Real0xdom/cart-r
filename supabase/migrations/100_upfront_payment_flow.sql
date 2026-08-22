-- Migration: Add upfront payment flow support
-- Run this on Supabase SQL editor before any code changes

-- Add new booking statuses for upfront payment flow
ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'payment_pending';
ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'payment_confirmed';

-- Add columns for Cashfree payment tracking
ALTER TABLE bookings 
  ADD COLUMN IF NOT EXISTS cashfree_order_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS payment_initiated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refund_preference VARCHAR(20) DEFAULT 'bank';

-- Add index for Cashfree order lookups
CREATE INDEX IF NOT EXISTS idx_bookings_cashfree_order_id ON bookings(cashfree_order_id);

-- (Index moved to 101_upfront_payment_flow_index.sql to avoid transaction error)

COMMENT ON COLUMN bookings.cashfree_order_id IS 'Cashfree order ID for upfront payment tracking';
COMMENT ON COLUMN bookings.payment_initiated_at IS 'When payment was initiated (for timeout handling)';
COMMENT ON COLUMN bookings.refund_preference IS 'Customer preference for no-driver refunds: wallet or bank';
