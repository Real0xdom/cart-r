
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../e2e/.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const adminEmail = (process.env.ADMIN_EMAIL || 'admin@cartr.com').toLowerCase().trim();
const adminPassword = process.env.ADMIN_PASSWORD || 'adminpassword';

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupAdmin() {
  console.log(`Checking for admin user: ${adminEmail}`);
  
  // 1. Check if user exists in auth
  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) {
    console.error('Error listing users:', listError);
    return;
  }
  
  let adminAuthUser: any = users.find(u => u.email === adminEmail);
  
  if (!adminAuthUser) {
    console.log('Admin user not found in Auth. Creating...');
    const { data: { user }, error: createError } = await supabase.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
      user_metadata: { role: 'admin' }
    });
    
    if (createError || !user) {
      console.error('Error creating admin auth user:', createError);
      return;
    }
    adminAuthUser = user;
    console.log('Admin auth user created successfully.');
  } else {
    console.log('Admin auth user already exists.');
    // Ensure password is correct
    const { error: updateError } = await supabase.auth.admin.updateUserById(adminAuthUser.id, {
      password: adminPassword
    });
    if (updateError) {
      console.warn('Could not update admin password (not critical if already correct):', updateError.message);
    }
  }
  
  // 2. Check/Delete/Upsert user profile in public.users table
  const { data: existingProfiles, error: listProfilesError } = await supabase
    .from('users')
    .select('id, email, role')
    .eq('email', adminEmail);
    
  if (listProfilesError) {
    console.error('Error listing profiles:', listProfilesError);
    return;
  }
  
  const conflictingProfile = existingProfiles?.find(p => p.id !== adminAuthUser.id);
  if (conflictingProfile) {
    console.log(`Found conflicting profile with ID ${conflictingProfile.id}. Deleting...`);
    await supabase.from('users').delete().eq('id', conflictingProfile.id);
  }
  
  const currentProfile = existingProfiles?.find(p => p.id === adminAuthUser.id);
    
  if (!currentProfile) {
    console.log('Admin profile not found. Upserting...');
    await supabase.from('users').upsert({
      id: adminAuthUser.id,
      email: adminEmail,
      name: 'System Admin',
      role: 'admin',
      is_active: true
    });
    console.log('Admin profile upserted successfully.');
  } else {
    console.log('Admin profile already exists.');
    if (currentProfile.role !== 'admin') {
      console.log(`Updating role from ${currentProfile.role} to admin...`);
      await supabase.from('users').update({ role: 'admin' }).eq('id', adminAuthUser.id);
    }
  }

  // 3. Ensure user is in `admins` table too (used by Admin Server Action)
  console.log('Checking admins table...');
  const { data: adminRow, error: adminRowError } = await supabase
    .from('admins')
    .select('*')
    .eq('email', adminEmail)
    .single();
    
  if (adminRowError || !adminRow) {
    console.log('Admin not found in admins table. Inserting...');
    const { error: insertAdminError } = await supabase.from('admins').insert({
      email: adminEmail,
      role: 'admin'
    });
    
    if (insertAdminError) {
      console.error('Error inserting into admins table:', insertAdminError);
    } else {
      console.log('Admin inserted into admins table successfully.');
    }
  } else {
    console.log('Admin already exists in admins table.');
  }
  
  console.log('Admin setup check complete.');
}

setupAdmin();
