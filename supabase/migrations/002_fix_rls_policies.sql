-- =========================================================
-- FIX: Row Level Security Policies for Users Table
-- Run this in Supabase SQL Editor to fix the profile creation error
-- =========================================================

-- First, enable RLS on users table (if not already enabled)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can insert own profile" ON users;
DROP POLICY IF EXISTS "Users can read own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Admins can view all users" ON users;

-- Allow authenticated users to insert their own profile
CREATE POLICY "Users can insert own profile"
ON users
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- Allow users to read their own profile
CREATE POLICY "Users can read own profile"
ON users
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Allow users to update their own profile
CREATE POLICY "Users can update own profile"
ON users
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Allow admins to view all users
CREATE POLICY "Admins can view all users"
ON users
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- =========================================================
-- RLS Policies for Drivers Table
-- =========================================================

ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Drivers can insert own profile" ON drivers;
DROP POLICY IF EXISTS "Drivers can read own profile" ON drivers;
DROP POLICY IF EXISTS "Drivers can update own profile" ON drivers;
DROP POLICY IF EXISTS "Customers can view online verified drivers" ON drivers;

-- Allow authenticated users to insert their driver profile
CREATE POLICY "Drivers can insert own profile"
ON drivers
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Allow drivers to read their own profile
CREATE POLICY "Drivers can read own profile"
ON drivers
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Allow drivers to update their own profile
CREATE POLICY "Drivers can update own profile"
ON drivers
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Allow all authenticated users to see online, verified drivers (for booking)
CREATE POLICY "Customers can view online verified drivers"
ON drivers
FOR SELECT
TO authenticated
USING (
  is_online = true 
  AND verification_status = 'approved'
);

-- Success message
SELECT 'RLS Policies created successfully!' as result;
