-- Enable real-time for drivers table
-- and add current_heading column for smoother vehicle rotation

-- 1. Add current_heading column to drivers table
ALTER TABLE public.drivers 
ADD COLUMN IF NOT EXISTS current_heading DECIMAL(5, 2);

-- 2. Add drivers table to supabase_realtime publication
-- This allows clients to subscribe to UPDATE events on the drivers table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'drivers'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.drivers;
    END IF;
END $$;

-- 3. Ensure customers can see the heading of assigned drivers
-- (RLS for drivers is already handled in 20260318_restore_customer_assigned_driver_visibility.sql,
-- but that policy covers all columns including any new ones like current_heading)

COMMENT ON COLUMN public.drivers.current_heading IS 'Current direction of travel in degrees (0-360)';
