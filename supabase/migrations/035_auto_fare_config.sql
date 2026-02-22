-- Auto-create fare_config when new vehicle_specifications are inserted
-- This ensures admin-set vehicles automatically appear to customers/drivers

-- 1. Create trigger function
CREATE OR REPLACE FUNCTION create_default_fare_config()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert default fare config when a new vehicle_specification is created
  -- Only if fare_config doesn't already exist for this vehicle_type
  INSERT INTO fare_config (
    vehicle_type,
    base_fare,
    per_km_rate,
    per_minute_rate,
    minimum_fare,
    cancellation_fee,
    driver_search_radius_km,
    is_active
  )
  VALUES (
    NEW.vehicle_type,
    CASE 
      -- Default fares based on vehicle type
      WHEN NEW.vehicle_type = 'bike' THEN 25
      WHEN NEW.vehicle_type = 'sedan' THEN 50
      WHEN NEW.vehicle_type = 'three_wheeler' THEN 40
      WHEN NEW.vehicle_type = 'tempo' THEN 60
      WHEN NEW.vehicle_type = 'pickup' THEN 120
      WHEN NEW.vehicle_type = 'truck' THEN 150
      WHEN NEW.vehicle_type = 'chota_hathi' THEN 150
      ELSE 50 -- Fallback base fare
    END,
    CASE 
      WHEN NEW.vehicle_type = 'bike' THEN 3
      WHEN NEW.vehicle_type = 'sedan' THEN 5
      WHEN NEW.vehicle_type = 'three_wheeler' THEN 5
      WHEN NEW.vehicle_type = 'tempo' THEN 6
      WHEN NEW.vehicle_type = 'pickup' THEN 6
      WHEN NEW.vehicle_type = 'truck' THEN 8
      WHEN NEW.vehicle_type = 'chota_hathi' THEN 7
      ELSE 5 -- Fallback per_km_rate
    END,
    CASE 
      WHEN NEW.vehicle_type = 'bike' THEN 1
      WHEN NEW.vehicle_type = 'sedan' THEN 1.5
      WHEN NEW.vehicle_type = 'three_wheeler' THEN 1.5
      WHEN NEW.vehicle_type = 'tempo' THEN 2
      WHEN NEW.vehicle_type = 'pickup' THEN 2
      WHEN NEW.vehicle_type = 'truck' THEN 3
      WHEN NEW.vehicle_type = 'chota_hathi' THEN 3
      ELSE 1.5 -- Fallback per_minute_rate
    END,
    CASE 
      WHEN NEW.vehicle_type = 'bike' THEN 30
      WHEN NEW.vehicle_type = 'sedan' THEN 60
      WHEN NEW.vehicle_type = 'three_wheeler' THEN 50
      WHEN NEW.vehicle_type = 'tempo' THEN 70
      WHEN NEW.vehicle_type = 'pickup' THEN 150
      WHEN NEW.vehicle_type = 'truck' THEN 200
      WHEN NEW.vehicle_type = 'chota_hathi' THEN 200
      ELSE 50 -- Fallback minimum_fare
    END,
    CASE 
      WHEN NEW.vehicle_type = 'bike' THEN 10
      WHEN NEW.vehicle_type = 'sedan' THEN 20
      WHEN NEW.vehicle_type = 'three_wheeler' THEN 20
      WHEN NEW.vehicle_type = 'tempo' THEN 30
      WHEN NEW.vehicle_type = 'pickup' THEN 40
      WHEN NEW.vehicle_type = 'truck' THEN 50
      WHEN NEW.vehicle_type = 'chota_hathi' THEN 50
      ELSE 20 -- Fallback cancellation_fee
    END,
    CASE 
      WHEN NEW.vehicle_type = 'bike' THEN 5
      WHEN NEW.vehicle_type = 'sedan' THEN 10
      WHEN NEW.vehicle_type = 'three_wheeler' THEN 8
      WHEN NEW.vehicle_type = 'tempo' THEN 10
      WHEN NEW.vehicle_type = 'pickup' THEN 12
      WHEN NEW.vehicle_type = 'truck' THEN 15
      WHEN NEW.vehicle_type = 'chota_hathi' THEN 12
      ELSE 8 -- Fallback driver_search_radius_km
    END,
    true
  )
  ON CONFLICT (vehicle_type) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Create trigger on vehicle_specifications INSERT
