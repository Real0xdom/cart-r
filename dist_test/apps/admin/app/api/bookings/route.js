"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
exports.PATCH = PATCH;
const server_1 = require("next/server");
const supabase_server_1 = require("@/lib/supabase-server");
async function GET(request) {
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status') || 'all';
    try {
        let query = supabase_server_1.supabaseAdmin
            .from('bookings')
            .select(`
        *,
        customer:users!bookings_customer_id_fkey(name, phone),
        driver:drivers(
          vehicle_number,
          vehicle_model,
          user:users!drivers_user_id_fkey(name, phone)
        )
      `)
            .order('created_at', { ascending: false });
        if (statusFilter !== 'all') {
            query = query.eq('status', statusFilter);
        }
        const { data, error } = await query.limit(100);
        if (error) {
            console.error('API Error fetching bookings:', error);
            return server_1.NextResponse.json({ error: error.message }, { status: 500 });
        }
        return server_1.NextResponse.json(data || []);
    }
    catch (err) {
        console.error('Server error:', err);
        return server_1.NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
async function PATCH(request) {
    try {
        const body = await request.json();
        const { id, status, cancellation_reason } = body;
        const updateData = { status };
        if (status === 'cancelled') {
            updateData.cancelled_at = new Date().toISOString();
            updateData.cancellation_reason = cancellation_reason;
        }
        const { data, error } = await supabase_server_1.supabaseAdmin
            .from('bookings')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();
        if (error) {
            return server_1.NextResponse.json({ error: error.message }, { status: 500 });
        }
        return server_1.NextResponse.json(data);
    }
    catch (err) {
        console.error('Server error:', err);
        return server_1.NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
