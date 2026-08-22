-- Migration: Update Ratings Table for Bidirectional Feedback
-- Description: Add new columns to existing ratings table
-- Date: 2026-02-13

-- The ratings table already exists with old schema
-- We need to add new columns to support the new rating system

-- 1. Add new columns to ratings table
ALTER TABLE public.ratings
ADD COLUMN IF NOT EXISTS rated_by UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS rated_user UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS rater_type TEXT CHECK (rater_type IN ('customer', 'driver'));

-- 2. Migrate existing data to new columns
UPDATE public.ratings
SET 
  rated_by = from_user_id,
  rated_user = to_user_id,
  rater_type = CASE 
    WHEN is_from_customer = true THEN 'customer'
    ELSE 'driver'
  END
WHERE rated_by IS NULL;

-- 3. Make new columns NOT NULL after data migration
ALTER TABLE public.ratings
ALTER COLUMN rated_by SET NOT NULL,
ALTER COLUMN rated_user SET NOT NULL,
ALTER COLUMN rater_type SET NOT NULL;

-- 4. Add unique constraint for new schema
-- Drop old constraint if it exists
DROP INDEX IF EXISTS ratings_booking_user_unique;
DO $$
BEGIN
  -- Try to add new unique constraint
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'ratings_booking_rated_by_unique'
  ) THEN
    ALTER TABLE public.ratings
    ADD CONSTRAINT ratings_booking_rated_by_unique UNIQUE (booking_id, rated_by);
  END IF;
END $$;

-- 5. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_ratings_rated_user ON ratings(rated_user);
CREATE INDEX IF NOT EXISTS idx_ratings_rated_by ON ratings(rated_by);
CREATE INDEX IF NOT EXISTS idx_ratings_booking ON ratings(booking_id);

-- 6. Update RLS policies if needed
DROP POLICY IF EXISTS "Users can view ratings for their bookings" ON ratings;
DROP POLICY IF EXISTS "Users can rate their bookings" ON ratings;

-- Create new RLS policies
CREATE POLICY "Users can view ratings for their bookings"
ON ratings FOR SELECT
USING (
  rated_by = auth.uid() OR 
  rated_user = auth.uid() OR
  booking_id IN (
    SELECT id FROM bookings 
    WHERE customer_id = auth.uid() OR driver_id IN (
      SELECT id FROM drivers WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "Users can rate their bookings"
ON ratings FOR INSERT
WITH CHECK (
  rated_by = auth.uid() AND
  booking_id IN (
    SELECT id FROM bookings 
    WHERE customer_id = auth.uid() OR driver_id IN (
      SELECT id FROM drivers WHERE user_id = auth.uid()
    )
  )
);

-- 7. Add comments
COMMENT ON COLUMN ratings.rated_by IS 'User who submitted the rating';
COMMENT ON COLUMN ratings.rated_user IS 'User being rated';
COMMENT ON COLUMN ratings.rater_type IS 'Type of user submitting rating: customer or driver';

-- Note: Old columns (from_user_id, to_user_id, is_from_customer) are kept for backward compatibility
-- You can drop them later once you're sure the new system works:
-- ALTER TABLE ratings DROP COLUMN from_user_id;
-- ALTER TABLE ratings DROP COLUMN to_user_id;
-- ALTER TABLE ratings DROP COLUMN is_from_customer;
