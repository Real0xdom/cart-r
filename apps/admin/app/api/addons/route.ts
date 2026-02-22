import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase-server';

async function requireAdmin() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('admin_session')?.value;
  if (!sessionToken) {
    return null;
  }
  try {
    const decoded = JSON.parse(Buffer.from(sessionToken, 'base64').toString());
    if (decoded.exp && decoded.exp < Date.now()) return null;
    return decoded;
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('addon_services')
      .select('*')
      .order('display_order')
      .order('name');

    if (error) {
      console.error('Error fetching addons:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (err) {
    console.error('Server error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      code,
      name,
      description,
      price,
      icon_emoji,
      display_order,
      applicable_vehicle_types,
    } = body || {};

    if (!code || !name) {
      return NextResponse.json(
        { error: 'Code and name are required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('addon_services')
      .insert({
        code: String(code).trim(),
        name: String(name).trim(),
        description: description ?? null,
        price: Number(price) || 0,
        icon_emoji: icon_emoji ?? '🔧',
        display_order: Number(display_order) ?? 0,
        applicable_vehicle_types: Array.isArray(applicable_vehicle_types)
          ? applicable_vehicle_types
          : [],
      })
      .select('*')
      .single();

    if (error) {
      console.error('Error creating addon:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('Server error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
