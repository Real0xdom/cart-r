
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://epevjbiymsvwmmzybzib.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVwZXZqYml5bXN2d21tenliemliIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjIyNDI4MCwiZXhwIjoyMDc3ODAwMjgwfQ.vujYcx3eWwDDe6tnw72IGsULlllX4bCaSEUwdRq1IRM';

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function main() {
  const email = 'superadmin@cartr.com';
  const password = 'password123';

  console.log(`Setting up admin: ${email}`);

  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
  
  if (listError) {
    console.error('Error listing users:', listError);
    return;
  }

  let userId;
  const existingUser = users.find(u => u.email === email);

  if (existingUser) {
    console.log('User exists, updating password...');
    const { error } = await supabase.auth.admin.updateUserById(existingUser.id, {
      password: password,
      email_confirm: true,
      user_metadata: { role: 'admin' }
    });
    if (error) {
      console.error('Update failed:', error);
      return;
    }
    userId = existingUser.id;
  } else {
    console.log('Creating new user...');
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: 'admin' }
    });
    if (error) {
      console.error('Create failed:', error);
      return;
    }
    userId = data.user.id;
  }

  console.log(`Upserting profile for ${userId}...`);
  const { error: upsertError } = await supabase
    .from('users')
    .upsert({
      id: userId,
      email: email,
      name: 'Super Admin',
      role: 'admin',
      is_active: true,
      phone: '9999999999'
    }, { onConflict: 'id' });

  if (upsertError) {
    console.error('Profile upsert failed:', upsertError);
  } else {
    console.log('SUCCESS: Admin user ready.');
  }
}

main();
