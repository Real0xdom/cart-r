-- Record how much of each driver wallet top-up was used to recover
-- outstanding commission debt, so admin finance can report it accurately.

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
  v_commission_owed_before numeric := 0;
  v_commission_owed_after numeric := 0;
  v_available_balance_before numeric := 0;
  v_available_balance_after numeric := 0;
  v_debt_applied_amount numeric := 0;
  v_wallet_credit_after_debt numeric := 0;
BEGIN
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

  SELECT
    COALESCE(available_balance, 0),
    COALESCE(total_commission_owed, 0)
  INTO
    v_available_balance_before,
    v_commission_owed_before
  FROM public.driver_wallets
  WHERE driver_id = v_driver_id
  FOR UPDATE;

  v_debt_applied_amount := LEAST(v_commission_owed_before, p_amount);
  v_wallet_credit_after_debt := p_amount - v_debt_applied_amount;

  UPDATE public.driver_wallets
  SET
    available_balance = available_balance + p_amount,
    total_commission_owed = GREATEST(COALESCE(total_commission_owed, 0) - p_amount, 0),
    updated_at = NOW()
  WHERE driver_id = v_driver_id
  RETURNING
    available_balance,
    COALESCE(total_commission_owed, 0)
  INTO
    v_available_balance_after,
    v_commission_owed_after;

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
    CASE
      WHEN v_debt_applied_amount > 0 THEN 'Wallet recharge via online payment with commission recovery'
      ELSE 'Wallet recharge via online payment'
    END,
    jsonb_build_object(
      'source', 'driver_wallet_topup',
      'order_id', p_order_id,
      'user_id', p_user_id,
      'topup_amount', p_amount,
      'debt_applied_amount', v_debt_applied_amount,
      'wallet_credit_after_debt', v_wallet_credit_after_debt,
      'commission_owed_before', v_commission_owed_before,
      'commission_owed_after', v_commission_owed_after,
      'available_balance_before', v_available_balance_before,
      'available_balance_after', v_available_balance_after
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
