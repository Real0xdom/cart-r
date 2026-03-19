"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
exports.GET = GET;
const server_1 = require("next/server");
const headers_1 = require("next/headers");
async function POST() {
    const cookieStore = await (0, headers_1.cookies)();
    cookieStore.delete('admin_session');
    return server_1.NextResponse.json({ success: true });
}
async function GET() {
    const cookieStore = await (0, headers_1.cookies)();
    cookieStore.delete('admin_session');
    return server_1.NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'));
}
