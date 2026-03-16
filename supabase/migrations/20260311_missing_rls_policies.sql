-- ============================================
-- CARTR Production Readiness: Missing RLS Policies
-- Migration: 20260311_missing_rls_policies.sql
-- Adds RLS to tables that were missing coverage
-- ============================================

-- ============================================
-- 1. ADMINS TABLE (admin credentials - lock down tight)
-- ============================================
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

-- Only service role can access admin credentials
CREATE POLICY "Service role only for admins" ON public.admins
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================
-- 2. ADMIN TABLE (legacy admin table)
-- ============================================
ALTER TABLE public.admin ENABLE ROW LEVEL SECURITY;

-- Only service role can access
CREATE POLICY "Service role only for admin" ON public.admin
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================
-- 3. DRIVER_WALLETS TABLE
-- ============================================
ALTER TABLE public.driver_wallets ENABLE ROW LEVEL SECURITY;

-- Drivers can read their own wallet
CREATE POLICY "Drivers can read own wallet" ON public.driver_wallets
  FOR SELECT USING (
    driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid())
  );

-- Only service role can modify wallets (prevents manipulation)
CREATE POLICY "Service role full access to driver_wallets" ON public.driver_wallets
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================
-- 4. DRIVER_WALLET_TRANSACTIONS TABLE
-- ============================================
ALTER TABLE public.driver_wallet_transactions ENABLE ROW LEVEL SECURITY;

-- Drivers can read their own transactions
CREATE POLICY "Drivers can read own wallet transactions" ON public.driver_wallet_transactions
  FOR SELECT USING (
    driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid())
  );

-- Only service role can create/modify transactions
CREATE POLICY "Service role full access to driver_wallet_transactions" ON public.driver_wallet_transactions
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================
-- 5. EXPANSION_INTERESTS TABLE
-- ============================================
ALTER TABLE public.expansion_interests ENABLE ROW LEVEL SECURITY;

-- Users can create their own expansion interests
CREATE POLICY "Users can create expansion interests" ON public.expansion_interests
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Users can read their own expansion interests
CREATE POLICY "Users can read own expansion interests" ON public.expansion_interests
  FOR SELECT USING (user_id = auth.uid());

-- Service role full access (admin analytics)
CREATE POLICY "Service role full access to expansion_interests" ON public.expansion_interests
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================
-- 6. PLATFORM_SETTINGS TABLE
-- ============================================
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- Public settings can be read by all authenticated users
CREATE POLICY "Authenticated users can read public settings" ON public.platform_settings
  FOR SELECT USING (
    is_public = true AND auth.role() = 'authenticated'
  );

-- Only service role can manage all settings
CREATE POLICY "Service role full access to platform_settings" ON public.platform_settings
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================
-- 7. RIDES TABLE (appears to be legacy/unused)
-- ============================================
ALTER TABLE public.rides ENABLE ROW LEVEL SECURITY;

-- Users can read their own rides
CREATE POLICY "Users can read own rides" ON public.rides
  FOR SELECT USING (user_id = auth.uid());

-- Service role full access
CREATE POLICY "Service role full access to rides" ON public.rides
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================
-- 8. SMS_QUEUE TABLE
-- ============================================
ALTER TABLE public.sms_queue ENABLE ROW LEVEL SECURITY;

-- Only service role can access SMS queue (edge functions only)
CREATE POLICY "Service role only for sms_queue" ON public.sms_queue
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================
-- 9. VEHICLE_MODELS TABLE
-- ============================================
ALTER TABLE public.vehicle_models ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read vehicle models
CREATE POLICY "Authenticated users can read vehicle models" ON public.vehicle_models
  FOR SELECT USING (auth.role() = 'authenticated');

-- Only service role can manage vehicle models
CREATE POLICY "Service role full access to vehicle_models" ON public.vehicle_models
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
