-- Add index for payment status filtering (used by driver search)
CREATE INDEX IF NOT EXISTS idx_bookings_payment_confirmed ON bookings(status) 
  WHERE status = 'payment_confirmed';
