"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const server_1 = require("next/server");
const supabase_server_1 = require("@/lib/supabase-server");
async function GET(request) {
    try {
        // Fetch all users using service role key (bypasses RLS)
        const { data: users, error } = await supabase_server_1.supabaseAdmin
            .from('users')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) {
            console.error('Error fetching users:', error);
            return server_1.NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
        }
        return server_1.NextResponse.json(users || []);
    }
    catch (error) {
        console.error('API Error:', error);
        return server_1.NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
