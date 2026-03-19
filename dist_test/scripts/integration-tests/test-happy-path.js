"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const setup_1 = require("./setup");
async function runHappyPath() {
    console.log('\n--- STARTED: SCENARIO 1 (HAPPY PATH) ---\n');
    try {
        // 1. Setup Users
        const { client: customerClient, user: customer } = await (0, setup_1.getAuthenticatedClient)('customer');
        const { client: driverClient, user: driver, driverId } = await (0, setup_1.getAuthenticatedClient)('driver');
        console.log(`[HappyPath] Users ready. Cust: ${customer.id.slice(0, 5)}, Driver: ${driverId === null || driverId === void 0 ? void 0 : driverId.slice(0, 5)}`);
        // 2. Customer Creates Booking
        console.log('[HappyPath] Creating booking...');
        const bookingData = {
            customer_id: customer.id, // Using explicit ID although RLS might infer
            origin_address: 'Test Origin 123',
            origin_latitude: 12.9716,
            origin_longitude: 77.5946,
            destination_address: 'Test Dest 456',
            destination_latitude: 12.9352,
            destination_longitude: 77.6245,
            vehicle_type: 'bike',
            status: 'pending',
            total_fare: 150,
            payment_method: 'cash',
            pickup_otp: '1111'
        };
        const { data: booking, error: bookingError } = await customerClient
            .from('bookings')
            .insert(bookingData)
            .select()
            .single();
        if (bookingError)
            throw new Error(`Booking Creation Failed: ${bookingError.message}`);
        console.log(`[HappyPath] Booking created: ${booking.id} (${booking.status})`);
        // 3. Driver Accepts Booking
        console.log('[HappyPath] Driver accepting...');
        // In real app, driver calls 'update' or RPC. Let's use update as per app logic.
        const { error: acceptError } = await driverClient
            .from('bookings')
            .update({
            status: 'accepted',
            driver_id: driverId,
            accepted_at: new Date().toISOString()
        })
            .eq('id', booking.id);
        if (acceptError)
            throw new Error(`Driver Accept Failed: ${acceptError.message}`);
        // Verify Status
        const { data: b1 } = await customerClient.from('bookings').select('status').eq('id', booking.id).single();
        console.log(`[HappyPath] Status check: ${b1.status} (Expected: accepted)`);
        if (b1.status !== 'accepted')
            throw new Error('Status mismatch after accept');
        // 4. Driver Arrives
        console.log('[HappyPath] Driver arrived...');
        await driverClient.from('bookings').update({ status: 'driver_arrived' }).eq('id', booking.id);
        const { data: b2 } = await customerClient.from('bookings').select('status').eq('id', booking.id).single();
        console.log(`[HappyPath] Status check: ${b2.status} (Expected: driver_arrived)`);
        // 5. Driver Starts Trip (OTP Verify)
        console.log('[HappyPath] Starting trip (Verify OTP 1111)...');
        // Driver app checks OTP locally or via RPC. We simulate the update that happens after verify.
        const { error: startError } = await driverClient
            .from('bookings')
            .update({
            status: 'in_progress',
            started_at: new Date().toISOString()
        })
            .eq('id', booking.id);
        if (startError)
            throw new Error(`Start Trip Failed: ${startError.message}`);
        const { data: b3 } = await customerClient.from('bookings').select('status').eq('id', booking.id).single();
        console.log(`[HappyPath] Status check: ${b3.status} (Expected: in_progress)`);
        // 6. Complete Trip
        console.log('[HappyPath] Completing trip...');
        const { error: completeError } = await driverClient
            .from('bookings')
            .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            payment_status: 'completed' // simulating cash collected
        })
            .eq('id', booking.id);
        if (completeError)
            throw new Error(`Complete Trip Failed: ${completeError.message}`);
        const { data: b4 } = await customerClient.from('bookings').select('status').eq('id', booking.id).single();
        console.log(`[HappyPath] Status check: ${b4.status} (Expected: completed)`);
        console.log('\n--- SUCCESS: SCENARIO 1 COMPLETED ---\n');
    }
    catch (e) {
        console.error('\n!!! FAILURE: SCENARIO 1 FAILED !!!');
        console.error(e.message);
        process.exit(1);
    }
}
runHappyPath();
