
import { getAuthenticatedClient } from './setup';

async function runCustomerCancel() {
    console.log('\n--- STARTED: SCENARIO 4 (CUSTOMER CANCEL) ---\n');

    try {
        const { client: customerClient, user: customer } = await getAuthenticatedClient('customer');
        const { client: driverClient, user: driver, driverId } = await getAuthenticatedClient('driver');

        // 1. Create Booking
        const { data: booking } = await customerClient
            .from('bookings')
            .insert({
                 customer_id: customer.id,
                 origin_address: 'CustCancel Origin',
                 vehicle_type: 'bike',
                 status: 'pending',
                 total_fare: 120,
                 pickup_otp: '4444'
            })
            .select()
            .single();
        console.log(`[CustCancel] Booking created: ${booking.id}`);

        // 2. Driver Accepts
        await driverClient
            .from('bookings')
            .update({ status: 'accepted', driver_id: driverId })
            .eq('id', booking.id);
        console.log('[CustCancel] Driver accepted.');
        
        // 3. Customer Cancels
        console.log('[CustCancel] Customer cancelling...');
        const { error: cancelError } = await customerClient
            .from('bookings')
            .update({ 
                status: 'cancelled',
                cancellation_reason: 'Changed mind'
            })
            .eq('id', booking.id);

        if (cancelError) throw new Error(`Cancel failed: ${cancelError.message}`);

        // 4. Verify Status
        const { data: final } = await customerClient
            .from('bookings')
            .select('status')
            .eq('id', booking.id)
            .single();

        console.log(`[CustCancel] Final Status: ${final.status} (Expected: cancelled)`);
        if (final.status !== 'cancelled') throw new Error('Status not updated to cancelled');

        console.log('\n--- SUCCESS: SCENARIO 4 COMPLETED ---\n');

    } catch (e: any) {
         console.error('\n!!! FAILURE: SCENARIO 4 FAILED !!!');
         console.error(e.message);
         process.exit(1);
    }
}

runCustomerCancel();
