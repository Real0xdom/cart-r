-- Add wallet balance to users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS balance numeric DEFAULT 0.00;

-- Create wallet_transactions table for tracking all wallet operations
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  amount numeric NOT NULL,
  type varchar NOT NULL CHECK (type IN ('credit', 'debit')),
  status varchar DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  payment_order_id varchar,
  booking_id uuid,
  description text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT wallet_transactions_pkey PRIMARY KEY (id),
  CONSTRAINT wallet_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT wallet_transactions_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user_id ON public.wallet_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_payment_order_id ON public.wallet_transactions(payment_order_id);

-- Enable RLS
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own transactions
CREATE POLICY "Users can view own wallet transactions" ON public.wallet_transactions
  FOR SELECT USING (auth.uid() = user_id);

-- Policy: Service role can insert/update transactions  
CREATE POLICY "Service role can manage wallet transactions" ON public.wallet_transactions
  FOR ALL USING (auth.role() = 'service_role');
