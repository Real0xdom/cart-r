-- Add idempotency_key to bookings table to prevent duplicate bookings
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS idempotency_key TEXT UNIQUE;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_bookings_idempotency_key ON bookings(idempotency_key);

-- Comment
COMMENT ON COLUMN bookings.idempotency_key IS 'Unique key to prevent duplicate booking creation (idempotency)';
