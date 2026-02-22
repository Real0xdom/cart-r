-- Refer and earn: referral_code on users + referrals table
-- Each user gets a unique shareable code; when a new user signs up with that code, we record the referral.

-- Add referral_code to users (unique, used in share links)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS referral_code character varying UNIQUE;

-- Backfill existing users with a random 8-char code
UPDATE public.users
SET referral_code = upper(substring(md5(gen_random_uuid()::text) from 1 for 8))
WHERE referral_code IS NULL;

-- Ensure new rows get a default
ALTER TABLE public.users
  ALTER COLUMN referral_code SET DEFAULT upper(substring(md5(gen_random_uuid()::text) from 1 for 8));

-- Not null after backfill
ALTER TABLE public.users
  ALTER COLUMN referral_code SET NOT NULL;

-- Referrals table: who referred whom, from which app
CREATE TABLE IF NOT EXISTS public.referrals (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL,
  referred_id uuid NOT NULL,
  referral_code_used character varying NOT NULL,
  source_app character varying NOT NULL CHECK (source_app IN ('customer_app', 'driver_app')),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT referrals_pkey PRIMARY KEY (id),
  CONSTRAINT referrals_referrer_id_fkey FOREIGN KEY (referrer_id) REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT referrals_referred_id_fkey FOREIGN KEY (referred_id) REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT referrals_referred_id_unique UNIQUE (referred_id)
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id ON public.referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred_id ON public.referrals(referred_id);

COMMENT ON TABLE public.referrals IS 'Tracks refer-and-earn: referrer_id is the user who shared the code, referred_id is the new user who signed up using it.';

-- RLS
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

-- Users can insert a referral only when they are the referred user (recording that they were referred)
CREATE POLICY "Users can insert referral when they are the referred"
  ON public.referrals FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = referred_id);

-- Users can read their own referrals (as referrer or referred)
CREATE POLICY "Users can read own referrals"
  ON public.referrals FOR SELECT
  TO authenticated
  USING (auth.uid() = referrer_id OR auth.uid() = referred_id);

-- Service role / admin can read all (admin app uses service role)
-- No policy for anon; authenticated only.
