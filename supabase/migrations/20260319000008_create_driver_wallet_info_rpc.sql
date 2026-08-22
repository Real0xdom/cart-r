-- Replace get_driver_wallet_info with a richer wallet summary payload
-- for driver wallet screens and debt/recharge visibility.

CREATE OR REPLACE FUNCTION public.get_driver_wallet_info(p_driver_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_wallet public.driver_wallets%ROWTYPE;
  v_driver public.drivers%ROWTYPE;
  v_recent_transactions jsonb;
  v_stats jsonb;
  v_pending_withdrawals numeric;
BEGIN
  -- Get wallet data
  SELECT *
  INTO v_wallet
  FROM public.driver_wallets
  WHERE driver_id = p_driver_id;

  -- If no wallet exists yet, create one first
  IF NOT FOUND THEN
    PERFORM public.ensure_driver_wallet(p_driver_id);

    SELECT *
    INTO v_wallet
    FROM public.driver_wallets
    WHERE driver_id = p_driver_id;
  END IF;

  SELECT *
  INTO v_driver
  FROM public.drivers
  WHERE id = p_driver_id;

  SELECT COALESCE(SUM(amount), 0)
  INTO v_pending_withdrawals
  FROM public.withdrawals
  WHERE driver_id = p_driver_id
    AND status = 'pending';

  -- Get recent transactions (last 10)
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', t.id,
      'type', t.type,
      'amount', t.amount,
      'direction', t.direction,
      'balance_type', t.balance_type,
      'description', t.description,
      'created_at', t.created_at,
      'booking_id', t.booking_id,
      'metadata', t.metadata
    )
    ORDER BY t.created_at DESC
  )
  INTO v_recent_transactions
  FROM (
    SELECT *
    FROM public.driver_wallet_transactions
    WHERE driver_id = p_driver_id
    ORDER BY created_at DESC
    LIMIT 10
  ) t;

  -- Calculate summary stats
  SELECT jsonb_build_object(
    'total_rides_completed', COUNT(*) FILTER (WHERE type = 'earning'),
    'total_earned_this_month', COALESCE(SUM(amount) FILTER (
      WHERE type = 'earning'
        AND direction = 'credit'
        AND created_at >= date_trunc('month', now())
    ), 0),
    'total_commission_paid', COALESCE(SUM(amount) FILTER (
      WHERE type = 'platform_fee'
    ), 0),
    'pending_withdrawals', (
      SELECT v_pending_withdrawals
    )
  )
  INTO v_stats
  FROM public.driver_wallet_transactions
  WHERE driver_id = p_driver_id;

  RETURN jsonb_build_object(
    'wallet', jsonb_build_object(
      'id', v_wallet.id,
      'available_balance', v_wallet.available_balance,
      'pending_balance', v_wallet.pending_balance,
      'total_earned', v_wallet.total_earned,
      'total_withdrawn', v_wallet.total_withdrawn,
      'total_commission_owed', COALESCE(v_wallet.total_commission_owed, 0),
      'pending_withdrawals', COALESCE(v_pending_withdrawals, 0),
      'bank_details', v_driver.bank_details,
      'beneficiary_status', v_driver.beneficiary_status,
      'verification_status', v_driver.verification_status,
      'has_negative_balance', v_wallet.available_balance < 0,
      'requires_recharge', v_wallet.available_balance < -100,
      'updated_at', v_wallet.updated_at
    ),
    'recent_transactions', COALESCE(v_recent_transactions, '[]'::jsonb),
    'stats', COALESCE(v_stats, '{}'::jsonb)
  );
END;
$$;
