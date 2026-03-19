-- Trigger to create notifications when a booking is completed

CREATE OR REPLACE FUNCTION notify_on_booking_completion()
RETURNS TRIGGER AS $$
DECLARE
    driver_user_id UUID;
    customer_name TEXT;
    driver_name TEXT;
BEGIN
    -- Only run when status changes to 'completed'
    IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
        
        -- 1. Notify Driver
        -- Get driver's user_id from drivers table
        SELECT user_id INTO driver_user_id
        FROM drivers
        WHERE id = NEW.driver_id;

        IF driver_user_id IS NOT NULL THEN
            INSERT INTO notifications (user_id, title, body, is_read)
            VALUES (
                driver_user_id,
                'Trip Completed 🎉',
                'You earned ₹' || COALESCE(NEW.driver_payout, NEW.total_fare, 0)::TEXT || ' for trip ' || NEW.booking_number,
                false
            );
        END IF;

        -- 2. Notify Customer
        -- Get driver name for the message
        SELECT u.name INTO driver_name
        FROM drivers d
        JOIN users u ON u.id = d.user_id
        WHERE d.id = NEW.driver_id;

        INSERT INTO notifications (user_id, title, body, is_read)
        VALUES (
            NEW.customer_id,
            'Trip Completed',
            'You have arrived at your destination. How was your ride with ' || COALESCE(driver_name, 'your driver') || '?',
            false
        );

    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
DROP TRIGGER IF EXISTS on_booking_completed_notify ON bookings;

CREATE TRIGGER on_booking_completed_notify
  AFTER UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_booking_completion();
