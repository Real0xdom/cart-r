import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("Missing supabase URL or service key in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function upsertAdmin(email, password, role) {
  console.log(`Upserting ${email}...`);
  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) {
    console.error("List users error:", listError);
    return;
  }

  let userId;
  const existing = users.find(u => u.email === email);
  if (existing) {
    const { error } = await supabase.auth.admin.updateUserById(existing.id, { password, email_confirm: true });
    if (error) console.error("Update auth user error:", error);
    userId = existing.id;
  } else {
    const { data, error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) {
      console.error("Create auth user error:", error);
      return;
    }
    userId = data.user.id;
  }
  
  // also add to admins table
  const { error: upsertError } = await supabase.from('admins').upsert({
    id: userId,
    email,
    role
  });
  if (upsertError) console.error("Upsert admins table error:", upsertError);
  
  // also add to users table for RLS policies
  const { error: usersError } = await supabase.from('users').upsert({
    id: userId,
    email,
    name: role === 'superadmin' ? 'Super Admin' : 'Admin User',
    role: 'admin',
    is_active: true
  });
  if (usersError) console.error("Upsert users table error:", usersError);
  
  console.log(`Successfully created/updated ${role} ${email}`);
}

async function main() {
  await upsertAdmin('admin@cartr.com', 'adminpassword', 'admin');
  await upsertAdmin('manager@cartr.com', 'managerpassword', 'manager');
  await upsertAdmin('superadmin@cartr.com', 'password123', 'superadmin');
}

main().catch(console.error);
