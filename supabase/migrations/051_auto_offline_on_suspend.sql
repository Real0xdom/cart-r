-- Migration: 051_auto_offline_on_suspend.sql
-- Fix G7: When an admin suspends (or un-verifies) a driver, automatically force
-- is_online = false so the driver cannot receive ride requests or be visible to
-- the notify_nearby_drivers trigger.

CREATE OR REPLACE FUNCTION handle_driver_verification_change()
RETURNS TRIGGER AS $$
BEGIN
  -- When verification_status changes AWAY from 'approved', force driver offline
  IF OLD.verification_status = 'approved' AND NEW.verification_status != 'approved' THEN
    NEW.is_online := false;
    RAISE NOTICE '[G7] Driver % suspended/unverified — forced offline', NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if any, then recreate
DROP TRIGGER IF EXISTS trg_driver_auto_offline_on_suspend ON drivers;

CREATE TRIGGER trg_driver_auto_offline_on_suspend
  BEFORE UPDATE OF verification_status ON drivers
  FOR EACH ROW
  EXECUTE FUNCTION handle_driver_verification_change();

SELECT 'Migration 051_auto_offline_on_suspend completed successfully' AS result;
