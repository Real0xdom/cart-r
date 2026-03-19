-- Update RPC function to use INNER JOIN instead of LEFT JOIN
-- This ensures only ACTIVE vehicle types are shown to customers

-- Drop and recreate the function with INNER JOIN
DROP FUNCTION IF EXISTS get_vehicle_types_with_fare();

CREATE OR REPLACE FUNCTION get_vehicle_types_with_fare()
RETURNS TABLE(
  vehicle_type vehicle_type,
  display_name varchar,
  description text,
  icon_emoji varchar,
  base_fare numeric,
  per_km_rate numeric,
  minimum_fare numeric,
  max_weight_kg numeric,
  suitable_for text[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    vs.vehicle_type,
    vs.display_name,
    vs.description,
    vs.icon_emoji,
    fc.base_fare,
    fc.per_km_rate,
    fc.minimum_fare,
    vs.max_weight_kg,
    vs.suitable_for
  FROM vehicle_specifications vs
  INNER JOIN fare_config fc ON vs.vehicle_type = fc.vehicle_type
  WHERE fc.is_active = true
  ORDER BY fc.base_fare ASC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_vehicle_types_with_fare IS 'Returns only ACTIVE vehicle types with fare and specifications. Vehicles deleted from admin will not appear here.';
