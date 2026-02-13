'use server';

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

export async function getAudienceCounts() {
  try {
    const { count: customersCount } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'customer');

    const { count: driversCount } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'driver');

    const { count: totalCount } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });

    return {
      all_customers: customersCount || 0,
      all_drivers: driversCount || 0,
      all_users: totalCount || 0,
      error: null
    };
  } catch (error: any) {
    return { all_customers: 0, all_drivers: 0, all_users: 0, error: error.message };
  }
}

export async function searchUsers(query: string) {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, name, email, role, expo_push_token')
      .ilike('name', `%${query}%`)
      .limit(10);

    if (error) throw error;
    return data || [];
  } catch (error: any) {
    console.error('Search error:', error);
    return [];
  }
}

export async function sendNotificationToAudience(
  audience: string,
  title: string,
  body: string,
  userId?: string
) {
  try {
    let targetUsers: any[] = [];

    // Get target users based on audience type
    if (audience === 'single' && userId) {
      const { data } = await supabase
        .from('users')
        .select('id, expo_push_token')
        .eq('id', userId)
        .single();
      if (data) targetUsers = [data];
    } else if (audience === 'all_customers') {
      const { data } = await supabase
        .from('users')
        .select('id, expo_push_token')
        .eq('role', 'customer');
      targetUsers = data || [];
    } else if (audience === 'all_drivers') {
      const { data } = await supabase
        .from('users')
        .select('id, expo_push_token')
        .eq('role', 'driver');
      targetUsers = data || [];
    } else if (audience === 'all_users') {
      const { data } = await supabase
        .from('users')
        .select('id, expo_push_token');
      targetUsers = data || [];
    }

    if (targetUsers.length === 0) {
      return { success: false, count: 0, error: 'No users found' };
    }

    // Store notification in database for each user
    const notificationRecords = targetUsers.map(user => ({
      user_id: user.id,
      title,
      body,
      is_read: false,
      created_at: new Date().toISOString()
    }));

    const { error: dbError } = await supabase
      .from('notifications')
      .insert(notificationRecords);

    if (dbError) throw dbError;

    // TODO: Send actual push notifications via Expo
    // For now, we're just storing in DB
    const tokensToNotify = targetUsers.filter(u => u.expo_push_token);
    
    return {
      success: true,
      count: targetUsers.length,
      error: null
    };
  } catch (error: any) {
    console.error('Send notification error:', error);
    return { success: false, count: 0, error: error.message };
  }
}
