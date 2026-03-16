-- Check and Fix Active Vehicle Types
-- This script will show you which vehicles are currently active and allow you to deactivate unwanted ones

-- =====================================================
-- STEP 1: Check Current Active Vehicles
-- =====================================================

-- View all vehicle types and their active status
SELECT 
    vehicle_type,
    base_fare,
    per_km_rate,
    per_minute_rate,
    minimum_fare,
    is_active,
    created_at,
    updated_at
FROM fare_config
ORDER BY vehicle_type;

-- =====================================================
-- STEP 2: Deactivate Unwanted Vehicles (e.g., sedan)
-- =====================================================

-- To deactivate a vehicle type (e.g., sedan), run this:
UPDATE fare_config 
SET 
    is_active = false,
    updated_at = now()
WHERE vehicle_type = 'sedan';

-- =====================================================
-- STEP 3: Verify the Change
-- =====================================================

-- After running the UPDATE, verify only desired vehicles are active
SELECT 
    vehicle_type,
    base_fare,
    is_active
FROM fare_config
ORDER BY 
    CASE WHEN is_active THEN 0 ELSE 1 END,
    vehicle_type;

-- =====================================================
-- STEP 4: Test the RPC Function
-- =====================================================

-- Test that get_vehicle_types_with_fare() only returns active vehicles
SELECT * FROM get_vehicle_types_with_fare();

-- This should ONLY show vehicles where is_active = true
