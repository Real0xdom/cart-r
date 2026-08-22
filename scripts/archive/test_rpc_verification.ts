
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
// We assume we are running from root, so we try to load .env or .env.local
// But checking the previous context, we know the keys are likely in apps/driver/.env or similar.
// For this script, I will assume the user has a local .env or I will use the values if I can see them.
// I will try to read the .env file first??
// Actually, I can just ask the user or hardcode placeholders if I knew them.
// Wait, I can't see .env files usually.
// I'll try to use the ones from process.env if available, or I will use a dummy one if it was provided in context?
// In Step 829, I saw `apps/driver/app/(tabs)/home.tsx` does not show env vars.
// In Step 830, `packages/shared/supabase.ts` uses `process.env.EXPO_PUBLIC_SUPABASE_URL`.
// I will try to rely on `dotenv` loading `.env` file in root.

// Manual override for testing if .env fails (User: please replace if needed, but I suspect I can find them or they are standard local ones)
// Actually, I'll try to find the .env file first.

require('dotenv').config({ path: './apps/driver/.env' }); 

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''; // We might need this to create a verified driver quickly

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('Error: EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY not found in environment.');
    console.log('Trying to look for .env in apps/driver/.env...');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
// Admin client for setup
// If we don't have service role, we try to go through normal auth flow, but verification might be harder.
// Let's rely on standard auth.

async function testRpc() {
    console.log('--- Starting RPC Verification ---');

    // 1. Create a random test user & driver
    const email = `test_driver_${Date.now()}@example.com`;
    const password = 'password123';

    console.log(`1. Signing up user: ${email}...`);
    const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
    });

    if (authError) {
        console.error('Auth Error:', authError.message);
        return;
    }
    
    const userId = authData.user?.id;
    if (!userId) {
        console.error('No user ID returned');
        return;
    }
    console.log('   User created:', userId);

    // 2. Create Driver Profile (Since we don't have triggers set up in this script context, manual insert might fail RLS)
    // We strictly need to be a "driver" to use the RPC? The RPC uses `drivers` table.
    // We assume the Trigger `on_auth_user_created` (if exists) might handle user creation, 
    // but we need a row in `drivers`.
    // Let's try to insert into drivers directly.
    console.log('2. Creating driver profile...');
    const { error: driverError } = await supabase.from('drivers').insert({
        user_id: userId,
        vehicle_type: 'bike',
        vehicle_number: 'TEST-123',
        vehicle_model: 'Splendor',
        verification_status: 'approved', // Pre-approve for test
        is_online: true,
        current_latitude: 18.5204,
        current_longitude: 73.8567
    });

    if (driverError) {
        console.log('   Driver insert failed (RLS?):', driverError.message);
        console.log('   Trying to fetch if auto-created...');
        // Maybe trigger created it?
    } else {
        console.log('   Driver profile created.');
    }

    // 3. Call the RPC
    console.log('3. Calling get_available_bookings_v2...');
    // Parameters: lat, lng, vehicle_type, radius
    const { data, error } = await supabase.rpc('get_available_bookings_v2', {
        p_latitude: 18.5204,
        p_longitude: 73.8567,
        p_vehicle_type: 'bike',
        p_radius_km: 50
    });

    if (error) {
        console.error('❌ RPC FAILED:', error);
        console.error('   Code:', error.code);
        console.error('   Details:', error.details);
        console.error('   Message:', error.message);
    } else {
        console.log('✅ RPC SUCCESS!');
        console.log(`   Returned ${data?.length} rows.`);
        if (data && data.length > 0) {
            console.log('   Sample row:', data[0]);
        }
    }

    // Client clean up? Not needed for script.
}

testRpc();
