-- Migration: Create driver_verification_history table
-- This table tracks verification actions (submit, approve, reject, resubmit) for drivers

CREATE TABLE IF NOT EXISTS public.driver_verification_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('submitted', 'approved', 'rejected', 'resubmitted')),
  rejection_reason TEXT,
  document_snapshot JSONB, -- Stores document URLs and details at time of action
  admin_id uuid,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT driver_verification_history_pkey PRIMARY KEY (id),
  CONSTRAINT driver_verification_history_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.drivers(id) ON DELETE CASCADE,
  CONSTRAINT driver_verification_history_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.users(id)
);

-- Create index for faster lookups by driver_id
CREATE INDEX IF NOT EXISTS idx_driver_verification_history_driver_id 
ON public.driver_verification_history(driver_id);

-- Create index for ordering by created_at
CREATE INDEX IF NOT EXISTS idx_driver_verification_history_created_at 
ON public.driver_verification_history(created_at DESC);

-- Enable RLS
ALTER TABLE public.driver_verification_history ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated users to read their own history (for drivers)
CREATE POLICY "Drivers can view own verification history"
ON public.driver_verification_history
FOR SELECT
USING (
  driver_id IN (
    SELECT id FROM public.drivers WHERE user_id = auth.uid()
  )
);

-- Policy: Allow service role full access (for admin operations)
CREATE POLICY "Service role has full access to verification history"
ON public.driver_verification_history
FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role')
WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- Add comment to table
COMMENT ON TABLE public.driver_verification_history IS 'Tracks verification actions for driver applications including rejections and resubmissions';
