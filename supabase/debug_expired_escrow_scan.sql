-- Debug script: find bookings whose search expired but wallet escrow is still held.
-- Usage in Supabase SQL editor:
-- 1. Run as-is to list stuck bookings.
-- 2. Optionally uncomment the last query blocks for deeper wallet/refund inspection.

SELECT
  b.id,
  b.booking_number,
  b.customer_id,
  b.status,
  b.payment_status,
  b.payment_method,
  b.expires_at,
  b.cancelled_at,
  b.cancellation_reason,
  b.refund_status,
  b.refund_amount,
  b.refund_reason,
  b.refund_error,
  b.wallet_amount_used,
  b.wallet_escrow_amount,
  b.wallet_escrow_status,
  b.wallet_escrow_held_at,
  b.wallet_escrow_refunded_at,
  b.created_at,
  b.updated_at
FROM public.bookings AS b
WHERE b.driver_id IS NULL
  AND b.expires_at IS NOT NULL
  AND b.expires_at < now()
  AND COALESCE(b.wallet_escrow_amount, 0) > 0
  AND COALESCE(b.wallet_escrow_status, 'none') = 'held'
ORDER BY b.expires_at ASC;

-- Recent refund-related wallet transactions for the affected bookings
-- SELECT
--   wt.created_at,
--   wt.user_id,
--   wt.booking_id,
--   wt.payment_order_id,
--   wt.type,
--   wt.status,
--   wt.amount,
--   wt.description
-- FROM public.wallet_transactions AS wt
-- WHERE wt.booking_id IN (
--   SELECT b.id
--   FROM public.bookings AS b
--   WHERE b.driver_id IS NULL
--     AND b.expires_at IS NOT NULL
--     AND b.expires_at < now()
--     AND COALESCE(b.wallet_escrow_amount, 0) > 0
--     AND COALESCE(b.wallet_escrow_status, 'none') = 'held'
-- )
-- ORDER BY wt.created_at DESC;

