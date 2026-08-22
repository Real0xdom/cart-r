-- ============================================
-- CARTR: Fix sms_queue RLS Policy
-- Migration: fix_sms_queue_rls_policy.sql
-- Purpose: Allow authenticated users to INSERT into sms_queue
--          (required for Supabase Auth OTP verification)
--          while keeping SELECT/UPDATE/DELETE restricted to service role
-- ============================================

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Service role only for sms_queue" ON public.sms_queue;

-- Create new policies that allow INSERT from authenticated users
-- but keep other operations restricted to service role

-- Policy 1: Allow authenticated users to INSERT (needed for Auth OTP)
CREATE POLICY "Authenticated users can insert into sms_queue" ON public.sms_queue
  FOR INSERT 
  WITH CHECK (auth.role() = 'authenticated');

-- Policy 2: Only service role can SELECT from sms_queue
CREATE POLICY "Service role can select sms_queue" ON public.sms_queue
  FOR SELECT 
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Policy 3: Only service role can UPDATE sms_queue
CREATE POLICY "Service role can update sms_queue" ON public.sms_queue
  FOR UPDATE 
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- Policy 4: Only service role can DELETE from sms_queue
CREATE POLICY "Service role can delete from sms_queue" ON public.sms_queue
  FOR DELETE 
  USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================
-- Comments
-- ============================================
COMMENT ON POLICY "Authenticated users can insert into sms_queue" ON public.sms_queue IS 
'Allows authenticated users to insert SMS records (required by Supabase Auth for OTP tracking).';

COMMENT ON POLICY "Service role can select sms_queue" ON public.sms_queue IS 
'Restricts SMS queue reading to service role only (edge functions and admin operations).';

COMMENT ON POLICY "Service role can update sms_queue" ON public.sms_queue IS 
'Restricts SMS queue updates to service role only (edge functions processing the queue).';

COMMENT ON POLICY "Service role can delete from sms_queue" ON public.sms_queue IS 
'Restricts SMS queue deletion to service role only (admin cleanup operations).';
