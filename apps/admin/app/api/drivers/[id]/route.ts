import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: driverId } = await params;

    console.log('API: Fetching driver:', driverId);

    // Fetch driver first
    const { data: driverData, error: driverError } = await supabaseAdmin
      .from('drivers')
      .select('*')
      .eq('id', driverId)
      .single();

    if (driverError) {
      console.error('Error fetching driver:', driverError);
      return NextResponse.json({ error: 'Driver not found' }, { status: 404 });
    }

    console.log('API: Driver found, user_id:', driverData?.user_id);

    // If driver has user_id, fetch user using service role key (bypasses RLS)
    let userData = null;
    if (driverData?.user_id) {
      const { data: user, error: userError } = await supabaseAdmin
        .from('users')
        .select('name, email, phone, avatar_url')
        .eq('id', driverData.user_id)
        .single();
      
      console.log('API: User data:', user);
      
      if (!userError && user) {
        userData = user;
      } else {
        console.error('User fetch error:', userError);
      }
    }

    // Return combined data
    return NextResponse.json({
      ...driverData,
      user: userData || { name: 'Unknown', email: '', phone: '', avatar_url: null }
    });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
