-- Migration: 005_booking_enhancements.sql
-- Purpose: Add receiver details, tip/pricing, and delivery confirmation

-- =====================================================
-- RECEIVER INFORMATION
-- =====================================================
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS receiver_name VARCHAR(255);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS receiver_phone VARCHAR(20);

-- =====================================================
-- GOODS INFORMATION (optional but useful for logistics)
-- =====================================================
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS goods_description TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS goods_weight_kg DECIMAL(10,2);

-- =====================================================
-- TIP AND FARE ADJUSTMENTS (for retry with increased price)
-- =====================================================
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS tip_amount DECIMAL(10,2) DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS fare_multiplier DECIMAL(3,2) DEFAULT 1.00;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS driver_payout DECIMAL(10,2);
-- driver_payout = (total_fare * fare_multiplier) + tip_amount

-- =====================================================
-- DELIVERY CONFIRMATION
-- =====================================================
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS delivery_otp VARCHAR(6);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS delivery_confirmed_at TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS delivery_proof_url TEXT;
-- delivery_proof_url: Optional photo proof of delivery

-- =====================================================
-- PERFORMANCE INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_customer ON bookings(customer_id);
CREATE INDEX IF NOT EXISTS idx_bookings_driver ON bookings(driver_id);
CREATE INDEX IF NOT EXISTS idx_bookings_pending ON bookings(status, driver_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_bookings_created_at ON bookings(created_at DESC);

-- =====================================================
-- TRIGGER: Auto-calculate driver_payout on insert/update
-- =====================================================
CREATE OR REPLACE FUNCTION calculate_driver_payout()
RETURNS TRIGGER AS $$
BEGIN
  NEW.driver_payout := (COALESCE(NEW.total_fare, 0) * COALESCE(NEW.fare_multiplier, 1.00)) + COALESCE(NEW.tip_amount, 0);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS bookings_calculate_payout ON bookings;
CREATE TRIGGER bookings_calculate_payout
  BEFORE INSERT OR UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION calculate_driver_payout();

-- =====================================================
-- Generate 6-digit delivery OTP on booking creation
-- =====================================================
CREATE OR REPLACE FUNCTION generate_delivery_otp()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.delivery_otp IS NULL THEN
    NEW.delivery_otp := LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS bookings_delivery_otp ON bookings;
CREATE TRIGGER bookings_delivery_otp
  BEFORE INSERT ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION generate_delivery_otp();
