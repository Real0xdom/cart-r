CREATE TABLE IF NOT EXISTS platform_settings (
  key TEXT PRIMARY KEY,
  value JSONB,
  description TEXT,
  is_public BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS driver_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID REFERENCES drivers(id) NOT NULL UNIQUE,
  available_balance NUMERIC(10,2) DEFAULT 0,
  pending_balance NUMERIC(10,2) DEFAULT 0,
  total_earned NUMERIC(10,2) DEFAULT 0,
  total_withdrawn NUMERIC(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS driver_wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID REFERENCES driver_wallets(id) NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  type VARCHAR(50) NOT NULL,
  description TEXT,
  reference_id TEXT,
  status VARCHAR(50) DEFAULT 'completed',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE drivers 
ADD COLUMN IF NOT EXISTS beneficiary_id TEXT,
ADD COLUMN IF NOT EXISTS beneficiary_status TEXT;

ALTER TABLE withdrawals 
ADD COLUMN IF NOT EXISTS wallet_id UUID REFERENCES driver_wallets(id),
ADD COLUMN IF NOT EXISTS payout_id TEXT,
ADD COLUMN IF NOT EXISTS payout_status TEXT,
ADD COLUMN IF NOT EXISTS payout_details JSONB;
