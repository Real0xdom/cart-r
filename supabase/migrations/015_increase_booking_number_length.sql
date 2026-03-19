-- Increase booking_number column size to accommodate longer booking numbers
-- Format: CARTR-{timestamp}-{random} can be up to 30 characters

ALTER TABLE bookings 
ALTER COLUMN booking_number TYPE VARCHAR(50);

-- Add comment
COMMENT ON COLUMN bookings.booking_number IS 'Unique booking identifier in format CARTR-{timestamp}-{random}';
