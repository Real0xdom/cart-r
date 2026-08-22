ALTER TABLE driver_wallets
  DROP COLUMN IF EXISTS balance,
  ADD COLUMN IF NOT EXISTS available_balance NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pending_balance NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_earned NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_withdrawn NUMERIC(10,2) DEFAULT 0;

DROP TABLE IF EXISTS driver_wallet_transactions CASCADE;

CREATE TABLE IF NOT EXISTS driver_wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID REFERENCES drivers(id),
  booking_id UUID REFERENCES bookings(id),
  amount NUMERIC(10,2) NOT NULL,
  type VARCHAR(50) NOT NULL,
  balance_type VARCHAR(50),
  direction VARCHAR(20),
  description TEXT,
  reference_id TEXT,
  status VARCHAR(50) DEFAULT 'completed',
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
