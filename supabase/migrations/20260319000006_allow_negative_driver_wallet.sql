-- Allow negative driver wallet balances so cash-ride commission can be tracked
-- as driver liability instead of failing trip completion.
--
-- Intentionally does NOT change:
-- - pending_balance non-negative constraint
-- - total_earned / total_withdrawn fields
-- - application logic

-- Remove the non-negative constraint on available_balance
ALTER TABLE public.driver_wallets
DROP CONSTRAINT IF EXISTS driver_wallets_available_balance_check;

-- Add a reporting field for accumulated commission debt
ALTER TABLE public.driver_wallets
ADD COLUMN IF NOT EXISTS total_commission_owed numeric DEFAULT 0
CHECK (total_commission_owed >= 0::numeric);

-- Clarify the new meaning of available balance
COMMENT ON COLUMN public.driver_wallets.available_balance IS
'Can be negative. Negative balance means the driver owes commission to the platform.';

-- Index rows with debt for fast reporting / collections workflows
CREATE INDEX IF NOT EXISTS idx_drivers_negative_balance
ON public.driver_wallets (available_balance)
WHERE available_balance < 0::numeric;
