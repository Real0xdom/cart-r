-- Atomically credit a driver's wallet from an online top-up order.
-- Uses wallet_transactions for order idempotency/locking and writes the
-- driver-visible ledger entry into driver_wallet_transactions.

CREATE OR REPLACE FUNCTION public.atomic_credit_driver_wallet_topup_idempotent(
  p_user_id uuid,
  p_amount numeric,
  p_order_id text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_txn_id uuid;
  v_status text;
  v_driver_id uuid;
BEGIN
  -- Lock the top-up tracking transaction to prevent double-crediting.
  SELECT id, status
  INTO v_txn_id, v_status
  FROM public.wallet_transactions
  WHERE payment_order_id = p_order_id
  FOR UPDATE;

  IF NOT FOUND OR v_status = 'completed' THEN
    RETURN FALSE;
  END IF;

  SELECT id
  INTO v_driver_id
  FROM public.drivers
  WHERE user_id = p_user_id
  LIMIT 1;

  IF v_driver_id IS NULL THEN
    RAISE EXCEPTION 'Driver profile not found for user %', p_user_id;
  END IF;

  PERFORM public.ensure_driver_wallet(v_driver_id);

  UPDATE public.driver_wallets
  SET
    available_balance = available_balance + p_amount,
    total_commission_owed = GREATEST(COALESCE(total_commission_owed, 0) - p_amount, 0),
    updated_at = NOW()
  WHERE driver_id = v_driver_id;

  INSERT INTO public.driver_wallet_transactions (
    driver_id,
    type,
    amount,
    balance_type,
    direction,
    status,
    reference_id,
    description,
    metadata
  ) VALUES (
    v_driver_id,
    'adjustment',
    p_amount,
    'available',
    'credit',
    'completed',
    p_order_id,
    'Wallet recharge via online payment',
    jsonb_build_object(
      'source', 'driver_wallet_topup',
      'order_id', p_order_id,
      'user_id', p_user_id
    )
  );

  UPDATE public.wallet_transactions
  SET
    status = 'completed',
    description = CASE
      WHEN description = 'Driver wallet top-up' THEN 'Driver wallet top-up via online'
      ELSE description
    END,
    updated_at = NOW()
  WHERE id = v_txn_id;

  RETURN TRUE;
END;
$$;
