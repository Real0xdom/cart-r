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

    let driversResult = await supabaseAdmin
      .from('drivers')
      .select('user_id, driver_app_enabled, verification_status');

    if (driversResult.error?.message?.includes('driver_app_enabled')) {
      driversResult = await supabaseAdmin
        .from('drivers')
        .select('user_id, verification_status');
    }

    const drivers = driversResult.data || [];

    const driverMap = new Map(
      (drivers || []).map((driver: any) => [driver.user_id, driver])
    );

    const usersWithReferrals = (users || []).map((u: { id: string }) => ({
      ...u,
      customer_app_enabled: typeof (u as any).customer_app_enabled === 'boolean' ? (u as any).customer_app_enabled : true,
      referral_count: countsMap[u.id] ?? 0,
      has_driver_access: driverMap.has(u.id),
      driver_app_enabled: driverMap.get(u.id)?.driver_app_enabled ?? null,
      driver_verification_status: driverMap.get(u.id)?.verification_status ?? null,
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
        const { id, name, phone, role, customer_app_enabled } = body;

        const updateData: any = {};
        if (name !== undefined) updateData.name = name;
        if (phone !== undefined) updateData.phone = phone;
        if (role !== undefined) updateData.role = role;
        if (customer_app_enabled !== undefined) updateData.customer_app_enabled = customer_app_enabled;

        const { data, error } = await supabaseAdmin
            .from('users')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();
            
        if (error) {
            if (error.message?.includes('customer_app_enabled')) {
                return NextResponse.json({ error: 'Live database is missing the customer access migration.' }, { status: 400 });
            }
            return NextResponse.json({ error: error.message }, { status: 500 });
        }
        
        return NextResponse.json(data);
    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
