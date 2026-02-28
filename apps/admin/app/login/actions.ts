'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase-server'

export async function loginWithEmail(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !password) {
    return { error: 'Email and password are required' }
  }

  // 1. Sign in with standard Supabase Auth
  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (authError || !authData.user) {
    return { error: 'Invalid email or password' }
  }

  // 2. Extra Security Check: Ensure this user is actually an admin in the `admins` table
  const { data: adminRecord, error: adminError } = await supabaseAdmin
    .from('admins')
    .select('id, role')
    .eq('email', email.toLowerCase().trim())
    .single()

  if (adminError || !adminRecord) {
    // This is a normal customer/driver trying to sign into the admin panel. Reject them.
    await supabase.auth.signOut()
    return { error: 'Unauthorized access. Admins only.' }
  }

  // Success. The cookie is already set by supabase.auth.signInWithPassword (via SSR utils).
  redirect('/')
}
