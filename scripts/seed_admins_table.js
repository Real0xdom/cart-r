
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Load credentials
let creds;
try {
  creds = JSON.parse(fs.readFileSync('credentials.json', 'utf8'));
} catch (e) {
  console.error('Failed to load credentials.json');
  process.exit(1);
}

const SUPABASE_URL = creds.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = creds.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

async function seedAdmin() {
  const email = 'superadmin@cartr.com';
  const password = 'password123'; // Storing plain text as per API logic seen in route.ts (Step 305)

  console.log(`Seeding admins table for: ${email}`);

  // Check if table exists/structure
  const { data: existing, error: fetchError } = await supabase
    .from('admins')
    .select('*')
    .eq('email', email);

  if (fetchError) {
    if (fetchError.code === '42P01') { // undefined_table
        console.error('Table "admins" does not exist! Migration needed.');
    } else {
        console.error('Error fetching admin:', fetchError);
    }
    return;
  }

  if (existing && existing.length > 0) {
    console.log('Admin already exists in table. Updating...');
     const { error } = await supabase
        .from('admins')
        .update({ password_hash: password, role: 'admin' })
        .eq('email', email);
     if (error) console.error(error);
  } else {
    console.log('Creating new admin in table...');
    const { error } = await supabase
        .from('admins')
        .insert([{ email, password_hash: password, role: 'admin' }]);
    if (error) console.error(error);
  }
  
  console.log('Done.');
}

seedAdmin();
