import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase-server'

export type CurrentAdminRole = 'admin' | 'superadmin' | 'manager'

interface CurrentAdminState {
  email: string
  id: string | null
  role: CurrentAdminRole | null
  isAuthenticated: boolean
  isAuthorized: boolean
}

export async function getCurrentAdminState(): Promise<CurrentAdminState> {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user?.email) {
    return {
      email: '',
      id: null,
      role: null,
      isAuthenticated: false,
      isAuthorized: false,
    }
  }

  const normalizedEmail = user.email.toLowerCase().trim()
  const { data: adminRecord, error: adminError } = await supabaseAdmin
    .from('admins')
    .select('id, role')
    .eq('email', normalizedEmail)
    .single()

  if (adminError || !adminRecord) {
    return {
      email: normalizedEmail,
      id: null,
      role: null,
      isAuthenticated: true,
      isAuthorized: false,
    }
  }

  return {
    email: normalizedEmail,
    id: adminRecord.id,
    role: adminRecord.role as CurrentAdminRole,
    isAuthenticated: true,
    isAuthorized: true,
  }
}
