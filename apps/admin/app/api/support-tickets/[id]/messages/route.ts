import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: ticketId } = await params;
    if (!ticketId) {
      return NextResponse.json({ error: 'Ticket id required' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('ticket_messages')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching ticket messages:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (err) {
    console.error('Server error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: ticketId } = await params;
    if (!ticketId) {
      return NextResponse.json({ error: 'Ticket id required' }, { status: 400 });
    }

    const body = await request.json();
    const { message } = body || {};
    if (!message || typeof message !== 'string' || !message.trim()) {
      return NextResponse.json(
        { error: 'Message text is required' },
        { status: 400 }
      );
    }

    // Use support agent user id: env or first user with role 'admin' in users table
    let supportUserId = process.env.SUPPORT_AGENT_USER_ID;
    if (!supportUserId) {
      const { data: adminUser } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('role', 'admin')
        .limit(1)
        .single();
      supportUserId = adminUser?.id;
    }
    if (!supportUserId) {
      return NextResponse.json(
        {
          error:
            'Support replies require a user with role=admin in users table, or set SUPPORT_AGENT_USER_ID in env',
        },
        { status: 500 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('ticket_messages')
      .insert({
        ticket_id: ticketId,
        sender_id: supportUserId,
        sender_type: 'support',
        message: message.trim(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding ticket message:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Optionally set ticket status to in_progress when support replies
    await supabaseAdmin
      .from('support_tickets')
      .update({ status: 'in_progress', updated_at: new Date().toISOString() })
      .eq('id', ticketId);

    return NextResponse.json(data);
  } catch (err) {
    console.error('Server error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