DROP TRIGGER IF EXISTS vehicle_spec_auto_fare_trigger ON vehicle_specifications;
CREATE TRIGGER vehicle_spec_auto_fare_trigger
AFTER INSERT ON vehicle_specifications
FOR EACH ROW
EXECUTE FUNCTION create_default_fare_config();

-- 3. Backfill missing fare configs for existing vehicles
INSERT INTO fare_config (
  vehicle_type,
  base_fare,
  per_km_rate,
  per_minute_rate,
  minimum_fare,
  cancellation_fee,
  driver_search_radius_km,
  is_active
)
SELECT 
  vs.vehicle_type,
  CASE 
    WHEN vs.vehicle_type = 'bike' THEN 25
    WHEN vs.vehicle_type = 'sedan' THEN 50
    WHEN vs.vehicle_type = 'three_wheeler' THEN 40
    WHEN vs.vehicle_type = 'tempo' THEN 60
    WHEN vs.vehicle_type = 'pickup' THEN 120
    WHEN vs.vehicle_type = 'truck' THEN 150
    WHEN vs.vehicle_type = 'chota_hathi' THEN 150
    ELSE 50
  END,
  CASE 
    WHEN vs.vehicle_type = 'bike' THEN 3
    WHEN vs.vehicle_type = 'sedan' THEN 5
    WHEN vs.vehicle_type = 'three_wheeler' THEN 5
    WHEN vs.vehicle_type = 'tempo' THEN 6
    WHEN vs.vehicle_type = 'pickup' THEN 6
    WHEN vs.vehicle_type = 'truck' THEN 8
    WHEN vs.vehicle_type = 'chota_hathi' THEN 7
    ELSE 5
  END,
  CASE 
    WHEN vs.vehicle_type = 'bike' THEN 1
    WHEN vs.vehicle_type = 'sedan' THEN 1.5
    WHEN vs.vehicle_type = 'three_wheeler' THEN 1.5
    WHEN vs.vehicle_type = 'tempo' THEN 2
    WHEN vs.vehicle_type = 'pickup' THEN 2
    WHEN vs.vehicle_type = 'truck' THEN 3
    WHEN vs.vehicle_type = 'chota_hathi' THEN 3
    ELSE 1.5
  END,
  CASE 
    WHEN vs.vehicle_type = 'bike' THEN 30
    WHEN vs.vehicle_type = 'sedan' THEN 60
    WHEN vs.vehicle_type = 'three_wheeler' THEN 50
    WHEN vs.vehicle_type = 'tempo' THEN 70
    WHEN vs.vehicle_type = 'pickup' THEN 150
    WHEN vs.vehicle_type = 'truck' THEN 200
    WHEN vs.vehicle_type = 'chota_hathi' THEN 200
    ELSE 50
  END,
  CASE 
    WHEN vs.vehicle_type = 'bike' THEN 10
    WHEN vs.vehicle_type = 'sedan' THEN 20
    WHEN vs.vehicle_type = 'three_wheeler' THEN 20
    WHEN vs.vehicle_type = 'tempo' THEN 30
    WHEN vs.vehicle_type = 'pickup' THEN 40
    WHEN vs.vehicle_type = 'truck' THEN 50
    WHEN vs.vehicle_type = 'chota_hathi' THEN 50
    ELSE 20
  END,
  CASE 
    WHEN vs.vehicle_type = 'bike' THEN 5
    WHEN vs.vehicle_type = 'sedan' THEN 10
    WHEN vs.vehicle_type = 'three_wheeler' THEN 8
    WHEN vs.vehicle_type = 'tempo' THEN 10
    WHEN vs.vehicle_type = 'pickup' THEN 12
    WHEN vs.vehicle_type = 'truck' THEN 15
    WHEN vs.vehicle_type = 'chota_hathi' THEN 12
    ELSE 8
  END,
  true
FROM vehicle_specifications vs
WHERE NOT EXISTS (
  SELECT 1 FROM fare_config fc WHERE fc.vehicle_type = vs.vehicle_type
)
ON CONFLICT (vehicle_type) DO NOTHING;

-- 4. Add comment
COMMENT ON FUNCTION create_default_fare_config IS 'Auto-creates default fare configuration when a new vehicle specification is added by admin. Ensures newly added vehicles immediately appear to customers/drivers with sensible default fares.';
