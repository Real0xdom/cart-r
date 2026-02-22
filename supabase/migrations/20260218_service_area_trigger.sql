-- Trigger to automatically update the geometry column based on center and radius
-- This ensures that the implementation works by radius, not just generic point matching

CREATE OR REPLACE FUNCTION update_service_area_geometry()
RETURNS TRIGGER AS $$
BEGIN
    -- Calculate geometry as a buffer around the center point
    -- radius_km is in kilometers, ST_Buffer on geography takes meters
    -- We cast to geography to get a geodetic buffer (circle on sphere), then back to geometry (polygon)
    -- ST_SetSRID(ST_MakePoint(longitude, latitude), 4326) creates the center point
    NEW.geometry := ST_Buffer(
        ST_SetSRID(ST_MakePoint(NEW.center_longitude, NEW.center_latitude), 4326)::geography,
        NEW.radius_km * 1000
    )::geometry;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_service_area_geometry ON public.service_areas;

CREATE TRIGGER trg_update_service_area_geometry
BEFORE INSERT OR UPDATE OF center_latitude, center_longitude, radius_km
ON public.service_areas
FOR EACH ROW
EXECUTE FUNCTION update_service_area_geometry();

-- Update existing records to ensure geometry is consistent
UPDATE service_areas 
SET geometry = ST_Buffer(
    ST_SetSRID(ST_MakePoint(center_longitude, center_latitude), 4326)::geography,
    radius_km * 1000
)::geometry;
