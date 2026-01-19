
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing Supabase URL or Service Role Key');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createAdmin() {
  const email = 'testadmin@cartr.com';
  const password = 'password123';

  console.log(`Creating/Updating admin user: ${email}`);

  // 1. Create Identity in Auth
  // Try to sign in first to see if exists, or just use admin.createUser (which fails if exists)
  // We'll use listUsers to check.
  
  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
  
  if (listError) {
    console.error('Error listing users:', listError);
    return;
  }

  let userId;
  const existingUser = users.find(u => u.email === email);

  if (existingUser) {
    console.log('User already exists, updating password...');
    const { data, error } = await supabase.auth.admin.updateUserById(existingUser.id, {
      password: password,
      email_confirm: true
    });
    if (error) throw error;
    userId = existingUser.id;
  } else {
    console.log('Creating new user...');
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });
    if (error) throw error;
    userId = data.user.id;
  }

  console.log('User Auth ID:', userId);

  // 2. Ensure entry in public.users with role 'admin'
  // Upsert into public.users
  const { error: upsertError } = await supabase
    .from('users')
    .upsert({
      id: userId,
      email: email,
      name: 'Test Admin',
      role: 'admin',
      is_active: true
    }, { onConflict: 'id' });

  if (upsertError) {
    console.error('Error updating public profile:', upsertError);
  } else {
    console.log('Admin profile ensured in public.users');
  }
}

createAdmin().catch(console.error);
