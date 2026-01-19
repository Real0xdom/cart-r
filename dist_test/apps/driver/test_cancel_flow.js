"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const supabase_js_1 = require("@supabase/supabase-js");
// Credentials from apps/driver/env
const SUPABASE_URL = 'https://epevjbiymsvwmmzybzib.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVwZXZqYml5bXN2d21tenliemliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyMjQyODAsImV4cCI6MjA3NzgwMDI4MH0.TTO9koYOJFjjFNMc7g9_blvnpcM_QIb0Zwj13hW0NXI';
const supabase = (0, supabase_js_1.createClient)(SUPABASE_URL, SUPABASE_KEY);
async function runTest() {
    console.log('Starting verification...');
    try {
        // 1. Get a driver and customer
        const { data: drivers, error: driverError } = await supabase.from('drivers').select('id, user_id').limit(1);
        if (driverError) {
            console.error('Error fetching drivers:', driverError);
            return;
        }
        if (!drivers || drivers.length === 0) {
            console.error('No drivers found. Cannot test.');
            return;
        }
        const driver = drivers[0];
        console.log('Using driver:', driver.id);
        // Use driver's user_id as customer_id (Self-booking for test)
        const customerId = driver.user_id;
        console.log('Using customer (driver itself):', customerId);
        // 2. Create a booking
        const bookingNum = `TEST-${Date.now()}`;
        const { data: booking, error: createError } = await supabase.from('bookings').insert({
            customer_id: customerId,
            booking_number: bookingNum,
            origin_address: 'Test Origin',
            origin_latitude: 18.5204,
            origin_longitude: 73.8567,
            destination_address: 'Test Dest',
            destination_latitude: 18.5204,
            destination_longitude: 73.8567,
            vehicle_type: 'bike',
            total_fare: 50,
            status: 'pending', // Initially pending
            payment_method: 'cash',
            pickup_otp: '1234'
        }).select().single();
        if (createError) {
            console.error('Failed to create booking:', createError);
            return;
        }
        console.log('Created booking:', booking.id, booking.booking_number);
        // 3. Accept booking (simulate driver acceptance)
        const { error: acceptError } = await supabase.from('bookings').update({
            status: 'accepted',
            driver_id: driver.id,
            accepted_at: new Date().toISOString()
        }).eq('id', booking.id);
        if (acceptError) {
            console.error('Failed to accept booking:', acceptError);
            return;
        }
        console.log('Booking accepted by driver.');
        // 4. Cancel booking properly via RPC
        console.log('Calling cancel_booking_by_driver...');
        const { data: rpcData, error: rpcError } = await supabase.rpc('cancel_booking_by_driver', {
            p_booking_id: booking.id,
            p_driver_id: driver.id,
            p_reason: 'Test cancellation verification'
        });
        if (rpcError) {
            console.error('RPC Failed:', rpcError);
            console.log('RPC Error Details:', JSON.stringify(rpcError, null, 2));
            return;
        }
        console.log('RPC Result:', rpcData);
        // 5. Verify status
        const { data: finalBooking, error: fetchError } = await supabase.from('bookings').select('*').eq('id', booking.id).single();
        if (fetchError) {
            console.error('Failed to fetch final booking:', fetchError);
            return;
        }
        console.log('Final Booking Status:', finalBooking.status);
        console.log('Final Driver ID:', finalBooking.driver_id);
        if (finalBooking.status === 'pending' && finalBooking.driver_id === null) {
            console.log('SUCCESS: Booking reverted to pending.');
        }
        else {
            console.error('FAILURE: Booking status mismatch. Expected pending, got', finalBooking.status);
        }
        // 6. Verify rejection
        const { data: rejection } = await supabase.from('driver_rejections')
            .select('*')
            .eq('booking_id', booking.id)
            .eq('driver_id', driver.id)
            .single();
        if (rejection) {
            console.log('SUCCESS: Driver rejection recorded.');
        }
        else {
            console.error('FAILURE: Driver rejection not found.');
        }
    }
    catch (err) {
        console.error('Unexpected error:', err);
    }
}
runTest();
