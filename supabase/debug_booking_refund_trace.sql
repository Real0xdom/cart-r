-- Debug script: trace one booking's escrow/refund lifecycle.
-- Replace the UUID below before running in Supabase SQL editor.

WITH target AS (
  SELECT '00000000-0000-0000-0000-000000000000'::uuid AS booking_id
)
SELECT
  b.id,
  b.booking_number,
  b.customer_id,
  b.driver_id,
  b.status,
  b.payment_status,
  b.payment_method,
  b.total_fare,
  b.quoted_total_fare,
  b.wallet_amount_used,
  b.wallet_escrow_amount,
  b.wallet_escrow_status,
  b.wallet_escrow_held_at,
  b.wallet_escrow_released_at,
  b.wallet_escrow_refunded_at,
  b.expires_at,
  b.cancelled_at,
  b.cancelled_by,
  b.cancellation_reason,
  b.refund_status,
  b.refund_amount,
  b.refund_reason,
  b.refund_source,
  b.refund_error,
  b.refund_initiated_at,
  b.refund_completed_at,
  b.created_at,
  b.updated_at
FROM public.bookings AS b
JOIN target t
  ON b.id = t.booking_id;

SELECT
  wt.created_at,
  wt.user_id,
  wt.booking_id,
  wt.payment_order_id,
  wt.type,
  wt.status,
  wt.amount,
  wt.description
FROM public.wallet_transactions AS wt
JOIN target t
  ON wt.booking_id = t.booking_id
ORDER BY wt.created_at ASC;

SELECT
  n.created_at,
  n.user_id,
  n.title,
  n.body,
  n.notification_type,
  n.data
FROM public.notifications AS n
JOIN target t
  ON (n.data ->> 'booking_id')::uuid = t.booking_id
ORDER BY n.created_at ASC;

