import { NextResponse } from 'next/server';
import { getCurrentAdminState } from '@/lib/current-admin';

export async function GET() {
  try {
    const adminState = await getCurrentAdminState();

    if (!adminState.isAuthenticated) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (!adminState.isAuthorized || !adminState.role || !adminState.id) {
      // Return 403 as the user is authenticated but not an admin
      return NextResponse.json({ error: 'Unauthorized access. Admins only.' }, { status: 403 });
    }

    return NextResponse.json({
      email: adminState.email,
      role: adminState.role,
      id: adminState.id,
    });
  } catch (error) {
    console.error('Auth check error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
