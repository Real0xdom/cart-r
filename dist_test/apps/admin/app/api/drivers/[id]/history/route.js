"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const server_1 = require("next/server");
const supabase_server_1 = require("@/lib/supabase-server");
// GET /api/drivers/[id]/history - Fetch verification history for a driver
async function GET(request, { params }) {
    try {
        const { id: driverId } = await params;
        console.log('Fetching verification history for driver:', driverId);
        const { data, error } = await supabase_server_1.supabaseAdmin
            .from('driver_verification_history')
            .select('*')
            .eq('driver_id', driverId)
            .order('created_at', { ascending: false });
        if (error) {
            console.error('Error fetching verification history:', error);
            return server_1.NextResponse.json({ error: error.message }, { status: 500 });
        }
        console.log('Verification history found:', (data === null || data === void 0 ? void 0 : data.length) || 0, 'entries');
        return server_1.NextResponse.json(data || []);
    }
    catch (err) {
        console.error('Server error:', err);
        return server_1.NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
