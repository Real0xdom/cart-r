-- Emergency backfill: Ensure ALL vehicle_specifications have fare_config rows
-- Run this if vehicles appear in admin but not in customer app

-- Step 1: Check which vehicles are missing fare configs
-- SELECT vs.vehicle_type, vs.display_name 
-- FROM vehicle_specifications vs 
-- LEFT JOIN fare_config fc ON vs.vehicle_type = fc.vehicle_type 
-- WHERE fc.id IS NULL;

-- Step 2: Backfill with explicit INSERT statements (one per vehicle type)
-- This approach bypasses any trigger issues

INSERT INTO fare_config (vehicle_type, base_fare, per_km_rate, per_minute_rate, minimum_fare, cancellation_fee, driver_search_radius_km, is_active)
VALUES ('bike', 25, 3, 1, 30, 10, 5, true)
ON CONFLICT (vehicle_type) DO NOTHING;

INSERT INTO fare_config (vehicle_type, base_fare, per_km_rate, per_minute_rate, minimum_fare, cancellation_fee, driver_search_radius_km, is_active)
VALUES ('sedan', 50, 5, 1.5, 60, 20, 10, true)
ON CONFLICT (vehicle_type) DO NOTHING;

INSERT INTO fare_config (vehicle_type, base_fare, per_km_rate, per_minute_rate, minimum_fare, cancellation_fee, driver_search_radius_km, is_active)
VALUES ('three_wheeler', 40, 5, 1.5, 50, 20, 8, true)
ON CONFLICT (vehicle_type) DO NOTHING;

INSERT INTO fare_config (vehicle_type, base_fare, per_km_rate, per_minute_rate, minimum_fare, cancellation_fee, driver_search_radius_km, is_active)
VALUES ('tempo', 60, 6, 2, 70, 30, 10, true)
ON CONFLICT (vehicle_type) DO NOTHING;

INSERT INTO fare_config (vehicle_type, base_fare, per_km_rate, per_minute_rate, minimum_fare, cancellation_fee, driver_search_radius_km, is_active)
VALUES ('pickup', 120, 6, 2, 150, 40, 12, true)
ON CONFLICT (vehicle_type) DO NOTHING;

INSERT INTO fare_config (vehicle_type, base_fare, per_km_rate, per_minute_rate, minimum_fare, cancellation_fee, driver_search_radius_km, is_active)
VALUES ('truck', 150, 8, 3, 200, 50, 15, true)
ON CONFLICT (vehicle_type) DO NOTHING;

INSERT INTO fare_config (vehicle_type, base_fare, per_km_rate, per_minute_rate, minimum_fare, cancellation_fee, driver_search_radius_km, is_active)
VALUES ('chota_hathi', 150, 7, 3, 200, 50, 12, true)
ON CONFLICT (vehicle_type) DO NOTHING;

-- Step 3: For any custom vehicles added via admin, use a dynamic approach
-- This creates fare configs for vehicle_specifications that don't have them
DO $$ 
DECLARE
  v_row RECORD;
  v_base_fare NUMERIC;
  v_per_km NUMERIC;
  v_per_min NUMERIC;
  v_min_fare NUMERIC;
  v_cancel_fee NUMERIC;
  v_search_radius NUMERIC;
