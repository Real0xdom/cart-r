-- Collapse online-ride release events into the original earning row so
-- the driver wallet history shows one trip entry that moves from pending
-- to available instead of rendering duplicate records.

-- Backfill existing earning + release pairs.
WITH release_pairs AS (
  SELECT
    earning.id AS earning_id,
    release.id AS release_id,
    release.created_at AS released_at,
    release.description AS release_description
  FROM public.driver_wallet_transactions AS earning
  JOIN LATERAL (
    SELECT r.id, r.created_at, r.description
    FROM public.driver_wallet_transactions AS r
    WHERE r.booking_id = earning.booking_id
      AND r.driver_id = earning.driver_id
      AND r.type = 'release'
    ORDER BY r.created_at DESC
    LIMIT 1
  ) AS release ON true
  WHERE earning.type = 'earning'
    AND earning.balance_type = 'pending'
)
UPDATE public.driver_wallet_transactions AS earning
SET
  balance_type = 'available',
  description = COALESCE(release_pairs.release_description, 'Trip earning credited to your wallet.'),
  metadata = COALESCE(earning.metadata, '{}'::jsonb)
    || jsonb_build_object(
      'released_at', release_pairs.released_at,
      'released_from_pending', true
    )
FROM release_pairs
WHERE earning.id = release_pairs.earning_id;

DELETE FROM public.driver_wallet_transactions AS release
USING (
  SELECT DISTINCT release_id
  FROM (
    SELECT
      release.id AS release_id
    FROM public.driver_wallet_transactions AS earning
    JOIN LATERAL (
      SELECT r.id
      FROM public.driver_wallet_transactions AS r
      WHERE r.booking_id = earning.booking_id
        AND r.driver_id = earning.driver_id
        AND r.type = 'release'
      ORDER BY r.created_at DESC
      LIMIT 1
    ) AS release ON true
    WHERE earning.type = 'earning'
  ) matched
) AS release_pairs
WHERE release.id = release_pairs.release_id;

CREATE OR REPLACE FUNCTION public.release_pending_earning(p_booking_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_earning RECORD;
  v_wallet_id uuid;
BEGIN
  SELECT dwt.id, dwt.driver_id, dwt.amount
  INTO v_earning
  FROM public.driver_wallet_transactions AS dwt
  WHERE dwt.booking_id = p_booking_id
    AND dwt.type = 'earning'
    AND dwt.balance_type = 'pending'
  ORDER BY dwt.created_at DESC
  LIMIT 1;

  IF v_earning.id IS NULL THEN
    IF EXISTS (
      SELECT 1
      FROM public.driver_wallet_transactions
      WHERE booking_id = p_booking_id
        AND type = 'earning'
        AND balance_type = 'available'
    ) THEN
      RETURN jsonb_build_object('success', true, 'message', 'Already released');
    END IF;

    RETURN jsonb_build_object('success', true, 'message', 'No pending earning to release');
  END IF;

  SELECT id
  INTO v_wallet_id
  FROM public.driver_wallets
  WHERE driver_id = v_earning.driver_id;

  UPDATE public.driver_wallets
  SET
    pending_balance = GREATEST(pending_balance - v_earning.amount, 0),
    available_balance = available_balance + v_earning.amount,
    updated_at = now()
  WHERE id = v_wallet_id;

  UPDATE public.driver_wallet_transactions
  SET
    balance_type = 'available',
    description = 'Trip earning credited to your wallet.',
    metadata = COALESCE(metadata, '{}'::jsonb)
      || jsonb_build_object(
        'released_at', now(),
        'released_from_pending', true
      )
  WHERE id = v_earning.id;

  RETURN jsonb_build_object('success', true, 'released', v_earning.amount);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
