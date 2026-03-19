-- =====================================================
-- Cart-R Customer App - Home Screen Test Data
-- =====================================================
-- This file contains SQL queries to insert test data for 
-- testing the redesigned customer home screen.
-- Run these queries in the Supabase SQL Editor.
-- =====================================================

-- IMPORTANT: Replace the customer_id with your actual logged-in user ID
-- You can find your user ID by running:
-- SELECT id, name, phone FROM users WHERE phone = 'YOUR_PHONE_NUMBER';

-- =====================================================
-- STEP 1: Get your customer user ID
-- =====================================================
-- Run this query first and note down your user ID:
-- SELECT id, name, phone, email FROM users WHERE role = 'customer' LIMIT 10;


-- =====================================================
-- STEP 2: Create a test driver (if not exists)
-- =====================================================

-- First, create a user for the driver
INSERT INTO users (id, email, name, phone, role, is_active)
VALUES (
  'dddddddd-dddd-dddd-dddd-000000000001',
  'testdriver@cartr.in',
  'Ramesh Kumar',
  '+919876543210',
  'driver',
  true
)
ON CONFLICT (id) DO UPDATE SET 
  name = EXCLUDED.name,
  phone = EXCLUDED.phone;

-- Create driver profile
INSERT INTO drivers (
  id,
  user_id,
  vehicle_type,
  vehicle_number,
  vehicle_model,
  vehicle_color,
  license_number,
  license_expiry,
  verification_status,
  is_online,
  rating,
  total_trips
)
VALUES (
  'eeeeeeee-eeee-eeee-eeee-000000000001',
  'dddddddd-dddd-dddd-dddd-000000000001',
  'tempo',
  'KA-01-AB-1234',
  'Tata Ace',
  'Orange',
  'KA1234567890123',
  '2026-12-31',
  'approved',
  true,
  4.8,
  156
)
ON CONFLICT (id) DO UPDATE SET 
  vehicle_type = EXCLUDED.vehicle_type,
  vehicle_number = EXCLUDED.vehicle_number,
  is_online = EXCLUDED.is_online;


-- =====================================================
-- STEP 3: Insert test bookings
-- Replace 'YOUR_CUSTOMER_ID' with your actual user ID
-- =====================================================

-- Booking 1: IN_PROGRESS (Current shipment - will show on home)
INSERT INTO bookings (
  id,
  booking_number,
  customer_id,
  driver_id,
  origin_address,
  origin_latitude,
  origin_longitude,
  destination_address,
  destination_latitude,
  destination_longitude,
  vehicle_type,
  estimated_distance,
  estimated_duration,
  base_fare,
  total_fare,
  tip_amount,
  fare_multiplier,
  driver_payout,
  payment_status,
  payment_method,
  status,
  pickup_otp,
  receiver_name,
  receiver_phone,
  created_at,
  accepted_at,
  started_at
)
SELECT 
  'bbbbbbbb-bbbb-bbbb-bbbb-000000000001',
  'CARTR-TEST-001',
  u.id,  -- Your customer ID
  'eeeeeeee-eeee-eeee-eeee-000000000001',  -- Test driver
  'Koramangala 5th Block, Bangalore',
  12.9340,
  77.6119,
  'Indiranagar 100 Feet Road, Bangalore',
  12.9784,
  77.6408,
  'tempo',
  8.5,
  25,
  150.00,
  450.00,
  0.00,
  1.0,
  450.00,
  'pending',
  'cash',
  'in_progress',
  '1234',
  'Suresh Sharma',
  '+919876500001',
  NOW() - INTERVAL '30 minutes',
  NOW() - INTERVAL '25 minutes',
  NOW() - INTERVAL '20 minutes'
FROM users u
WHERE u.phone = 'YOUR_PHONE_NUMBER'  -- Replace with your phone number
LIMIT 1
ON CONFLICT (id) DO UPDATE SET 
  status = 'in_progress',
  started_at = NOW() - INTERVAL '20 minutes';


-- Booking 2: COMPLETED (Recent shipment)
INSERT INTO bookings (
  id,
  booking_number,
  customer_id,
  driver_id,
  origin_address,
  origin_latitude,
  origin_longitude,
  destination_address,
  destination_latitude,
  destination_longitude,
  vehicle_type,
  estimated_distance,
  estimated_duration,
  base_fare,
  total_fare,
  tip_amount,
  fare_multiplier,
  driver_payout,
  payment_status,
  payment_method,
  status,
  pickup_otp,
  receiver_name,
  receiver_phone,
  created_at,
  accepted_at,
  started_at,
  completed_at
)
SELECT 
  'bbbbbbbb-bbbb-bbbb-bbbb-000000000002',
  'CARTR-TEST-002',
  u.id,
  'eeeeeeee-eeee-eeee-eeee-000000000001',
  'HSR Layout Sector 1, Bangalore',
  12.9116,
  77.6389,
  'Whitefield Main Road, Bangalore',
  12.9698,
  77.7500,
  'tempo',
  15.2,
  40,
  150.00,
  680.00,
  50.00,
  1.0,
  730.00,
  'paid',
  'online',
  'completed',
  '5678',
  'Priya Patel',
  '+919876500002',
  NOW() - INTERVAL '2 days',
  NOW() - INTERVAL '2 days' + INTERVAL '5 minutes',
  NOW() - INTERVAL '2 days' + INTERVAL '10 minutes',
  NOW() - INTERVAL '2 days' + INTERVAL '50 minutes'
