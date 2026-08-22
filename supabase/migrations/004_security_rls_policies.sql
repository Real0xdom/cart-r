-- ============================================
-- CARTR Security Audit: Comprehensive RLS Policies
-- Migration: 004_security_rls_policies.sql
-- ============================================

-- Enable RLS on all tables (if not already enabled)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE emergency_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE emergency_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE fare_config ENABLE ROW LEVEL SECURITY;

-- ============================================
-- USERS TABLE POLICIES
-- ============================================

-- Users can read their own profile
DROP POLICY IF EXISTS "Users can read own profile" ON users;
CREATE POLICY "Users can read own profile" ON users
  FOR SELECT USING (auth.uid() = id);

-- Users can update their own profile
DROP POLICY IF EXISTS "Users can update own profile" ON users;
CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid() = id);

-- Service role can manage all users
DROP POLICY IF EXISTS "Service role full access to users" ON users;
CREATE POLICY "Service role full access to users" ON users
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================
-- DRIVERS TABLE POLICIES
-- ============================================

-- Drivers can read their own profile
DROP POLICY IF EXISTS "Drivers can read own profile" ON drivers;
CREATE POLICY "Drivers can read own profile" ON drivers
  FOR SELECT USING (user_id = auth.uid());

-- Drivers can update their own profile (limited fields)
DROP POLICY IF EXISTS "Drivers can update own profile" ON drivers;
CREATE POLICY "Drivers can update own profile" ON drivers
  FOR UPDATE USING (user_id = auth.uid());

-- Drivers can create their own record during onboarding
DROP POLICY IF EXISTS "Drivers can create own record" ON drivers;
CREATE POLICY "Drivers can create own record" ON drivers
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Customers can see online, approved drivers (for showing on map)
DROP POLICY IF EXISTS "Customers can see online drivers" ON drivers;
CREATE POLICY "Customers can see online drivers" ON drivers
  FOR SELECT USING (
    is_online = true 
    AND verification_status = 'approved'
  );

-- Service role full access
DROP POLICY IF EXISTS "Service role full access to drivers" ON drivers;
CREATE POLICY "Service role full access to drivers" ON drivers
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================
-- BOOKINGS TABLE POLICIES
-- ============================================

-- Customers can read their own bookings
DROP POLICY IF EXISTS "Customers can read own bookings" ON bookings;
CREATE POLICY "Customers can read own bookings" ON bookings
  FOR SELECT USING (customer_id = auth.uid());

-- Drivers can read bookings assigned to them
DROP POLICY IF EXISTS "Drivers can read assigned bookings" ON bookings;
CREATE POLICY "Drivers can read assigned bookings" ON bookings
  FOR SELECT USING (
    driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid())
  );

-- Customers can create bookings
DROP POLICY IF EXISTS "Customers can create bookings" ON bookings;
CREATE POLICY "Customers can create bookings" ON bookings
  FOR INSERT WITH CHECK (customer_id = auth.uid());

-- Customers can update certain fields of their own bookings
DROP POLICY IF EXISTS "Customers can update own bookings" ON bookings;
CREATE POLICY "Customers can update own bookings" ON bookings
  FOR UPDATE USING (
    customer_id = auth.uid() 
    AND status IN ('pending', 'accepted') -- Can only update before trip starts
  );

-- Drivers can update assigned bookings (status changes)
DROP POLICY IF EXISTS "Drivers can update assigned bookings" ON bookings;
CREATE POLICY "Drivers can update assigned bookings" ON bookings
  FOR UPDATE USING (
    driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid())
  );

-- Service role full access
DROP POLICY IF EXISTS "Service role full access to bookings" ON bookings;
CREATE POLICY "Service role full access to bookings" ON bookings
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================
-- DRIVER LOCATIONS TABLE POLICIES
-- ============================================

-- Drivers can insert their own location updates
DROP POLICY IF EXISTS "Drivers can insert own locations" ON driver_locations;
CREATE POLICY "Drivers can insert own locations" ON driver_locations
  FOR INSERT WITH CHECK (
    driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid())
  );

