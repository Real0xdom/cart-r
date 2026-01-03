import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('admin_session')?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Decode the session token
    try {
      const decoded = JSON.parse(Buffer.from(sessionToken, 'base64').toString());
      
      // Check if expired
      if (decoded.exp && decoded.exp < Date.now()) {
        return NextResponse.json({ error: 'Session expired' }, { status: 401 });
      }

      return NextResponse.json({
        email: decoded.email,
        role: decoded.role,
        id: decoded.id,
      });
    } catch (decodeError) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }
  } catch (error) {
    console.error('Auth check error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
