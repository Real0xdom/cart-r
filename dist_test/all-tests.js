"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const supabase_js_1 = require("@supabase/supabase-js");
// --- CONFIGURATION ---
const SUPABASE_URL = 'https://epevjbiymsvwmmzybzib.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVwZXZqYml5bXN2d21tenliemliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyMjQyODAsImV4cCI6MjA3NzgwMDI4MH0.TTO9koYOJFjjFNMc7g9_blvnpcM_QIb0Zwj13hW0NXI';
const TEST_CUSTOMER = {
    email: 'test_customer_e2e@cartr.com',
    password: 'password123',
    phone: '+919999999901',
    name: 'Test Customer E2E'
};
const TEST_DRIVER = {
    email: 'test_driver_e2e@cartr.com',
    password: 'password123',
    phone: '+919999999902',
    name: 'Test Driver E2E'
};
// --- SETUP HELPERS ---
async function getAuthenticatedClient(role) {
    const supabase = (0, supabase_js_1.createClient)(SUPABASE_URL, SUPABASE_KEY);
    const credentials = role === 'customer' ? TEST_CUSTOMER : TEST_DRIVER;
    // 1. Sign In / Sign Up
    let { data: { session }, error } = await supabase.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password,
    });
    if (error || !session) {
        // Try Sign Up
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
            email: credentials.email,
            password: credentials.password,
            options: { data: { full_name: credentials.name, phone: credentials.phone } }
        });
        if (signUpError) {
            throw new Error(`Auth Failed for ${role}: ${signUpError.message}`);
        }
        session = signUpData.session;
    }
    if (!session)
        throw new Error(`Could not get session for ${role}`);
    const client = (0, supabase_js_1.createClient)(SUPABASE_URL, SUPABASE_KEY, {
        global: { headers: { Authorization: `Bearer ${session.access_token}` } }
    });
    let driverId = undefined;
    if (role === 'driver') {
        let { data: driver } = await client.from('drivers').select('id').eq('user_id', session.user.id).single();
        if (!driver) {
            const { data: newDriver, error: dError } = await client.from('drivers').insert({
                user_id: session.user.id,
                name: credentials.name,
                phone: credentials.phone,
                status: 'online',
                vehicle_type: 'bike',
                vehicle_number: 'TEST-1234',
                is_active: true
            }).select().single();
            if (dError)
                throw new Error(`Driver Init Failed: ${dError.message}`);
            driver = newDriver;
        }
        driverId = driver.id;
        // Ensure online
        await client.from('drivers').update({ status: 'online', is_searchable: true }).eq('id', driver.id);
    }
    return { client, user: session.user, driverId };
}
// --- TEST SCENARIOS ---
async function runHappyPath() {
    console.log('\n--- STARTED: SCENARIO 1 (HAPPY PATH) ---');
    try {
        const { client: customerClient, user: customer } = await getAuthenticatedClient('customer');
        const { client: driverClient, user: driver, driverId } = await getAuthenticatedClient('driver');
        // Create
        const { data: booking, error: bError } = await customerClient.from('bookings').insert({
            customer_id: customer.id,
            origin_address: 'Happypath Origin',
            origin_latitude: 12.9, origin_longitude: 77.5,
            destination_address: 'Happypath Dest',
            destination_latitude: 12.8, destination_longitude: 77.6,
            vehicle_type: 'bike', status: 'pending', total_fare: 100, pickup_otp: '1111'
        }).select().single();
        if (bError)
            throw bError;
        console.log(`[S1] Booking Created: ${booking.id}`);
        // Accept
        await driverClient.from('bookings').update({ status: 'accepted', driver_id: driverId }).eq('id', booking.id);
        console.log('[S1] Accepted');
        // Arrive
        await driverClient.from('bookings').update({ status: 'driver_arrived' }).eq('id', booking.id);
        console.log('[S1] Arrived');
        // Start
        await driverClient.from('bookings').update({ status: 'in_progress' }).eq('id', booking.id);
        console.log('[S1] Started');
        // Complete
        await driverClient.from('bookings').update({ status: 'completed', payment_status: 'completed' }).eq('id', booking.id);
        console.log('[S1] Completed');
        // Verify
        const { data: final } = await customerClient.from('bookings').select('status, payment_status').eq('id', booking.id).single();
        if (final.status !== 'completed' || final.payment_status !== 'completed')
            throw new Error('Final State Mismatch');
        console.log('--- SUCCESS: SCENARIO 1 ---\n');
    }
    catch (e) {
        console.error(`!!! FAILED S1: ${e.message}`);
        throw e;
    }
}
async function runDriverCancel() {
    console.log('--- STARTED: SCENARIO 2 (DRIVER CANCEL) ---');
    try {
        const { client: customerClient, user: customer } = await getAuthenticatedClient('customer');
        const { client: driverClient, user: driver, driverId } = await getAuthenticatedClient('driver');
        // Create
        const { data: booking } = await customerClient.from('bookings').insert({
            customer_id: customer.id,
            origin_address: 'Cancel Origin',
            vehicle_type: 'bike', status: 'pending', total_fare: 100, pickup_otp: '2222'
        }).select().single();
        console.log(`[S2] Booking Created: ${booking.id}`);
        // Accept
        await driverClient.from('bookings').update({ status: 'accepted', driver_id: driverId }).eq('id', booking.id);
        console.log('[S2] Accepted');
        // Cancel RPC
        const { error: rpcError } = await driverClient.rpc('cancel_booking_by_driver', {
            p_booking_id: booking.id, p_driver_id: driverId, p_reason: 'Test Cancel'
        });
        if (rpcError)
            throw new Error(`RPC Failed: ${rpcError.message}`);
        console.log('[S2] Cancelled via RPC');
        // Verify
        const { data: final } = await customerClient.from('bookings').select('status, driver_id').eq('id', booking.id).single();
        if (final.status !== 'pending')
            throw new Error(`Status is ${final.status}, expected pending`);
        if (final.driver_id !== null)
            throw new Error(`Driver ID is ${final.driver_id}, expected null`);
        // Verify Rejection
        const { data: rejection } = await driverClient.from('driver_rejections').select('*').eq('booking_id', booking.id).eq('driver_id', driverId).single();
        if (!rejection)
            throw new Error('Rejection record not found');
        console.log('--- SUCCESS: SCENARIO 2 ---\n');
    }
    catch (e) {
        console.error(`!!! FAILED S2: ${e.message}`);
        throw e;
    }
}
async function runDriverReject() {
    console.log('--- STARTED: SCENARIO 3 (DRIVER REJECT) ---');
    try {
        const { client: customerClient, user: customer } = await getAuthenticatedClient('customer');
        const { client: driverClient, user: driver, driverId } = await getAuthenticatedClient('driver');
        // Create
        const { data: booking } = await customerClient.from('bookings').insert({
            customer_id: customer.id,
            origin_address: 'Reject Origin',
            vehicle_type: 'bike', status: 'pending', total_fare: 100, pickup_otp: '3333'
        }).select().single();
        console.log(`[S3] Booking Created: ${booking.id}`);
        // Reject
        await driverClient.from('driver_rejections').insert({
            booking_id: booking.id, driver_id: driverId, reason: 'Test Reject'
        });
        console.log('[S3] Rejected (Inserted record)');
        // Verify
        const { data: final } = await customerClient.from('bookings').select('status').eq('id', booking.id).single();
        if (final.status !== 'pending')
            throw new Error('Status changed unexpectedly');
        console.log('--- SUCCESS: SCENARIO 3 ---\n');
    }
    catch (e) {
        console.error(`!!! FAILED S3: ${e.message}`);
        throw e;
    }
}
async function runCustomerCancel() {
    console.log('--- STARTED: SCENARIO 4 (CUSTOMER CANCEL) ---');
    try {
        const { client: customerClient, user: customer } = await getAuthenticatedClient('customer');
        const { client: driverClient, user: driver, driverId } = await getAuthenticatedClient('driver');
        // Create
        const { data: booking } = await customerClient.from('bookings').insert({
            customer_id: customer.id,
            origin_address: 'CustCancel Origin',
            vehicle_type: 'bike', status: 'pending', total_fare: 100, pickup_otp: '4444'
        }).select().single();
        console.log(`[S4] Booking Created: ${booking.id}`);
        // Accept
        await driverClient.from('bookings').update({ status: 'accepted', driver_id: driverId }).eq('id', booking.id);
        console.log('[S4] Accepted');
        // Cancel
        await customerClient.from('bookings').update({ status: 'cancelled' }).eq('id', booking.id);
        console.log('[S4] Cancelled');
        // Verify
        const { data: final } = await customerClient.from('bookings').select('status').eq('id', booking.id).single();
        if (final.status !== 'cancelled')
            throw new Error('Status mismatch');
        console.log('--- SUCCESS: SCENARIO 4 ---\n');
    }
    catch (e) {
        console.error(`!!! FAILED S4: ${e.message}`);
        throw e;
    }
}
async function runAll() {
    try {
        await runHappyPath();
        await runDriverCancel();
        await runDriverReject();
        await runCustomerCancel();
        console.log('\n=== ALL INTEGRATION TESTS PASSED ===');
    }
    catch (e) {
        console.error('\n=== INTEGRATION TEST SUITE FAILED ===');
        process.exit(1);
    }
}
runAll();