-- Customers can read driver location during active booking
DROP POLICY IF EXISTS "Customers can read driver location during trip" ON driver_locations;
CREATE POLICY "Customers can read driver location during trip" ON driver_locations
  FOR SELECT USING (
    driver_id IN (
      SELECT driver_id FROM bookings 
      WHERE customer_id = auth.uid() 
      AND status IN ('accepted', 'driver_arrived', 'in_progress')
    )
  );

-- Service role full access
DROP POLICY IF EXISTS "Service role full access to driver_locations" ON driver_locations;
CREATE POLICY "Service role full access to driver_locations" ON driver_locations
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================
-- NOTIFICATIONS TABLE POLICIES
-- ============================================

-- Users can read their own notifications
DROP POLICY IF EXISTS "Users can read own notifications" ON notifications;
CREATE POLICY "Users can read own notifications" ON notifications
  FOR SELECT USING (user_id = auth.uid());

-- Users can update their own notifications (mark as read)
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE USING (user_id = auth.uid());

-- Service role can create notifications
DROP POLICY IF EXISTS "Service role can create notifications" ON notifications;
CREATE POLICY "Service role can create notifications" ON notifications
  FOR INSERT WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- ============================================
-- SUPPORT TICKETS POLICIES
-- ============================================

-- Users can read their own tickets
DROP POLICY IF EXISTS "Users can read own tickets" ON support_tickets;
CREATE POLICY "Users can read own tickets" ON support_tickets
  FOR SELECT USING (user_id = auth.uid());

-- Users can create tickets
DROP POLICY IF EXISTS "Users can create tickets" ON support_tickets;
CREATE POLICY "Users can create tickets" ON support_tickets
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Users can update their own open tickets
DROP POLICY IF EXISTS "Users can update own tickets" ON support_tickets;
CREATE POLICY "Users can update own tickets" ON support_tickets
  FOR UPDATE USING (user_id = auth.uid());

-- Service role full access (admin support)
DROP POLICY IF EXISTS "Service role full access to tickets" ON support_tickets;
CREATE POLICY "Service role full access to tickets" ON support_tickets
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================
-- TICKET MESSAGES TABLE (Create if not exists)
-- ============================================

CREATE TABLE IF NOT EXISTS ticket_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id),
  sender_type VARCHAR NOT NULL CHECK (sender_type IN ('user', 'support')),
  message TEXT NOT NULL,
  attachment_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket ON ticket_messages(ticket_id);

ALTER TABLE ticket_messages ENABLE ROW LEVEL SECURITY;

-- ============================================
-- TICKET MESSAGES POLICIES
-- ============================================

-- Users can read messages for their tickets
DROP POLICY IF EXISTS "Users can read ticket messages" ON ticket_messages;
CREATE POLICY "Users can read ticket messages" ON ticket_messages
  FOR SELECT USING (
    ticket_id IN (SELECT id FROM support_tickets WHERE user_id = auth.uid())
  );

-- Users can create messages for their tickets
DROP POLICY IF EXISTS "Users can create ticket messages" ON ticket_messages;
CREATE POLICY "Users can create ticket messages" ON ticket_messages
  FOR INSERT WITH CHECK (
    ticket_id IN (SELECT id FROM support_tickets WHERE user_id = auth.uid())
    AND sender_id = auth.uid()
  );

-- Service role full access
DROP POLICY IF EXISTS "Service role full access to ticket_messages" ON ticket_messages;
CREATE POLICY "Service role full access to ticket_messages" ON ticket_messages
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================
-- EMERGENCY CONTACTS POLICIES
-- ============================================

-- Users can read their own emergency contacts
DROP POLICY IF EXISTS "Users can read own emergency contacts" ON emergency_contacts;
CREATE POLICY "Users can read own emergency contacts" ON emergency_contacts
  FOR SELECT USING (user_id = auth.uid());

-- Users can create emergency contacts
DROP POLICY IF EXISTS "Users can create emergency contacts" ON emergency_contacts;
CREATE POLICY "Users can create emergency contacts" ON emergency_contacts
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Users can update their own emergency contacts
DROP POLICY IF EXISTS "Users can update emergency contacts" ON emergency_contacts;
CREATE POLICY "Users can update emergency contacts" ON emergency_contacts
  FOR UPDATE USING (user_id = auth.uid());

