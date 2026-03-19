-- =====================================================
-- PostGIS Functions for Driver Location Queries
-- =====================================================

-- Function to find nearby available drivers
-- Uses Haversine formula for distance calculation
CREATE OR REPLACE FUNCTION find_nearby_drivers(
    pickup_lat DECIMAL,
    pickup_lng DECIMAL,
    radius_km DECIMAL DEFAULT 10,
    required_vehicle_type vehicle_type DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    vehicle_type vehicle_type,
    vehicle_number VARCHAR,
    vehicle_model VARCHAR,
    rating DECIMAL,
    current_latitude DECIMAL,
    current_longitude DECIMAL,
    distance_km DECIMAL,
    user_name VARCHAR,
    user_phone VARCHAR,
    user_avatar TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        d.id,
        d.user_id,
        d.vehicle_type,
        d.vehicle_number,
        d.vehicle_model,
        d.rating,
        d.current_latitude,
        d.current_longitude,
        -- Haversine formula for distance
        (6371 * acos(
            LEAST(1.0, -- Clamp to avoid floating point errors
                cos(radians(pickup_lat)) * cos(radians(d.current_latitude)) *
                cos(radians(d.current_longitude) - radians(pickup_lng)) +
                sin(radians(pickup_lat)) * sin(radians(d.current_latitude))
            )
        ))::DECIMAL AS distance_km,
        u.name AS user_name,
        u.phone AS user_phone,
        u.avatar_url AS user_avatar
    FROM drivers d
    JOIN users u ON d.user_id = u.id
    WHERE 
        d.is_online = true
        AND d.verification_status = 'approved'
        AND d.current_latitude IS NOT NULL
        AND d.current_longitude IS NOT NULL
        AND (required_vehicle_type IS NULL OR d.vehicle_type = required_vehicle_type)
        -- Pre-filter using bounding box for performance
        AND d.current_latitude BETWEEN (pickup_lat - (radius_km / 111.0)) AND (pickup_lat + (radius_km / 111.0))
        AND d.current_longitude BETWEEN (pickup_lng - (radius_km / (111.0 * cos(radians(pickup_lat))))) 
                                     AND (pickup_lng + (radius_km / (111.0 * cos(radians(pickup_lat)))))
    HAVING 
        (6371 * acos(
            LEAST(1.0,
                cos(radians(pickup_lat)) * cos(radians(d.current_latitude)) *
                cos(radians(d.current_longitude) - radians(pickup_lng)) +
                sin(radians(pickup_lat)) * sin(radians(d.current_latitude))
            )
        )) <= radius_km
    ORDER BY 
        distance_km ASC,
        d.rating DESC
    LIMIT 20;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Add Expo Push Token to Users Table
-- =====================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS expo_push_token TEXT;

-- Index for faster token lookups
CREATE INDEX IF NOT EXISTS idx_users_push_token ON users (expo_push_token) WHERE expo_push_token IS NOT NULL;

-- =====================================================
-- Support Tickets Table (for Week 5 Support System)
-- =====================================================

CREATE TABLE IF NOT EXISTS support_tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    booking_id UUID REFERENCES bookings(id),
    subject VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    assigned_to UUID REFERENCES users(id),
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER update_support_tickets_updated_at
    BEFORE UPDATE ON support_tickets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- RLS for support tickets
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tickets" ON support_tickets
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create tickets" ON support_tickets
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Admins can view and update all tickets (will need admin role check)

-- =====================================================
-- Emergency Contacts Table (for SOS feature)
-- =====================================================

CREATE TABLE IF NOT EXISTS emergency_contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    relationship VARCHAR(50),
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_emergency_contacts_user ON emergency_contacts (user_id);

ALTER TABLE emergency_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own contacts" ON emergency_contacts
    FOR ALL USING (auth.uid() = user_id);

-- =====================================================
-- Emergency Alerts Table (SOS logs)
-- =====================================================

CREATE TABLE IF NOT EXISTS emergency_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    booking_id UUID REFERENCES bookings(id),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    alert_type VARCHAR(50) DEFAULT 'sos',
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'false_alarm')),
    notified_contacts TEXT[], -- Array of phone numbers notified
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

CREATE INDEX idx_emergency_alerts_user ON emergency_alerts (user_id, created_at DESC);

ALTER TABLE emergency_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own alerts" ON emergency_alerts
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create alerts" ON emergency_alerts
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- Optimize Driver Location Index
-- =====================================================

-- Drop old index if exists
DROP INDEX IF EXISTS idx_drivers_location;

-- Create optimized spatial index
CREATE INDEX IF NOT EXISTS idx_drivers_location_online 
ON drivers (current_latitude, current_longitude, vehicle_type)
WHERE is_online = true AND verification_status = 'approved';

-- Index for last location update (for stale location cleanup)
CREATE INDEX IF NOT EXISTS idx_drivers_last_update 
ON drivers (last_location_update)
WHERE is_online = true;
