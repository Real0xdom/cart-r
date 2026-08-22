import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function run() {
  const { data, error } = await supabase.from('users').select('id, email, role').in('email', ['admin@cartr.com', 'manager@cartr.com', 'superadmin@cartr.com']);
  console.log('users:', data, error);
  const { data: admins } = await supabase.from('admins').select('id, email, role');
  console.log('admins:', admins);
}
run();
