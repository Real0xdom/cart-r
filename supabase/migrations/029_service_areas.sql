-- Migration: Service Area Geofencing
-- Description: Add tables and functions for location-based service restrictions
-- Date: 2026-02-12

-- 1. Ensure PostGIS extension is enabled
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. Create service_areas table
CREATE TABLE IF NOT EXISTS public.service_areas (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name varchar NOT NULL,
  city varchar NOT NULL,
  state varchar NOT NULL,
  country varchar DEFAULT 'India',
  geometry geography(POLYGON, 4326) NOT NULL,
  center_latitude numeric NOT NULL,
  center_longitude numeric NOT NULL,
  radius_km numeric DEFAULT 10,
  is_active boolean DEFAULT true,
  priority integer DEFAULT 1,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. Create spatial index for fast lookups
CREATE INDEX IF NOT EXISTS idx_service_areas_geometry 
ON public.service_areas USING GIST(geometry);

CREATE INDEX IF NOT EXISTS idx_service_areas_active 
ON public.service_areas(is_active) WHERE is_active = true;

-- 4. Function to check if point is in service area
CREATE OR REPLACE FUNCTION is_location_in_service_area(
  lat numeric,
  lng numeric
) RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM service_areas
    WHERE is_active = true
    AND ST_Contains(
      geometry::geometry,
      ST_SetSRID(ST_MakePoint(lng, lat), 4326)
    )
  );
END;
$$ LANGUAGE plpgsql;

-- 5. Function to get service area details for a location
CREATE OR REPLACE FUNCTION get_service_area_for_location(
  lat numeric,
  lng numeric
) RETURNS TABLE(
  area_id uuid,
  area_name varchar,
  city varchar,
  state varchar,
  country varchar
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    id,
    name,
    service_areas.city,
    service_areas.state,
    service_areas.country
  FROM service_areas
  WHERE is_active = true
  AND ST_Contains(
    geometry::geometry,
    ST_SetSRID(ST_MakePoint(lng, lat), 4326)
  )
  ORDER BY priority DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- 6. Function to get all active service areas
CREATE OR REPLACE FUNCTION get_active_service_areas()
RETURNS TABLE(
  id uuid,
  name varchar,
  city varchar,
  state varchar,
  center_lat numeric,
  center_lng numeric,
  radius_km numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    service_areas.id,
    service_areas.name,
    service_areas.city,
    service_areas.state,
    center_latitude,
    center_longitude,
    service_areas.radius_km
  FROM service_areas
  WHERE is_active = true
  ORDER BY priority DESC, city ASC;
END;
$$ LANGUAGE plpgsql;

-- 7. Insert default service areas (example cities)
-- Delhi NCR
INSERT INTO service_areas (name, city, state, center_latitude, center_longitude, radius_km, geometry)
VALUES (
  'Delhi NCR',
  'New Delhi',
  'Delhi',
  28.6139,
  77.2090,
  25,
  ST_GeogFromText('SRID=4326;POLYGON((77.0 28.4, 77.4 28.4, 77.4 28.8, 77.0 28.8, 77.0 28.4))')
) ON CONFLICT DO NOTHING;

-- Mumbai
INSERT INTO service_areas (name, city, state, center_latitude, center_longitude, radius_km, geometry)
VALUES (
  'Mumbai Metropolitan',
  'Mumbai',
  'Maharashtra',
  19.0760,
  72.8777,
  20,
  ST_GeogFromText('SRID=4326;POLYGON((72.7 18.9, 73.0 18.9, 73.0 19.3, 72.7 19.3, 72.7 18.9))')
) ON CONFLICT DO NOTHING;

-- Bangalore
INSERT INTO service_areas (name, city, state, center_latitude, center_longitude, radius_km, geometry)
VALUES (
  'Bangalore City',
  'Bangalore',
  'Karnataka',
  12.9716,
  77.5946,
  15,
  ST_GeogFromText('SRID=4326;POLYGON((77.4 12.8, 77.8 12.8, 77.8 13.1, 77.4 13.1, 77.4 12.8))')
) ON CONFLICT DO NOTHING;

-- 8. Enable RLS
ALTER TABLE public.service_areas ENABLE ROW LEVEL SECURITY;

-- 9. RLS Policies (public read access for active areas)
CREATE POLICY "Anyone can view active service areas"
ON public.service_areas
FOR SELECT
USING (is_active = true);

CREATE POLICY "Only admins can modify service areas"
ON public.service_areas
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role = 'admin'
  )
);

-- 10. Comments
COMMENT ON TABLE service_areas IS 'Defines geographic boundaries where CartR services are available';
COMMENT ON FUNCTION is_location_in_service_area IS 'Checks if a coordinate is within any active service area';
COMMENT ON FUNCTION get_service_area_for_location IS 'Returns service area details for a given location';
COMMENT ON FUNCTION get_active_service_areas IS 'Returns list of all active service areas';
