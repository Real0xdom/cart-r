
import { getAuthenticatedClient } from './setup';

async function runDriverCancel() {
    console.log('\n--- STARTED: SCENARIO 2 (DRIVER CANCEL) ---\n');

    try {
        const { client: customerClient, user: customer } = await getAuthenticatedClient('customer');
        const { client: driverClient, user: driver, driverId } = await getAuthenticatedClient('driver');

        // 1. Create Booking
        console.log('[DriverCancel] Creating booking...');
        const { data: booking, error: bError } = await customerClient
            .from('bookings')
            .insert({
                customer_id: customer.id,
                origin_address: 'Cancel Test Origin',
                origin_latitude: 12.9716,
                origin_longitude: 77.5946,
                destination_address: 'Cancel Test Dest',
                destination_latitude: 12.9352,
                destination_longitude: 77.6245,
                vehicle_type: 'bike',
                status: 'pending',
                total_fare: 100,
                pickup_otp: '2222'
            })
            .select()
            .single();
        
        if (bError) throw bError;
        console.log(`[DriverCancel] Booking ID: ${booking.id}`);

        // 2. Accept
        await driverClient
            .from('bookings')
            .update({ status: 'accepted', driver_id: driverId })
            .eq('id', booking.id);
        
        console.log('[DriverCancel] Driver accepted.');

        // 3. Driver Cancels (RPC)
        console.log('[DriverCancel] Calling cancel_booking_by_driver...');
        const { data: rpcResult, error: rpcError } = await driverClient.rpc('cancel_booking_by_driver', {
            p_booking_id: booking.id,
            p_driver_id: driverId,
            p_reason: 'Testing driver cancellation before pickup'
        });

        if (rpcError) throw new Error(`RPC Failed: ${rpcError.message}`);
        console.log('[DriverCancel] RPC Success.');

        // 4. Verify State
        const { data: finalBooking } = await customerClient.from('bookings').select('*').eq('id', booking.id).single();
        
        console.log(`[DriverCancel] Final Status: ${finalBooking.status} (Expected: cancelled)`);
        console.log(`[DriverCancel] Refund Status: ${finalBooking.refund_status ?? 'n/a'}`);

        if (finalBooking.status !== 'cancelled') throw new Error('Booking was not cancelled');
        console.log('[DriverCancel] Cancellation verified.');

        console.log('\n--- SUCCESS: SCENARIO 2 COMPLETED ---\n');

    } catch (e: any) {
        console.error('\n!!! FAILURE: SCENARIO 2 FAILED !!!');
        console.error(e.message);
        process.exit(1);
    }
}

runDriverCancel();
