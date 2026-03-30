import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: 'manager@cartr.com',
    password: 'managerpassword',
    email_confirm: true
  });
  if (error) console.error('Error creating user:', error);
  else {
    console.log('Successfully created manager auth user', data.user.id);
    const { error: dbError } = await supabaseAdmin.from('admins').update({ id: data.user.id }).eq('email', 'manager@cartr.com');
    if (dbError) console.error('Error updating admins table:', dbError);
    else console.log('Successfully synced admins table ID');
  }
