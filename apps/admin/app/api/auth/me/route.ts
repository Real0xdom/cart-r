import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import crypto from 'crypto';

const SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'change-this-in-production';

function verifySession(token: string): { valid: boolean; payload?: any } {
  try {
    const [payloadB64, signature] = token.split('.');
    if (!payloadB64 || !signature) return { valid: false };

    const expectedSignature = crypto
      .createHmac('sha256', SESSION_SECRET)
      .update(payloadB64)
      .digest('base64url');

    // Timing-safe comparison to prevent timing attacks
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      return { valid: false };
    }

    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());
    return { valid: true, payload };
  } catch {
    return { valid: false };
  }
}

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('admin_session')?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { valid, payload } = verifySession(sessionToken);

    if (!valid || !payload) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    // Check if expired
    if (payload.exp && payload.exp < Date.now()) {
      return NextResponse.json({ error: 'Session expired' }, { status: 401 });
    }

    return NextResponse.json({
      email: payload.email,
      role: payload.role,
      id: payload.id,
    });
  } catch (error) {
    console.error('Auth check error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