FROM users u
WHERE u.phone = 'YOUR_PHONE_NUMBER'  -- Replace with your phone number
LIMIT 1
ON CONFLICT (id) DO UPDATE SET 
  status = 'completed';


-- Booking 3: COMPLETED (Another recent shipment)
INSERT INTO bookings (
  id,
  booking_number,
  customer_id,
  driver_id,
  origin_address,
  origin_latitude,
  origin_longitude,
  destination_address,
  destination_latitude,
  destination_longitude,
  vehicle_type,
  estimated_distance,
  estimated_duration,
  base_fare,
  total_fare,
  tip_amount,
  fare_multiplier,
  driver_payout,
  payment_status,
  payment_method,
  status,
  pickup_otp,
  receiver_name,
  receiver_phone,
  created_at,
  accepted_at,
  started_at,
  completed_at
)
SELECT 
  'bbbbbbbb-bbbb-bbbb-bbbb-000000000003',
  'CARTR-TEST-003',
  u.id,
  'eeeeeeee-eeee-eeee-eeee-000000000001',
  'Electronic City Phase 1, Bangalore',
  12.8397,
  77.6766,
  'MG Road Metro Station, Bangalore',
  12.9756,
  77.6064,
  'sedan',
  18.0,
  45,
  70.00,
  520.00,
  0.00,
  1.0,
  520.00,
  'paid',
  'cash',
  'completed',
  '9012',
  'Amit Verma',
  '+919876500003',
  NOW() - INTERVAL '5 days',
  NOW() - INTERVAL '5 days' + INTERVAL '3 minutes',
  NOW() - INTERVAL '5 days' + INTERVAL '8 minutes',
  NOW() - INTERVAL '5 days' + INTERVAL '55 minutes'
FROM users u
WHERE u.phone = 'YOUR_PHONE_NUMBER'  -- Replace with your phone number
LIMIT 1
ON CONFLICT (id) DO UPDATE SET 
  status = 'completed';


-- Booking 4: CANCELLED (For history)
INSERT INTO bookings (
  id,
  booking_number,
  customer_id,
  origin_address,
  origin_latitude,
  origin_longitude,
  destination_address,
  destination_latitude,
  destination_longitude,
  vehicle_type,
  estimated_distance,
  estimated_duration,
  base_fare,
  total_fare,
  tip_amount,
  fare_multiplier,
  driver_payout,
  payment_status,
  payment_method,
  status,
  pickup_otp,
  receiver_name,
  receiver_phone,
  created_at,
  cancelled_at
)
SELECT 
  'bbbbbbbb-bbbb-bbbb-bbbb-000000000004',
  'CARTR-TEST-004',
  u.id,
  'Jayanagar 4th Block, Bangalore',
  12.9260,
  77.5821,
  'BTM Layout 2nd Stage, Bangalore',
  12.9166,
  77.6101,
  'bike',
  4.5,
  15,
  25.00,
  120.00,
  0.00,
  1.0,
  120.00,
  'pending',
  'cash',
  'cancelled',
  '3456',
  'Kiran Reddy',
  '+919876500004',
  NOW() - INTERVAL '7 days',
  NOW() - INTERVAL '7 days' + INTERVAL '2 minutes'
FROM users u
WHERE u.phone = 'YOUR_PHONE_NUMBER'  -- Replace with your phone number
LIMIT 1
ON CONFLICT (id) DO UPDATE SET 
  status = 'cancelled';


-- =====================================================
-- STEP 4: Verify the data
-- =====================================================

-- Check your bookings:
-- SELECT id, booking_number, status, origin_address, destination_address, total_fare, created_at 
-- FROM bookings 
-- WHERE customer_id = 'YOUR_CUSTOMER_ID'
-- ORDER BY created_at DESC;


-- =====================================================
-- CLEANUP (Optional - Run to remove test data)
-- =====================================================

-- DELETE FROM bookings WHERE id IN (
--   'bbbbbbbb-bbbb-bbbb-bbbb-000000000001',
--   'bbbbbbbb-bbbb-bbbb-bbbb-000000000002',
--   'bbbbbbbb-bbbb-bbbb-bbbb-000000000003',
--   'bbbbbbbb-bbbb-bbbb-bbbb-000000000004'
-- );

-- DELETE FROM drivers WHERE id = 'eeeeeeee-eeee-eeee-eeee-000000000001';
-- DELETE FROM users WHERE id = 'dddddddd-dddd-dddd-dddd-000000000001';
