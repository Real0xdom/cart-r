-- ============================================
-- VEHICLE TYPES DEBUG & FIX SCRIPT
-- ============================================
-- Run this in Supabase SQL Editor to diagnose and fix the issue

-- STEP 1: DIAGNOSIS
-- ============================================
-- Run these to see what's in the database:

-- Check all vehicles in vehicle_specifications
-- SELECT vehicle_type, display_name, icon_emoji, created_at 
-- FROM vehicle_specifications 
-- ORDER BY created_at DESC;

-- Check all fares in fare_config  
-- SELECT vehicle_type, base_fare, is_active, created_at 
-- FROM fare_config 
-- ORDER BY created_at DESC;

-- Find missing fares
-- SELECT vs.vehicle_type, vs.display_name, 'MISSING FARE CONFIG' as issue
-- FROM vehicle_specifications vs
-- LEFT JOIN fare_config fc ON vs.vehicle_type = fc.vehicle_type
-- WHERE fc.id IS NULL;

-- Find inactive fares
-- SELECT vehicle_type, base_fare, is_active, 'INACTIVE' as issue
-- FROM fare_config
-- WHERE is_active = false;

-- ============================================
-- STEP 2: IMMEDIATE FIX
-- ============================================
-- This section fixes the problem RIGHT NOW

-- 2a. Activate any inactive fare configs
UPDATE fare_config 
SET is_active = true, updated_at = now() 
WHERE is_active = false;

-- 2b. Create fare configs for vehicles that don't have them
-- Using a bulk INSERT approach

WITH vehicle_list AS (
  SELECT DISTINCT vehicle_type FROM vehicle_specifications
)
INSERT INTO fare_config (vehicle_type, base_fare, per_km_rate, per_minute_rate, minimum_fare, cancellation_fee, driver_search_radius_km, is_active)
SELECT 
  vehicle_type,
  CASE 
    WHEN vehicle_type = 'bike' THEN 25
    WHEN vehicle_type = 'sedan' THEN 50
    WHEN vehicle_type = 'three_wheeler' THEN 40
    WHEN vehicle_type = 'tempo' THEN 60
    WHEN vehicle_type = 'pickup' THEN 120
    WHEN vehicle_type = 'truck' THEN 150
    WHEN vehicle_type = 'chota_hathi' THEN 150
    ELSE 75 -- generous default for unknown types
  END as base_fare,
  CASE 
    WHEN vehicle_type = 'bike' THEN 3
    WHEN vehicle_type = 'sedan' THEN 5
    WHEN vehicle_type = 'three_wheeler' THEN 5
    WHEN vehicle_type = 'tempo' THEN 6
    WHEN vehicle_type = 'pickup' THEN 6
    WHEN vehicle_type = 'truck' THEN 8
    WHEN vehicle_type = 'chota_hathi' THEN 7
    ELSE 6
  END as per_km_rate,
  CASE 
    WHEN vehicle_type = 'bike' THEN 1
    WHEN vehicle_type = 'sedan' THEN 1.5
    WHEN vehicle_type = 'three_wheeler' THEN 1.5
    WHEN vehicle_type = 'tempo' THEN 2
    WHEN vehicle_type = 'pickup' THEN 2
    WHEN vehicle_type = 'truck' THEN 3
    WHEN vehicle_type = 'chota_hathi' THEN 3
    ELSE 2
  END as per_minute_rate,
  CASE 
    WHEN vehicle_type = 'bike' THEN 30
    WHEN vehicle_type = 'sedan' THEN 60
    WHEN vehicle_type = 'three_wheeler' THEN 50
    WHEN vehicle_type = 'tempo' THEN 70
    WHEN vehicle_type = 'pickup' THEN 150
    WHEN vehicle_type = 'truck' THEN 200
    WHEN vehicle_type = 'chota_hathi' THEN 200
    ELSE 100
  END as minimum_fare,
  CASE 
    WHEN vehicle_type = 'bike' THEN 10
    WHEN vehicle_type = 'sedan' THEN 20
    WHEN vehicle_type = 'three_wheeler' THEN 20
    WHEN vehicle_type = 'tempo' THEN 30
    WHEN vehicle_type = 'pickup' THEN 40
    WHEN vehicle_type = 'truck' THEN 50
    WHEN vehicle_type = 'chota_hathi' THEN 50
    ELSE 30
  END as cancellation_fee,
  CASE 
    WHEN vehicle_type = 'bike' THEN 5
    WHEN vehicle_type = 'sedan' THEN 10
    WHEN vehicle_type = 'three_wheeler' THEN 8
    WHEN vehicle_type = 'tempo' THEN 10
    WHEN vehicle_type = 'pickup' THEN 12
    WHEN vehicle_type = 'truck' THEN 15
    WHEN vehicle_type = 'chota_hathi' THEN 12
    ELSE 10
  END as driver_search_radius_km,
  true as is_active
FROM vehicle_list
WHERE NOT EXISTS (
  SELECT 1 FROM fare_config fc WHERE fc.vehicle_type = vehicle_list.vehicle_type
)
ON CONFLICT (vehicle_type) DO NOTHING;

-- ============================================
-- STEP 3: VERIFY THE FIX
-- ============================================
-- Run these queries to verify all is well:

-- Final check: All vehicles should now have active fares
SELECT 
  vs.vehicle_type,
  vs.display_name,
  CASE WHEN fc.id IS NOT NULL THEN '✓ HAS FARE' ELSE '✗ MISSING' END as status,
  fc.base_fare,
  fc.is_active
FROM vehicle_specifications vs
LEFT JOIN fare_config fc ON vs.vehicle_type = fc.vehicle_type
ORDER BY vs.display_name;

-- Test the RPC function:
-- SELECT * FROM get_vehicle_types_with_fare() ORDER BY base_fare;

-- ============================================
-- STEP 4: TEST EDGE FUNCTION
-- ============================================
-- If you have curl/Postman, test the calculate-fare edge function:
/*
curl -X POST http://localhost:54321/functions/v1/calculate-fare \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "origin_lat": 12.9352,
    "origin_lng": 77.6245,
    "dest_lat": 12.9316,
    "dest_lng": 77.6412,
    "get_all_vehicles": true
  }'
*/

-- Or in Supabase, use Function Testing:
-- Go to Functions > calculate-fare > Test
-- Body: {"origin_lat": 12.9352, "origin_lng": 77.6245, "dest_lat": 12.9316, "dest_lng": 77.6412, "get_all_vehicles": true}
