-- Driver wallet production monitoring queries
-- Run these against staging or production after deployment.

-- 1. Drivers with unusually large negative balances.
SELECT
  d.id,
  u.name,
  dw.available_balance,
  dw.total_commission_owed,
  d.status,
  d.is_online,
  dw.updated_at
FROM public.drivers d
JOIN public.users u ON u.id = d.user_id
JOIN public.driver_wallets dw ON dw.driver_id = d.id
WHERE dw.available_balance < -500
ORDER BY dw.available_balance ASC;

-- 2. Commission discrepancy check using booking-specific ledger evidence,
-- not a hardcoded global 15% assumption.
WITH booking_commission AS (
  SELECT
    b.id AS booking_id,
    b.completed_at,
    b.total_fare,
    b.driver_payout,
    fee.amount AS ledger_platform_fee,
    COALESCE(
      (fee.metadata->>'commission_rate')::numeric,
      (earn.metadata->>'commission_rate')::numeric
    ) AS applied_rate,
    COALESCE(
      (fee.metadata->>'gross_fare')::numeric,
      (earn.metadata->>'gross_fare')::numeric,
      b.total_fare
    ) AS gross_fare_source
  FROM public.bookings b
  LEFT JOIN public.driver_wallet_transactions fee
    ON fee.booking_id = b.id
   AND fee.type = 'platform_fee'
  LEFT JOIN public.driver_wallet_transactions earn
    ON earn.booking_id = b.id
   AND earn.type = 'earning'
  WHERE b.status = 'completed'
    AND b.completed_at > now() - interval '24 hours'
)
SELECT
  booking_id,
  completed_at,
  total_fare,
  driver_payout,
  ledger_platform_fee,
  applied_rate,
  ROUND(gross_fare_source * (applied_rate / 100.0), 2) AS expected_platform_fee,
  ABS(COALESCE(ledger_platform_fee, total_fare - COALESCE(driver_payout, 0)) - ROUND(gross_fare_source * (applied_rate / 100.0), 2)) AS fee_delta
FROM booking_commission
WHERE applied_rate IS NOT NULL
  AND ABS(COALESCE(ledger_platform_fee, total_fare - COALESCE(driver_payout, 0)) - ROUND(gross_fare_source * (applied_rate / 100.0), 2)) > 1
ORDER BY completed_at DESC;

-- 3. Failed wallet or driver-wallet transactions in the last 24 hours.
SELECT
  payment_order_id,
  user_id,
  amount,
  type,
  status,
  description,
  updated_at
FROM public.wallet_transactions
WHERE status = 'failed'
  AND created_at > now() - interval '24 hours'
ORDER BY created_at DESC;

SELECT
  driver_id,
  booking_id,
  reference_id,
  type,
  amount,
  status,
  description,
  created_at
FROM public.driver_wallet_transactions
WHERE status = 'failed'
  AND created_at > now() - interval '24 hours'
ORDER BY created_at DESC;

-- 4. Drivers still carrying pending balances more than 24 hours after credit.
SELECT
  dw.driver_id,
  dw.pending_balance,
  COUNT(dwt.id) AS pending_transactions,
  MIN(dwt.created_at) AS oldest_pending_credit
FROM public.driver_wallets dw
JOIN public.driver_wallet_transactions dwt
  ON dwt.driver_id = dw.driver_id
WHERE dwt.balance_type = 'pending'
  AND dwt.status = 'completed'
  AND dwt.created_at < now() - interval '24 hours'
GROUP BY dw.driver_id, dw.pending_balance
HAVING dw.pending_balance > 0
ORDER BY oldest_pending_credit ASC;

-- 5. Duplicate top-up credit detection by payment order id.
SELECT
  reference_id,
  COUNT(*) AS ledger_entries,
  SUM(amount) AS total_credited,
  MIN(created_at) AS first_seen_at,
  MAX(created_at) AS last_seen_at
FROM public.driver_wallet_transactions
WHERE metadata->>'source' = 'driver_wallet_topup'
  AND created_at > now() - interval '7 days'
GROUP BY reference_id
HAVING COUNT(*) > 1
ORDER BY last_seen_at DESC;
