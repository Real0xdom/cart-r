-- Create table for tracking driver rejections if it doesn't exist
CREATE TABLE IF NOT EXISTS driver_rejections (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(booking_id, driver_id)
);

-- Function to handle driver cancellation and re-queue booking
CREATE OR REPLACE FUNCTION cancel_booking_by_driver(p_booking_id UUID, p_driver_id UUID, p_reason TEXT DEFAULT 'Cancelled by driver')
RETURNS JSONB AS $$
DECLARE
    v_booking RECORD;
BEGIN
    -- Get booking details
    SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id;

    IF v_booking IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Booking not found');
    END IF;

    -- Ensure the driver is actually assigned
    IF v_booking.driver_id != p_driver_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Driver not assigned to this booking');
    END IF;

    -- 1. Add to driver_rejections so this driver doesn't see it again
    INSERT INTO driver_rejections (booking_id, driver_id)
    VALUES (p_booking_id, p_driver_id)
    ON CONFLICT (booking_id, driver_id) DO NOTHING;

    -- 2. Reset booking to 'pending'
    UPDATE bookings
    SET 
        status = 'pending',
        driver_id = NULL,
        accepted_at = NULL,
        driver_arrived_at = NULL,
        cancellation_reason = p_reason, -- Optional: store last reason
        updated_at = NOW()
    WHERE id = p_booking_id;

    RETURN jsonb_build_object('success', true);

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
