-- Remove Sedan Vehicle Type
-- This will deactivate the sedan vehicle so it no longer appears to customers

-- Step 1: Show current status
SELECT 'BEFORE:' as status;
SELECT vehicle_type, is_active FROM fare_config WHERE vehicle_type = 'sedan';

-- Step 2: Deactivate sedan
UPDATE fare_config 
SET 
    is_active = false,
    updated_at = now()
WHERE vehicle_type = 'sedan';

-- Step 3: Verify the change
SELECT 'AFTER:' as status;
SELECT vehicle_type, is_active FROM fare_config WHERE vehicle_type = 'sedan';

-- Step 4: Show all active vehicles
SELECT 'ACTIVE VEHICLES (should NOT include sedan):' as status;
SELECT vehicle_type, base_fare, is_active 
FROM fare_config 
ORDER BY 
    CASE WHEN is_active THEN 0 ELSE 1 END,
    vehicle_type;

-- Step 5: Test RPC function
SELECT 'RPC FUNCTION RESULT:' as status;
SELECT * FROM get_vehicle_types_with_fare();
