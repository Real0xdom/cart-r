import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';

// GET /api/drivers/[id]/history - Fetch verification history for a driver
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: driverId } = await params;
    
    console.log('Fetching verification history for driver:', driverId);
    
    const { data, error } = await supabaseAdmin
      .from('driver_verification_history')
      .select('*')
      .eq('driver_id', driverId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching verification history:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log('Verification history found:', data?.length || 0, 'entries');
    return NextResponse.json(data || []);
  } catch (err) {
    console.error('Server error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