BEGIN
  FOR v_row IN 
    SELECT DISTINCT vs.vehicle_type
    FROM vehicle_specifications vs
    LEFT JOIN fare_config fc ON vs.vehicle_type = fc.vehicle_type
    WHERE fc.id IS NULL
  LOOP
    -- Use sensible defaults based on vehicle type or fallback
    v_base_fare := CASE 
      WHEN v_row.vehicle_type = 'bike' THEN 25
      WHEN v_row.vehicle_type = 'sedan' THEN 50
      WHEN v_row.vehicle_type = 'three_wheeler' THEN 40
      WHEN v_row.vehicle_type = 'tempo' THEN 60
      WHEN v_row.vehicle_type = 'pickup' THEN 120
      WHEN v_row.vehicle_type = 'truck' THEN 150
      WHEN v_row.vehicle_type = 'chota_hathi' THEN 150
      ELSE 60 -- Default for custom vehicles
    END;
    
    v_per_km := CASE 
      WHEN v_row.vehicle_type = 'bike' THEN 3
      WHEN v_row.vehicle_type = 'sedan' THEN 5
      WHEN v_row.vehicle_type = 'three_wheeler' THEN 5
      WHEN v_row.vehicle_type = 'tempo' THEN 6
      WHEN v_row.vehicle_type = 'pickup' THEN 6
      WHEN v_row.vehicle_type = 'truck' THEN 8
      WHEN v_row.vehicle_type = 'chota_hathi' THEN 7
      ELSE 6 -- Default for custom
    END;
    
    v_per_min := CASE 
      WHEN v_row.vehicle_type = 'bike' THEN 1
      WHEN v_row.vehicle_type = 'sedan' THEN 1.5
      WHEN v_row.vehicle_type = 'three_wheeler' THEN 1.5
      WHEN v_row.vehicle_type = 'tempo' THEN 2
      WHEN v_row.vehicle_type = 'pickup' THEN 2
      WHEN v_row.vehicle_type = 'truck' THEN 3
      WHEN v_row.vehicle_type = 'chota_hathi' THEN 3
      ELSE 2 -- Default for custom
    END;
    
    v_min_fare := CASE 
      WHEN v_row.vehicle_type = 'bike' THEN 30
      WHEN v_row.vehicle_type = 'sedan' THEN 60
      WHEN v_row.vehicle_type = 'three_wheeler' THEN 50
      WHEN v_row.vehicle_type = 'tempo' THEN 70
      WHEN v_row.vehicle_type = 'pickup' THEN 150
      WHEN v_row.vehicle_type = 'truck' THEN 200
      WHEN v_row.vehicle_type = 'chota_hathi' THEN 200
      ELSE 80 -- Default for custom
    END;
    
    v_cancel_fee := CASE 
      WHEN v_row.vehicle_type = 'bike' THEN 10
      WHEN v_row.vehicle_type = 'sedan' THEN 20
      WHEN v_row.vehicle_type = 'three_wheeler' THEN 20
      WHEN v_row.vehicle_type = 'tempo' THEN 30
      WHEN v_row.vehicle_type = 'pickup' THEN 40
      WHEN v_row.vehicle_type = 'truck' THEN 50
      WHEN v_row.vehicle_type = 'chota_hathi' THEN 50
      ELSE 30 -- Default for custom
    END;
    
    v_search_radius := CASE 
      WHEN v_row.vehicle_type = 'bike' THEN 5
      WHEN v_row.vehicle_type = 'sedan' THEN 10
      WHEN v_row.vehicle_type = 'three_wheeler' THEN 8
      WHEN v_row.vehicle_type = 'tempo' THEN 10
      WHEN v_row.vehicle_type = 'pickup' THEN 12
      WHEN v_row.vehicle_type = 'truck' THEN 15
      WHEN v_row.vehicle_type = 'chota_hathi' THEN 12
      ELSE 10 -- Default for custom
    END;
    
    BEGIN
      INSERT INTO fare_config (
        vehicle_type, base_fare, per_km_rate, per_minute_rate, 
        minimum_fare, cancellation_fee, driver_search_radius_km, is_active
      )
      VALUES (
        v_row.vehicle_type, v_base_fare, v_per_km, v_per_min,
        v_min_fare, v_cancel_fee, v_search_radius, true
      )
      ON CONFLICT (vehicle_type) DO NOTHING;
      
      RAISE NOTICE 'Created fare_config for %', v_row.vehicle_type;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to create fare_config for %: %', v_row.vehicle_type, SQLERRM;
    END;
  END LOOP;
END $$;

-- Step 4: Verify all vehicle_specifications now have fare_config rows with is_active=true
-- SELECT 
--   vs.vehicle_type,
--   vs.display_name,
--   CASE WHEN fc.id IS NOT NULL THEN 'HAS FARE' ELSE 'MISSING FARE' END as status,
--   fc.base_fare,
--   fc.is_active
-- FROM vehicle_specifications vs
-- LEFT JOIN fare_config fc ON vs.vehicle_type = fc.vehicle_type
-- ORDER BY vs.display_name;
