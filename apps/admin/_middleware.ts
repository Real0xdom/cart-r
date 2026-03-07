import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import crypto from 'crypto';

// Routes that don't require authentication
const publicRoutes = ['/login', '/api/'];

const SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'change-this-in-production';

function verifySession(token: string): { valid: boolean; payload?: any } {
  try {
    const [payloadB64, signature] = token.split('.');
    if (!payloadB64 || !signature) return { valid: false };

    const expectedSignature = crypto
      .createHmac('sha256', SESSION_SECRET)
      .update(payloadB64)
      .digest('base64url');

    // Use simple comparison in middleware (timing-safe requires equal length buffers)
    if (signature !== expectedSignature) {
      return { valid: false };
    }

    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());
    return { valid: true, payload };
  } catch {
    return { valid: false };
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes
  if (publicRoutes.some(route => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Allow static files and Next.js internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Check for session cookie
  const sessionCookie = request.cookies.get('admin_session');

  if (!sessionCookie?.value) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Validate signed session
  const { valid, payload } = verifySession(sessionCookie.value);

  if (!valid || !payload) {
    const loginUrl = new URL('/login', request.url);
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete('admin_session');
    return response;
  }

  // Check if session is expired
  if (payload.exp && payload.exp < Date.now()) {
    const loginUrl = new URL('/login', request.url);
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete('admin_session');
    return response;
  }

  // Session is valid, continue
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
