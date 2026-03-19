import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get the current user session from Supabase
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user || !user.email) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Extra Security Check: Ensure this user is actually an admin in the `admins` table
    const { data: adminRecord, error: adminError } = await supabaseAdmin
      .from('admins')
      .select('id, role')
      .eq('email', user.email.toLowerCase().trim())
      .single();

    if (adminError || !adminRecord) {
      // Return 403 as the user is authenticated but not an admin
      return NextResponse.json({ error: 'Unauthorized access. Admins only.' }, { status: 403 });
    }

    return NextResponse.json({
      email: user.email,
      role: adminRecord.role,
      id: adminRecord.id,
    });
  } catch (error) {
    console.error('Auth check error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
