"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
exports.middleware = middleware;
const server_1 = require("next/server");
// Routes that don't require authentication
// All API routes are allowed through - they should handle their own auth if needed
const publicRoutes = ['/login', '/api/'];
function middleware(request) {
    const { pathname } = request.nextUrl;
    // Allow public routes
    if (publicRoutes.some(route => pathname.startsWith(route))) {
        return server_1.NextResponse.next();
    }
    // Allow static files and Next.js internals
    if (pathname.startsWith('/_next') ||
        pathname.startsWith('/favicon') ||
        pathname.includes('.')) {
        return server_1.NextResponse.next();
    }
    // Check for session cookie
    const sessionCookie = request.cookies.get('admin_session');
    if (!(sessionCookie === null || sessionCookie === void 0 ? void 0 : sessionCookie.value)) {
        // Redirect to login
        const loginUrl = new URL('/login', request.url);
        return server_1.NextResponse.redirect(loginUrl);
    }
    // Validate session
    try {
        const session = JSON.parse(Buffer.from(sessionCookie.value, 'base64').toString());
        // Check if session is expired
        if (session.exp && session.exp < Date.now()) {
            const loginUrl = new URL('/login', request.url);
            const response = server_1.NextResponse.redirect(loginUrl);
            response.cookies.delete('admin_session');
            return response;
        }
        // Session is valid, continue
        return server_1.NextResponse.next();
    }
    catch (_a) {
        // Invalid session format, redirect to login
        const loginUrl = new URL('/login', request.url);
        const response = server_1.NextResponse.redirect(loginUrl);
        response.cookies.delete('admin_session');
        return response;
    }
}
exports.config = {
    matcher: [
        /*
         * Match all request paths except:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         */
        '/((?!_next/static|_next/image|favicon.ico).*)',
    ],
};
