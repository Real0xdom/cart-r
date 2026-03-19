-- Migration: Terms & Conditions Acceptance Tracking
-- Description: Add tables and columns to track user acceptance of terms and conditions
-- Date: 2026-02-12

-- 1. Create table for terms acceptance history
CREATE TABLE IF NOT EXISTS public.user_terms_acceptance (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  terms_version varchar NOT NULL DEFAULT 'v1.0',
  accepted_at timestamptz NOT NULL DEFAULT now(),
  ip_address inet,
  user_agent text,
  device_info jsonb,
  CONSTRAINT user_terms_acceptance_unique UNIQUE(user_id, terms_version)
);

-- 2. Add terms acceptance columns to users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS terms_accepted boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz,
ADD COLUMN IF NOT EXISTS terms_version varchar DEFAULT 'v1.0';

-- 3. Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_terms_acceptance_user_id 
ON public.user_terms_acceptance(user_id);

CREATE INDEX IF NOT EXISTS idx_user_terms_acceptance_version 
ON public.user_terms_acceptance(terms_version);

-- 4. Enable RLS
ALTER TABLE public.user_terms_acceptance ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
-- 5. RLS Policies
DROP POLICY IF EXISTS "Users can view their own terms acceptance" ON public.user_terms_acceptance;
CREATE POLICY "Users can view their own terms acceptance"
ON public.user_terms_acceptance
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own terms acceptance" ON public.user_terms_acceptance;
CREATE POLICY "Users can insert their own terms acceptance"
ON public.user_terms_acceptance
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- 6. Function to record terms acceptance
CREATE OR REPLACE FUNCTION record_terms_acceptance(
  p_user_id uuid,
  p_terms_version varchar DEFAULT 'v1.0',
  p_ip_address inet DEFAULT NULL,
  p_user_agent text DEFAULT NULL,
  p_device_info jsonb DEFAULT NULL
) RETURNS boolean AS $$
BEGIN
  -- Insert into history table
  INSERT INTO user_terms_acceptance (
    user_id, 
    terms_version, 
    ip_address, 
    user_agent, 
    device_info
  )
  VALUES (
    p_user_id, 
    p_terms_version, 
    p_ip_address, 
    p_user_agent, 
    p_device_info
  )
  ON CONFLICT (user_id, terms_version) DO NOTHING;

  -- Update users table
  UPDATE users
  SET 
    terms_accepted = true,
    terms_accepted_at = now(),
    terms_version = p_terms_version
  WHERE id = p_user_id;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Function to check if user has accepted latest terms
CREATE OR REPLACE FUNCTION has_accepted_latest_terms(
  p_user_id uuid,
  p_required_version varchar DEFAULT 'v1.0'
) RETURNS boolean AS $$
DECLARE
  user_version varchar;
BEGIN
  SELECT terms_version INTO user_version
  FROM users
  WHERE id = p_user_id;

  RETURN user_version = p_required_version AND 
         EXISTS (
           SELECT 1 FROM user_terms_acceptance
           WHERE user_id = p_user_id 
           AND terms_version = p_required_version
         );
END;
$$ LANGUAGE plpgsql;

-- 8. Comments
COMMENT ON TABLE user_terms_acceptance IS 'Tracks user acceptance of terms and conditions with version history';
COMMENT ON FUNCTION record_terms_acceptance IS 'Records user acceptance of terms and conditions';
COMMENT ON FUNCTION has_accepted_latest_terms IS 'Checks if user has accepted the latest version of terms';
