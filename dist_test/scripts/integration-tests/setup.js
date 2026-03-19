"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TEST_DRIVER = exports.TEST_CUSTOMER = void 0;
exports.getAuthenticatedClient = getAuthenticatedClient;
const supabase_js_1 = require("@supabase/supabase-js");
// Hardcoded for testing environment as per previous successful scripts
const SUPABASE_URL = 'https://epevjbiymsvwmmzybzib.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVwZXZqYml5bXN2d21tenliemliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyMjQyODAsImV4cCI6MjA3NzgwMDI4MH0.TTO9koYOJFjjFNMc7g9_blvnpcM_QIb0Zwj13hW0NXI';
// Test User Credentials
exports.TEST_CUSTOMER = {
    email: 'test_customer_e2e@cartr.com',
    password: 'password123',
    phone: '+919999999901',
    name: 'Test Customer E2E'
};
exports.TEST_DRIVER = {
    email: 'test_driver_e2e@cartr.com',
    password: 'password123',
    phone: '+919999999902',
    name: 'Test Driver E2E'
};
async function getAuthenticatedClient(role) {
    const supabase = (0, supabase_js_1.createClient)(SUPABASE_URL, SUPABASE_KEY);
    const credentials = role === 'customer' ? exports.TEST_CUSTOMER : exports.TEST_DRIVER;
    console.log(`[Setup] Authenticating ${role} (${credentials.email})...`);
    // 1. Try to Sign In
    let { data: { session }, error: signInError } = await supabase.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password,
    });
    // 2. If Sign In fails, Try to Sign Up
    if (signInError || !session) {
        console.log(`[Setup] User not found, creating new ${role}...`);
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
            email: credentials.email,
            password: credentials.password,
            options: {
                data: {
                    full_name: credentials.name,
                    phone: credentials.phone
                }
            }
        });
        if (signUpError) {
            console.error(`[Setup] FATAL: Failed to create ${role}:`, signUpError.message);
            throw signUpError;
        }
        // Auto-login after signup if session provided, else we might need manual confirmation in some setups
        // But for test/anon key usually works if email confirm is off. 
        if (signUpData.session) {
            session = signUpData.session;
        }
        else {
            // If email confirmation is enabled, this might fail. 
            // We'll throw for now as we expect test env to allow this.
            console.log('[Setup] Warning: No session after signup. Email verification might be required.');
        }
    }
    if (!session) {
        throw new Error(`Could not authenticate ${role}`);
    }
    // Return client with session
    const authedClient = (0, supabase_js_1.createClient)(SUPABASE_URL, SUPABASE_KEY, {
        global: {
            headers: {
                Authorization: `Bearer ${session.access_token}`
            }
        }
    });
    // For driver, we need the driver_id from 'drivers' table
    let driverId = undefined;
    if (role === 'driver') {
        // Ensure driver record exists
        let { data: driver, error: fetchDriverError } = await authedClient
            .from('drivers')
            .select('id')
            .eq('user_id', session.user.id)
            .single();
        if (!driver) {
            console.log('[Setup] Creating driver record...');
            const { data: newDriver, error: createDriverError } = await authedClient
                .from('drivers')
                .insert({
                user_id: session.user.id,
                name: credentials.name,
                phone: credentials.phone,
                status: 'online',
                vehicle_type: 'bike',
                vehicle_number: 'TEST-1234',
                is_active: true
            })
                .select()
                .single();
            if (createDriverError) {
                // Try admin client if RLS fails self-insert (unlikely for new profile but possible)
                console.error('[Setup] Failed to create driver profile:', createDriverError);
                throw createDriverError;
            }
            driver = newDriver;
        }
        driverId = driver.id;
        // Force online status
        await authedClient.from('drivers').update({ status: 'online', is_searchable: true }).eq('id', driver.id);
    }
    return { client: authedClient, user: session.user, driverId };
}
