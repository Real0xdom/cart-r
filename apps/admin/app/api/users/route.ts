import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search')?.toLowerCase() || '';

  try {
    let query = supabaseAdmin
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    // If search is simple (no joins), we can try ILIKE. 
    // However, for multiple fields OR logic, Supabase JS syntax is: .or(`name.ilike.%${search}%,email.ilike.%${search}%`)
    if (search) {
       query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
    }

    const { data: users, error } = await query;

    if (error) {
      console.error('Error fetching users:', error);
      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
    }

    // Fetch referral counts per referrer
    const { data: refRows } = await supabaseAdmin
      .from('referrals')
      .select('referrer_id');
    const countsMap: Record<string, number> = {};
    (refRows || []).forEach((r: { referrer_id: string }) => {
      countsMap[r.referrer_id] = (countsMap[r.referrer_id] || 0) + 1;
    });

    const usersWithReferrals = (users || []).map((u: { id: string }) => ({
      ...u,
      referral_count: countsMap[u.id] ?? 0,
    }));

    return NextResponse.json(usersWithReferrals);
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json();
        const { id, name, phone, role } = body;

        const updateData: any = {};
        if (name !== undefined) updateData.name = name;
        if (phone !== undefined) updateData.phone = phone;
        if (role !== undefined) updateData.role = role;

        const { data, error } = await supabaseAdmin
            .from('users')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();
            
        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }
        
        return NextResponse.json(data);
    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
