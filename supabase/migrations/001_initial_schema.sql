-- =====================================================
-- Porter-like Logistics App - Initial Database Schema
-- =====================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis"; -- For geospatial queries

-- =====================================================
-- ENUMS
-- =====================================================

CREATE TYPE user_role AS ENUM ('customer', 'driver', 'admin');
CREATE TYPE vehicle_type AS ENUM ('bike', 'auto', 'mini', 'sedan', 'suv', 'truck');
CREATE TYPE booking_status AS ENUM ('pending', 'accepted', 'driver_arrived', 'in_progress', 'completed', 'cancelled');
CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'refunded');
CREATE TYPE payment_method AS ENUM ('cash', 'online');
CREATE TYPE verification_status AS ENUM ('pending', 'approved', 'rejected');

-- =====================================================
-- USERS TABLE
-- =====================================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    role user_role DEFAULT 'customer',
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- DRIVERS TABLE
-- =====================================================

CREATE TABLE drivers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    
    -- Vehicle Details
    vehicle_type vehicle_type NOT NULL,
    vehicle_number VARCHAR(20) NOT NULL,
    vehicle_model VARCHAR(100) NOT NULL,
    vehicle_color VARCHAR(50),
    vehicle_image_url TEXT,
    
    -- License & Documents
    license_number VARCHAR(50) NOT NULL,
    license_expiry DATE NOT NULL,
    license_image_url TEXT,
    rc_image_url TEXT,
    insurance_image_url TEXT,
    
    -- Verification
    verification_status verification_status DEFAULT 'pending',
    verified_at TIMESTAMPTZ,
    verified_by UUID REFERENCES users(id),
    rejection_reason TEXT,
    
    -- Status
    is_online BOOLEAN DEFAULT false,
    current_latitude DECIMAL(10, 8),
    current_longitude DECIMAL(11, 8),
    last_location_update TIMESTAMPTZ,
    
    -- Stats
    rating DECIMAL(3, 2) DEFAULT 5.00,
    total_trips INTEGER DEFAULT 0,
    total_earnings DECIMAL(12, 2) DEFAULT 0.00,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER update_drivers_updated_at
    BEFORE UPDATE ON drivers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Index for finding nearby drivers
CREATE INDEX idx_drivers_location ON drivers (current_latitude, current_longitude)
    WHERE is_online = true AND verification_status = 'approved';

-- =====================================================
-- BOOKINGS TABLE
-- =====================================================

CREATE TABLE bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_number VARCHAR(20) UNIQUE NOT NULL, -- Human readable ID like "BK-20251225-001"
    
    -- Parties
    customer_id UUID NOT NULL REFERENCES users(id),
    driver_id UUID REFERENCES drivers(id),
    
    -- Pickup Location
    origin_address TEXT NOT NULL,
    origin_latitude DECIMAL(10, 8) NOT NULL,
    origin_longitude DECIMAL(11, 8) NOT NULL,
    origin_landmark TEXT,
    
    -- Drop Location
    destination_address TEXT NOT NULL,
    destination_latitude DECIMAL(10, 8) NOT NULL,
    destination_longitude DECIMAL(11, 8) NOT NULL,
    destination_landmark TEXT,
    
    -- Trip Details
    vehicle_type vehicle_type NOT NULL,
    estimated_distance DECIMAL(10, 2), -- in km
    estimated_duration INTEGER, -- in minutes
    actual_distance DECIMAL(10, 2),
    actual_duration INTEGER,
    
    -- Fare
    base_fare DECIMAL(10, 2) NOT NULL,
    distance_fare DECIMAL(10, 2) DEFAULT 0,
    time_fare DECIMAL(10, 2) DEFAULT 0,
    surge_multiplier DECIMAL(3, 2) DEFAULT 1.00,
    discount_amount DECIMAL(10, 2) DEFAULT 0,
    total_fare DECIMAL(10, 2) NOT NULL,
    
    -- Payment
    payment_status payment_status DEFAULT 'pending',
    payment_method payment_method DEFAULT 'cash',
    payment_id VARCHAR(100), -- Cashfree transaction ID
    
    -- Status
    status booking_status DEFAULT 'pending',
    scheduled_at TIMESTAMPTZ, -- For scheduled bookings
    accepted_at TIMESTAMPTZ,
    driver_arrived_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    cancelled_by UUID REFERENCES users(id),
    cancellation_reason TEXT,
    
    -- OTP for verification
    pickup_otp VARCHAR(6),
    
    -- Notes
    customer_notes TEXT,
    driver_notes TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER update_bookings_updated_at
    BEFORE UPDATE ON bookings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Indexes
CREATE INDEX idx_bookings_customer ON bookings (customer_id, created_at DESC);
CREATE INDEX idx_bookings_driver ON bookings (driver_id, created_at DESC);
CREATE INDEX idx_bookings_status ON bookings (status) WHERE status IN ('pending', 'accepted', 'in_progress');

-- Function to generate booking number
CREATE OR REPLACE FUNCTION generate_booking_number()
RETURNS TRIGGER AS $$
DECLARE
    today_count INTEGER;
BEGIN
    SELECT COUNT(*) + 1 INTO today_count 
    FROM bookings 
    WHERE DATE(created_at) = CURRENT_DATE;
    
    NEW.booking_number := 'BK-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(today_count::TEXT, 3, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_booking_number
    BEFORE INSERT ON bookings
    FOR EACH ROW
    EXECUTE FUNCTION generate_booking_number();

