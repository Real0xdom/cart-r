-- INSTRUCTIONS:
-- 1. Replace the "customer_id" below with a valid user UUID from your `users` table.
-- 2. Make sure the driver is ONLINE and their current_latitude/longitude match exactly roughly what's below (or change the origin_latitude/longitude to match the driver's location).
-- 3. Execute this in the Supabase SQL Editor. 
-- 4. Check the `notifications` table immediately after to see if a record was inserted.

INSERT INTO public.bookings (
    customer_id,
    vehicle_type,
    status,
    origin_address,
    destination_address,
    total_fare,
    driver_payout,
    estimated_distance,
    origin_latitude,
    origin_longitude,
    driver_search_radius_km
) VALUES (
    (SELECT id FROM public.users WHERE role = 'customer' LIMIT 1), -- Auto-grab a customer
    'bike', -- Change string to match your driver's active vehicle type ('bike', 'auto', 'mini', etc.)
    'pending',
    'Test Pickup Location',
    'Test Dropoff Location',
    150.0,
    130.0,
    5.5,
    -- NOTE: These coordinates must be within 10km of the online driver!
    -- Check public.drivers to find the current_latitude/current_longitude of your test driver.
    18.5204, 
    73.8567,
    15.0
) RETURNING id;