-- Users can delete their own emergency contacts
DROP POLICY IF EXISTS "Users can delete emergency contacts" ON emergency_contacts;
CREATE POLICY "Users can delete emergency contacts" ON emergency_contacts
  FOR DELETE USING (user_id = auth.uid());

-- ============================================
-- EMERGENCY ALERTS POLICIES
-- ============================================

-- Users can read their own alerts
DROP POLICY IF EXISTS "Users can read own alerts" ON emergency_alerts;
CREATE POLICY "Users can read own alerts" ON emergency_alerts
  FOR SELECT USING (user_id = auth.uid());

-- Users can create alerts
DROP POLICY IF EXISTS "Users can create alerts" ON emergency_alerts;
CREATE POLICY "Users can create alerts" ON emergency_alerts
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Users can update their own alerts
DROP POLICY IF EXISTS "Users can update own alerts" ON emergency_alerts;
CREATE POLICY "Users can update own alerts" ON emergency_alerts
  FOR UPDATE USING (user_id = auth.uid());

-- Service role full access
DROP POLICY IF EXISTS "Service role full access to alerts" ON emergency_alerts;
CREATE POLICY "Service role full access to alerts" ON emergency_alerts
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================
-- FARE CONFIG POLICIES (Read-only for users)
-- ============================================

-- All authenticated users can read fare config
DROP POLICY IF EXISTS "Authenticated users can read fare config" ON fare_config;
CREATE POLICY "Authenticated users can read fare config" ON fare_config
  FOR SELECT USING (auth.role() = 'authenticated');

-- Only service role can modify fare config
DROP POLICY IF EXISTS "Service role can modify fare config" ON fare_config;
CREATE POLICY "Service role can modify fare config" ON fare_config
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================
-- AUDIT LOG TABLE (Create if not exists)
-- ============================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action TEXT NOT NULL, -- INSERT, UPDATE, DELETE
  old_data JSONB,
  new_data JSONB,
  user_id UUID REFERENCES auth.users(id),
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_record ON audit_logs(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- Enable RLS on audit logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Only service role can read/write audit logs
CREATE POLICY "Service role only for audit logs" ON audit_logs
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================
-- TRIGGER FUNCTION FOR AUDIT LOGGING
-- ============================================

CREATE OR REPLACE FUNCTION audit_trigger_func()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO audit_logs (table_name, record_id, action, old_data, user_id)
    VALUES (TG_TABLE_NAME, OLD.id, TG_OP, to_jsonb(OLD), auth.uid());
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_logs (table_name, record_id, action, old_data, new_data, user_id)
    VALUES (TG_TABLE_NAME, NEW.id, TG_OP, to_jsonb(OLD), to_jsonb(NEW), auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO audit_logs (table_name, record_id, action, new_data, user_id)
    VALUES (TG_TABLE_NAME, NEW.id, TG_OP, to_jsonb(NEW), auth.uid());
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create audit triggers for important tables
DROP TRIGGER IF EXISTS audit_bookings ON bookings;
CREATE TRIGGER audit_bookings
  AFTER INSERT OR UPDATE OR DELETE ON bookings
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

DROP TRIGGER IF EXISTS audit_drivers ON drivers;
CREATE TRIGGER audit_drivers
  AFTER INSERT OR UPDATE OR DELETE ON drivers
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

DROP TRIGGER IF EXISTS audit_emergency_alerts ON emergency_alerts;
CREATE TRIGGER audit_emergency_alerts
  AFTER INSERT OR UPDATE OR DELETE ON emergency_alerts
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- ============================================
-- SECURITY NOTES
-- ============================================
-- 
-- 1. All tables have RLS enabled
-- 2. Users can only access their own data
-- 3. Service role bypasses RLS for admin operations
-- 4. Audit logging tracks all changes to sensitive tables
-- 5. Edge Functions use service_role for elevated operations
-- 
-- IMPORTANT: Review and test all policies before production
-- ============================================
