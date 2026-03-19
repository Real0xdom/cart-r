"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const server_1 = require("next/server");
const supabase_server_1 = require("@/lib/supabase-server");
async function GET(request, { params }) {
    try {
        const { id: driverId } = await params;
        console.log('API: Fetching driver:', driverId);
        // Fetch driver first
        const { data: driverData, error: driverError } = await supabase_server_1.supabaseAdmin
            .from('drivers')
            .select('*')
            .eq('id', driverId)
            .single();
        if (driverError) {
            console.error('Error fetching driver:', driverError);
            return server_1.NextResponse.json({ error: 'Driver not found' }, { status: 404 });
        }
        console.log('API: Driver found, user_id:', driverData === null || driverData === void 0 ? void 0 : driverData.user_id);
        // If driver has user_id, fetch user using service role key (bypasses RLS)
        let userData = null;
        if (driverData === null || driverData === void 0 ? void 0 : driverData.user_id) {
            const { data: user, error: userError } = await supabase_server_1.supabaseAdmin
                .from('users')
                .select('name, email, phone, avatar_url')
                .eq('id', driverData.user_id)
                .single();
            console.log('API: User data:', user);
            if (!userError && user) {
                userData = user;
            }
            else {
                console.error('User fetch error:', userError);
            }
        }
        // Return combined data
        return server_1.NextResponse.json({
            ...driverData,
            user: userData || { name: 'Unknown', email: '', phone: '', avatar_url: null }
        });
    }
    catch (error) {
        console.error('API Error:', error);
        return server_1.NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
