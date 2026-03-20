import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const statusFilter = searchParams.get('status') || 'all';

  try {
    let query = supabaseAdmin
      .from('bookings')
      .select(`
        *,
        customer:users!bookings_customer_id_fkey(name, phone),
        driver:drivers(
          vehicle_number,
          vehicle_model,
          user:users!drivers_user_id_fkey(name, phone)
        )
      `)
      .order('created_at', { ascending: false });

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    const { data, error } = await query.limit(100);

    if (error) {
      console.error('API Error fetching bookings:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (err) {
    console.error('Server error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, status, cancellation_reason } = body;

    if (status === 'cancelled') {
      const { data, error } = await supabaseAdmin.rpc('admin_cancel_booking', {
        p_booking_id: id,
        p_reason: cancellation_reason || 'Cancelled by admin',
      });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      if (!(data as any)?.success) {
        return NextResponse.json({ error: (data as any)?.error || 'Failed to cancel booking' }, { status: 400 });
      }

      const { data: refreshed, error: refreshedError } = await supabaseAdmin
        .from('bookings')
        .select('*')
        .eq('id', id)
        .single();

      if (refreshedError) {
        return NextResponse.json({ error: refreshedError.message }, { status: 500 });
      }

      return NextResponse.json(refreshed);
    }

    const updateData: any = { status };
    const { data, error } = await supabaseAdmin
      .from('bookings')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('Server error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
