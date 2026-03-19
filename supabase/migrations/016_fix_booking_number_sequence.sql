-- Fix booking number generation to use sequence instead of count
-- This prevents race conditions and duplicate booking numbers

-- Drop the old trigger and function
DROP TRIGGER IF EXISTS set_booking_number ON bookings;
DROP FUNCTION IF EXISTS generate_booking_number();

-- Create a sequence for booking numbers (resets daily via application logic or cron)
CREATE SEQUENCE IF NOT EXISTS booking_number_seq START 1;

-- New function using sequence for atomic booking number generation
CREATE OR REPLACE FUNCTION generate_booking_number()
RETURNS TRIGGER AS $$
DECLARE
    seq_num INTEGER;
    booking_num TEXT;
BEGIN
    -- Only generate if booking_number is not provided
    IF NEW.booking_number IS NULL OR NEW.booking_number = '' THEN
        -- Get next sequence value
        seq_num := nextval('booking_number_seq');
        
        -- Generate booking number with timestamp and sequence
        -- Format: BK-YYYYMMDD-SEQNUM (e.g., BK-20260103-00001)
        booking_num := 'BK-' || 
                      TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || 
                      LPAD(seq_num::TEXT, 5, '0');
        
        NEW.booking_number := booking_num;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
CREATE TRIGGER set_booking_number
    BEFORE INSERT ON bookings
    FOR EACH ROW
    EXECUTE FUNCTION generate_booking_number();

-- Grant usage on sequence
GRANT USAGE, SELECT ON SEQUENCE booking_number_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE booking_number_seq TO anon;
