-- ===========================================
-- DIRECT SQL FIX FOR DRIVER STATS
-- ===========================================
-- Copy this ENTIRE script and paste it into:
-- Supabase Dashboard -> SQL Editor -> Run
-- ===========================================

-- 1. Create the function to update stats
CREATE OR REPLACE FUNCTION update_driver_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if the booking status changed to 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    
    -- Update the driver's total_trips and total_earnings
    UPDATE drivers
    SET 
      total_trips = COALESCE(total_trips, 0) + 1,
      total_earnings = COALESCE(total_earnings, 0) + COALESCE(NEW.total_fare, 0), -- Fallback to total_fare
      updated_at = NOW()
    WHERE id = NEW.driver_id;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Drop existing trigger if any
DROP TRIGGER IF EXISTS on_booking_completed_update_stats ON bookings;

-- 3. Create the trigger
CREATE TRIGGER on_booking_completed_update_stats
  AFTER UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION update_driver_stats();

-- 4. (Optional) Backfill existing data if needed
-- This calculates stats from existing completed bookings and updates drivers
WITH calculated_stats AS (
  SELECT 
    driver_id, 
    COUNT(*) as trips, 
    SUM(total_fare) as earnings
  FROM bookings 
  WHERE status = 'completed' AND driver_id IS NOT NULL
  GROUP BY driver_id
)
UPDATE drivers d
SET 
  total_trips = cs.trips,
  total_earnings = cs.earnings
FROM calculated_stats cs
WHERE d.id = cs.driver_id;
