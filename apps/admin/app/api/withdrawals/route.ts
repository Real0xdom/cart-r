import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const statusFilter = searchParams.get('status') || 'all';

  try {
    let query = supabaseAdmin
      .from('withdrawals')
      .select('*, driver:drivers(id, bank_details, beneficiary_id, beneficiary_status, user:users!drivers_user_id_fkey(name, phone, email))')
      .order('created_at', { ascending: false });

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    const { data, error } = await query;

    if (error) {
      console.error('API Error fetching withdrawals:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (err) {
    console.error('Server error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, withdrawalId, reason } = body;

    if (!withdrawalId || !action) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    if (action === 'approve') {
      const { data, error } = await supabaseAdmin.rpc('approve_withdrawal', {
        p_withdrawal_id: withdrawalId,
      });

      if (error) throw error;
      if (data && !data.success) throw new Error(data.error);

      return NextResponse.json({ success: true, message: 'Withdrawal approved' });
    }

    if (action === 'reject') {
      if (!reason) {
        return NextResponse.json({ error: 'Missing rejection reason' }, { status: 400 });
      }

      const { data, error } = await supabaseAdmin.rpc('reject_withdrawal', {
        p_withdrawal_id: withdrawalId,
        p_reason: reason,
      });

      if (error) throw error;
      if (data && !data.success) throw new Error(data.error);

      return NextResponse.json({ success: true, message: 'Withdrawal rejected' });
    }

    if (action === 'mark_paid') {
      const { error } = await supabaseAdmin
        .from('withdrawals')
        .update({ status: 'paid', processed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', withdrawalId);

      if (error) throw error;

      return NextResponse.json({ success: true, message: 'Withdrawal marked as paid' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    console.error('Server error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
