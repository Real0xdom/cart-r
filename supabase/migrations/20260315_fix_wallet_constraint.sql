-- Fix driver_wallet_transactions table check constraint to include 'platform_fee'
-- This fixes the error: new row for relation "driver_wallet_transactions" violates check constraint "driver_wallet_transactions_type_check"
-- which happens during cash trip completion when commission is deducted from driver wallet.

-- 1. Update the check constraint
ALTER TABLE public.driver_wallet_transactions 
DROP CONSTRAINT IF EXISTS driver_wallet_transactions_type_check;

ALTER TABLE public.driver_wallet_transactions 
ADD CONSTRAINT driver_wallet_transactions_type_check 
CHECK (type = ANY (ARRAY['earning'::text, 'release'::text, 'withdrawal'::text, 'reversal'::text, 'adjustment'::text, 'payout_fee'::text, 'platform_fee'::text]));

-- 2. Clean up complete_trip_atomic to remove redundant logic handled by triggers.
-- This prevents double-crediting of driver earnings and ensures correct commission calculation.
DROP FUNCTION IF EXISTS public.complete_trip_atomic(uuid, text, boolean);

CREATE OR REPLACE FUNCTION public.complete_trip_atomic(p_booking_id uuid, p_payment_method text, p_force_complete boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_booking       bookings%ROWTYPE;
  v_already_paid  BOOLEAN;
BEGIN

  -- 1. Lock booking row (prevents concurrent double-completion)
  SELECT * INTO v_booking
  FROM bookings
  WHERE id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Booking not found');
  END IF;

  -- 2. Idempotency guard
  IF v_booking.status = 'completed' AND NOT p_force_complete THEN
    RETURN jsonb_build_object(
      'success',      true,
      'message',      'Already completed (idempotent)',
      'driver_payout', v_booking.driver_payout
    );
  END IF;

  -- 3. Status guard
  IF v_booking.status NOT IN ('in_progress', 'driver_arrived', 'completed') AND NOT p_force_complete THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Booking status is ' || v_booking.status || ', cannot complete'
    );
  END IF;

  -- 4. Detect if customer already paid online
  v_already_paid := v_booking.payment_status = 'paid'
                    AND v_booking.payment_method != 'cash';

  -- 5. Complete the booking 
  -- (This will trigger on_booking_completed which handles driver stats and wallet settlement via credit_driver_earning)
  UPDATE bookings SET
    status                = 'completed',
    completed_at          = COALESCE(completed_at, NOW()),
    delivery_confirmed_at = COALESCE(delivery_confirmed_at, NOW()),
    payment_status        = CASE WHEN v_already_paid THEN payment_status ELSE 'paid'::payment_status             END,
    payment_method        = CASE WHEN v_already_paid THEN payment_method ELSE p_payment_method::payment_method  END,
    updated_at            = NOW()
  WHERE id = p_booking_id;

  -- Refetch booking to get updated driver_payout (set by trigger)
  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id;

  -- 7. Return success payload
  RETURN jsonb_build_object(
    'success',        true,
    'booking_id',     p_booking_id,
    'driver_id',      v_booking.driver_id,
    'payment_method', CASE WHEN v_already_paid THEN v_booking.payment_method::text ELSE p_payment_method END,
    'driver_payout',  v_booking.driver_payout,
    'message',        'Trip completed successfully'
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'message', SQLERRM,
    'detail',  SQLSTATE
  );
END;
$function$;
