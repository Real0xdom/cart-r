import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase-server';

import { createClient } from '@/lib/supabase/server';

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !user.email) return null;
  const { data: adminRecord } = await supabaseAdmin
    .from('admins')
    .select('id, role')
    .eq('email', user.email.toLowerCase().trim())
    .single();
  if (!adminRecord) return null;
  return { ...user, role: adminRecord.role };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: 'Addon id is required' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.price !== undefined) updateData.price = Number(body.price);
    if (body.icon_emoji !== undefined) updateData.icon_emoji = body.icon_emoji;
    if (body.display_order !== undefined) updateData.display_order = Number(body.display_order);
    if (body.is_active !== undefined) updateData.is_active = body.is_active;
    if (body.applicable_vehicle_types !== undefined) {
      updateData.applicable_vehicle_types = Array.isArray(body.applicable_vehicle_types)
        ? body.applicable_vehicle_types
        : [];
    }

    const { data, error } = await supabaseAdmin
      .from('addon_services')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      console.error('Error updating addon:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('Server error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: 'Addon id is required' }, { status: 400 });
  }

  try {
    const { error } = await supabaseAdmin.from('addon_services').delete().eq('id', id);

    if (error) {
      console.error('Error deleting addon:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Server error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
