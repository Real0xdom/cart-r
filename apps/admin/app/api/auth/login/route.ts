import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase-server';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    console.log('[loginAPI] Starting login for:', email);

    // 1. Sign in with standard Supabase Auth
    console.log('[loginAPI] creating client...');
    const supabase = await createClient();
    
    console.log('[loginAPI] calling signInWithPassword...');
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    console.log('[loginAPI] signInWithPassword result:', !!authData.user, authError);

    if (authError || !authData.user) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    // 2. Extra Security Check
    console.log('[loginAPI] making supabaseAdmin query...');
    const { data: adminRecord, error: adminError } = await supabaseAdmin
      .from('admins')
      .select('id, role')
      .eq('email', email.toLowerCase().trim())
      .single();

    console.log('[loginAPI] admin check result:', !!adminRecord, adminError);

    if (adminError || !adminRecord) {
      await supabase.auth.signOut();
      return NextResponse.json({ error: 'Unauthorized access. Admins only.' }, { status: 403 });
    }

    console.log('[loginAPI] Login successful!');
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[loginAPI] Exception thrown:', err);
    return NextResponse.json({ error: 'Internal server error during login' }, { status: 500 });
  }
}
