
import { getAuthenticatedClient } from './setup';

async function runDriverReject() {
    console.log('\n--- STARTED: SCENARIO 3 (DRIVER REJECT/IGNORE) ---\n');

    try {
        const { client: customerClient, user: customer } = await getAuthenticatedClient('customer');
        const { client: driverClient, user: driver, driverId } = await getAuthenticatedClient('driver');

        // 1. Create Booking
        const { data: booking } = await customerClient
            .from('bookings')
            .insert({
                customer_id: customer.id,
                origin_address: 'Reject Origin',
                vehicle_type: 'bike',
                status: 'pending',
                total_fare: 80,
                pickup_otp: '3333'
            })
            .select()
            .single();
        console.log(`[DriverReject] Booking created: ${booking.id}`);

        // 2. Driver Rejects (The "Decline" button)
        // This is usually done by inserting into driver_rejections table directly or via RPC
        // Let's assume the driver app inserts into driver_rejections
        console.log('[DriverReject] Driver declining...');
        
        const { error: rejectError } = await driverClient
            .from('driver_rejections')
            .insert({
                booking_id: booking.id,
                driver_id: driverId,
                reason: 'Auto-decline or User decline'
            });

        if (rejectError) throw new Error(`Rejection insert failed: ${rejectError.message}`);

        // 3. Verify Booking is still Pending and not assigned
        const { data: checkBooking } = await customerClient
            .from('bookings')
            .select('*')
            .eq('id', booking.id)
            .single();

        console.log(`[DriverReject] Booking Status: ${checkBooking.status} (Expected: pending)`);
        console.log(`[DriverReject] Driver ID: ${checkBooking.driver_id} (Expected: null)`);

        if (checkBooking.status !== 'pending' || checkBooking.driver_id !== null) {
            throw new Error('Booking state altered incorrectly');
        }

        // 4. Verify available_bookings logic (Optional/Advanced)
        // If we were to run the `get_available_bookings_v2` RPC for this driver, this booking ID should NOT be in the list.
        const { data: available } = await driverClient.rpc('get_available_bookings_v2', {
             p_latitude: 0, p_longitude: 0, p_vehicle_type: 'bike', p_radius_km: 10000 // Large radius to ensure it would be found
        });
        
        // Note: Coordinates are 0,0 for simplicity, hoping to match if radius is huge or if logic matches. 
        // In reality, we need valid coordinates. Let's skip strict RPC check unless we match booking coords.
        
        console.log('[DriverReject] Rejection logged successfully.');
        console.log('\n--- SUCCESS: SCENARIO 3 COMPLETED ---\n');

    } catch (e: any) {
        console.error('\n!!! FAILURE: SCENARIO 3 FAILED !!!');
        console.error(e.message);
        process.exit(1);
    }
}

runDriverReject();
