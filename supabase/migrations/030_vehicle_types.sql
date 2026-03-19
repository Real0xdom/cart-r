
-- 2. Insert fare configurations for new vehicle types
INSERT INTO public.fare_config (
  vehicle_type,
  base_fare,
  per_km_rate,
  per_minute_rate,
  minimum_fare,
  cancellation_fee,
  driver_search_radius_km,
  is_active
)
VALUES 
  -- Three Wheeler (Auto Rickshaw)
  (
    'three_wheeler',
    40,      -- Base fare
    12,      -- Per km rate
    1.5,     -- Per minute rate
    50,      -- Minimum fare
    20,      -- Cancellation fee
    8,       -- Search radius
    true
  ),
  -- Chota Hathi (Small Truck)
  (
    'chota_hathi',
    150,     -- Base fare
    18,      -- Per km rate
    2.5,     -- Per minute rate
    200,     -- Minimum fare
    50,      -- Cancellation fee
    12,      -- Search radius
    true
  ),
  -- Pickup (Small Truck/Van)
  (
    'pickup',
    120,     -- Base fare
    15,      -- Per km rate
    2.0,     -- Per minute rate
    150,     -- Minimum fare
    40,      -- Cancellation fee
    10,      -- Search radius
    true
  )
ON CONFLICT (vehicle_type) DO UPDATE SET
  base_fare = EXCLUDED.base_fare,
  per_km_rate = EXCLUDED.per_km_rate,
  per_minute_rate = EXCLUDED.per_minute_rate,
  minimum_fare = EXCLUDED.minimum_fare,
  cancellation_fee = EXCLUDED.cancellation_fee,
  driver_search_radius_km = EXCLUDED.driver_search_radius_km,
  updated_at = now();

-- 3. Add vehicle capacity and specifications table
CREATE TABLE IF NOT EXISTS public.vehicle_specifications (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  vehicle_type vehicle_type NOT NULL UNIQUE,
  display_name varchar NOT NULL,
  description text,
  icon_emoji varchar DEFAULT '🚗',
  max_weight_kg numeric,
  max_volume_cubic_meters numeric,
  passenger_capacity integer DEFAULT 0,
  suitable_for text[], -- Array of use cases
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 4. Insert vehicle specifications
INSERT INTO public.vehicle_specifications (
  vehicle_type,
  display_name,
  description,
  icon_emoji,
  max_weight_kg,
  max_volume_cubic_meters,
  passenger_capacity,
  suitable_for
)
VALUES 
  (
    'bike',
    'Bike',
    'Small packages and documents',
    '🏍️',
    20,
    0.1,
    0,
    ARRAY['Documents', 'Small parcels', 'Food delivery']
  ),
  (
    'three_wheeler',
    'Three Wheeler',
    'Light goods and small furniture',
    '🛺',
    300,
    1.5,
    1,
    ARRAY['Light goods', 'Small furniture', 'Groceries']
  ),
  (
    'tempo',
    'Tempo',
    'Medium loads and household items',
    '🚐',
    500,
    3.0,
    2,
    ARRAY['Household items', 'Medium furniture', 'Appliances']
  ),
  (
    'chota_hathi',
    'Chota Hathi',
    'Heavy goods and large furniture',
    '🚛',
    1500,
    6.0,
    2,
    ARRAY['Heavy goods', 'Large furniture', 'Construction materials']
  ),
  (
    'pickup',
    'Pickup',
    'Furniture and large items',
    '🚙',
    800,
    4.0,
    2,
    ARRAY['Furniture', 'Large items', 'Moving goods']
  ),
  (
    'sedan',
    'Sedan',
    'Documents and small parcels',
    '🚗',
    50,
    0.5,
    3,
    ARRAY['Documents', 'Small parcels', 'Personal items']
  ),
  (
    'truck',
    'Truck',
    'Heavy goods moving and logistics',
    '🚚',
    3000,
    12.0,
    2,
    ARRAY['Heavy goods', 'Bulk items', 'Commercial logistics']
  )
ON CONFLICT (vehicle_type) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  icon_emoji = EXCLUDED.icon_emoji,
  max_weight_kg = EXCLUDED.max_weight_kg,
  max_volume_cubic_meters = EXCLUDED.max_volume_cubic_meters,
  passenger_capacity = EXCLUDED.passenger_capacity,
  suitable_for = EXCLUDED.suitable_for,
  updated_at = now();

-- 5. Enable RLS on vehicle_specifications
ALTER TABLE public.vehicle_specifications ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policy (public read access)
-- 6. RLS Policy (public read access)
DROP POLICY IF EXISTS "Anyone can view vehicle specifications" ON public.vehicle_specifications;
CREATE POLICY "Anyone can view vehicle specifications"
ON public.vehicle_specifications
FOR SELECT
USING (true);

-- 7. Function to get vehicle details with fare
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

-- 8. Comments
COMMENT ON TABLE vehicle_specifications IS 'Detailed specifications and metadata for each vehicle type';
COMMENT ON FUNCTION get_vehicle_types_with_fare IS 'Returns all active vehicle types with fare and specifications';
