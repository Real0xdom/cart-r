"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const setup_1 = require("./setup");
async function runDriverCancel() {
    console.log('\n--- STARTED: SCENARIO 2 (DRIVER CANCEL) ---\n');
    try {
        const { client: customerClient, user: customer } = await (0, setup_1.getAuthenticatedClient)('customer');
        const { client: driverClient, user: driver, driverId } = await (0, setup_1.getAuthenticatedClient)('driver');
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
        if (bError)
            throw bError;
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
            p_reason: 'Testing Requeue'
        });
        if (rpcError)
            throw new Error(`RPC Failed: ${rpcError.message}`);
        console.log('[DriverCancel] RPC Success.');
        // 4. Verify State
        const { data: finalBooking } = await customerClient.from('bookings').select('*').eq('id', booking.id).single();
        console.log(`[DriverCancel] Final Status: ${finalBooking.status} (Expected: pending)`);
        console.log(`[DriverCancel] Final Driver ID: ${finalBooking.driver_id} (Expected: null)`);
        if (finalBooking.status !== 'pending')
            throw new Error('Booking did not revert to pending');
        if (finalBooking.driver_id !== null)
            throw new Error('Driver ID was not cleared');
        // 5. Verify Rejection Record
        const { data: rejection } = await driverClient
            .from('driver_rejections')
            .select('*')
            .eq('booking_id', booking.id)
            .eq('driver_id', driverId)
            .single();
        if (!rejection)
            throw new Error('Driver rejection record missing');
        console.log('[DriverCancel] Rejection record verified.');
        console.log('\n--- SUCCESS: SCENARIO 2 COMPLETED ---\n');
    }
    catch (e) {
        console.error('\n!!! FAILURE: SCENARIO 2 FAILED !!!');
        console.error(e.message);
        process.exit(1);
    }
}
runDriverCancel();
