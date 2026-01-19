"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const server_1 = require("next/server");
const headers_1 = require("next/headers");
async function GET(request) {
    var _a;
    try {
        const cookieStore = await (0, headers_1.cookies)();
        const sessionToken = (_a = cookieStore.get('admin_session')) === null || _a === void 0 ? void 0 : _a.value;
        if (!sessionToken) {
            return server_1.NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }
        // Decode the session token
        try {
            const decoded = JSON.parse(Buffer.from(sessionToken, 'base64').toString());
            // Check if expired
            if (decoded.exp && decoded.exp < Date.now()) {
                return server_1.NextResponse.json({ error: 'Session expired' }, { status: 401 });
            }
            return server_1.NextResponse.json({
                email: decoded.email,
                role: decoded.role,
                id: decoded.id,
            });
        }
        catch (decodeError) {
            return server_1.NextResponse.json({ error: 'Invalid session' }, { status: 401 });
        }
    }
    catch (error) {
        console.error('Auth check error:', error);
        return server_1.NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
