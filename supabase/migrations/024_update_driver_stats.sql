-- Migration: 024_update_driver_stats.sql
-- Purpose: Automatically update driver stats (trips/earnings) when a booking is completed

CREATE OR REPLACE FUNCTION update_driver_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if the booking status changed to 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    
    -- Update the driver's total_trips and total_earnings
    -- We prefer 'driver_payout' if it exists/is not null, otherwise 'total_fare'
    -- Note: Assuming driver_payout column exists based on previous RPCs. 
    -- If driver_payout is null, we use total_fare.
    UPDATE drivers
    SET 
      total_trips = COALESCE(total_trips, 0) + 1,
      total_earnings = COALESCE(total_earnings, 0) + COALESCE(NEW.driver_payout, NEW.total_fare, 0),
      updated_at = NOW()
    WHERE id = NEW.driver_id;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists to prevent duplicates
DROP TRIGGER IF EXISTS on_booking_completed_update_stats ON bookings;

-- Create the trigger
CREATE TRIGGER on_booking_completed_update_stats
  AFTER UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION update_driver_stats();