-- =====================================================
-- DRIVER LOCATIONS TABLE (for tracking history)
-- =====================================================

CREATE TABLE driver_locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
    booking_id UUID REFERENCES bookings(id), -- Optional, for trip tracking
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    heading DECIMAL(5, 2), -- Direction in degrees
    speed DECIMAL(6, 2), -- km/h
    accuracy DECIMAL(6, 2), -- GPS accuracy in meters
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Partition by time for better performance (optional, depending on scale)
CREATE INDEX idx_driver_locations_driver ON driver_locations (driver_id, recorded_at DESC);
CREATE INDEX idx_driver_locations_booking ON driver_locations (booking_id, recorded_at ASC);

-- =====================================================
-- RATINGS TABLE
-- =====================================================

CREATE TABLE ratings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID NOT NULL REFERENCES bookings(id),
    from_user_id UUID NOT NULL REFERENCES users(id),
    to_user_id UUID NOT NULL REFERENCES users(id),
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    review TEXT,
    is_from_customer BOOLEAN NOT NULL, -- true if customer rating driver
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(booking_id, from_user_id) -- One rating per booking per person
);

CREATE INDEX idx_ratings_to_user ON ratings (to_user_id, created_at DESC);

-- Trigger to update driver rating
CREATE OR REPLACE FUNCTION update_driver_rating()
RETURNS TRIGGER AS $$
DECLARE
    driver_user_id UUID;
    driver_record_id UUID;
BEGIN
    -- Only update if customer is rating driver
    IF NEW.is_from_customer = true THEN
        SELECT d.id INTO driver_record_id
        FROM drivers d
        WHERE d.user_id = NEW.to_user_id;
        
        IF driver_record_id IS NOT NULL THEN
            UPDATE drivers
            SET rating = (
                SELECT AVG(r.rating)::DECIMAL(3,2)
                FROM ratings r
                JOIN drivers d ON d.user_id = r.to_user_id
                WHERE d.id = driver_record_id
            )
            WHERE id = driver_record_id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_driver_rating_trigger
    AFTER INSERT ON ratings
    FOR EACH ROW
    EXECUTE FUNCTION update_driver_rating();

-- =====================================================
-- FARE CONFIGURATION TABLE
-- =====================================================

CREATE TABLE fare_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vehicle_type vehicle_type UNIQUE NOT NULL,
    base_fare DECIMAL(10, 2) NOT NULL,
    per_km_rate DECIMAL(10, 2) NOT NULL,
    per_minute_rate DECIMAL(10, 2) NOT NULL,
    minimum_fare DECIMAL(10, 2) NOT NULL,
    cancellation_fee DECIMAL(10, 2) DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default fare configuration
INSERT INTO fare_config (vehicle_type, base_fare, per_km_rate, per_minute_rate, minimum_fare) VALUES
('bike', 25, 8, 1, 30),
('auto', 35, 12, 1.5, 40),
('mini', 50, 15, 2, 60),
('sedan', 70, 18, 2.5, 80),
('suv', 100, 22, 3, 120),
('truck', 150, 25, 3.5, 200);

-- =====================================================
-- NOTIFICATIONS TABLE
-- =====================================================

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    data JSONB, -- Additional data for deep linking
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications (user_id, created_at DESC);

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can read their own data
CREATE POLICY "Users can view own profile" ON users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE USING (auth.uid() = id);

-- Drivers can view their own driver profile
CREATE POLICY "Drivers can view own driver profile" ON drivers
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Drivers can update own driver profile" ON drivers
    FOR UPDATE USING (auth.uid() = user_id);

-- Customers can view verified online drivers
CREATE POLICY "Customers can view available drivers" ON drivers
    FOR SELECT USING (
        is_online = true 
        AND verification_status = 'approved'
    );

-- Booking policies
CREATE POLICY "Users can view own bookings" ON bookings
    FOR SELECT USING (
        auth.uid() = customer_id 
        OR auth.uid() IN (SELECT user_id FROM drivers WHERE id = driver_id)
    );

CREATE POLICY "Customers can create bookings" ON bookings
    FOR INSERT WITH CHECK (auth.uid() = customer_id);

-- Driver locations
CREATE POLICY "Drivers can insert own location" ON driver_locations
    FOR INSERT WITH CHECK (
        auth.uid() IN (SELECT user_id FROM drivers WHERE id = driver_id)
    );

-- Ratings
CREATE POLICY "Users can create ratings for their bookings" ON ratings
    FOR INSERT WITH CHECK (auth.uid() = from_user_id);

CREATE POLICY "Users can view ratings" ON ratings
    FOR SELECT USING (true);

-- Notifications
CREATE POLICY "Users can view own notifications" ON notifications
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications" ON notifications
    FOR UPDATE USING (auth.uid() = user_id);

-- =====================================================
-- REALTIME SUBSCRIPTIONS
-- =====================================================

-- Enable realtime for bookings (for live status updates)
ALTER PUBLICATION supabase_realtime ADD TABLE bookings;

-- Enable realtime for driver_locations (for live tracking)
ALTER PUBLICATION supabase_realtime ADD TABLE driver_locations;

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
