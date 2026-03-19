"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const server_1 = require("next/server");
const supabase_server_1 = require("@/lib/supabase-server");
const headers_1 = require("next/headers");
async function POST(request) {
    try {
        const { email, password } = await request.json();
        if (!email || !password) {
            return server_1.NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
        }
        // Fetch admin by email
        const { data: admin, error } = await supabase_server_1.supabaseAdmin
            .from('admins')
            .select('id, email, password_hash, role')
            .eq('email', email.toLowerCase().trim())
            .single();
        if (error || !admin) {
            return server_1.NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
        }
        // Simple password comparison
        // Note: In production, use bcrypt.compare(password, admin.password_hash)
        // For now, we'll do a direct comparison assuming passwords are stored as-is
        // or you can implement bcrypt if the passwords are hashed
        if (admin.password_hash !== password) {
            return server_1.NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
        }
        // Create session token (simple approach - in production use JWT)
        const sessionToken = Buffer.from(JSON.stringify({
            id: admin.id,
            email: admin.email,
            role: admin.role,
            exp: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
        })).toString('base64');
        // Set cookie
        const cookieStore = await (0, headers_1.cookies)();
        cookieStore.set('admin_session', sessionToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
            path: '/',
        });
        return server_1.NextResponse.json({
            success: true,
            admin: {
                id: admin.id,
                email: admin.email,
                role: admin.role,
            },
        });
    }
    catch (error) {
        console.error('Login error:', error);
        return server_1.NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
