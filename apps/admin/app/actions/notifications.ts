'use server';

import { createClient } from '@supabase/supabase-js';
import { Expo, ExpoPushMessage } from 'expo-server-sdk';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Create a new Expo SDK client
const expo = new Expo();

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

    // 1. Store notifications in database for history
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

    if (dbError) {
      console.error('DB Insert Error:', dbError);
      throw dbError;
    }

    // 2. Prepare for Expo Push Notifications
    const messages: ExpoPushMessage[] = [];
    
    for (const user of targetUsers) {
      if (!user.expo_push_token || !Expo.isExpoPushToken(user.expo_push_token)) {
        console.warn(`Skipping invalid push token for user ${user.id}: ${user.expo_push_token}`);
        continue;
      }

      messages.push({
        to: user.expo_push_token,
        sound: 'default',
        title: title,
        body: body,
        // priority: 'high', // 'default' | 'normal' | 'high'
        data: { withSome: 'data' },
      });
    }

    // 3. Group by experience (project) to avoid PUSH_TOO_MANY_EXPERIENCE_IDS
    // Tokens look like ExponentPushToken[xxxxxxxx]
    // We group by the experience ID extracted from the token to ensure we don't mix projects in one batch request.
    
    const messagesByExperience = new Map<string, ExpoPushMessage[]>();

    for (const msg of messages) {
       const token = typeof msg.to === 'string' ? msg.to : '';
       if (!token) continue;
       
       let expId = 'unknown';
       // Extract the ID inside the brackets: ExponentPushToken[THIS_PART]
       const match = token.match(/ExponentPushToken\[(.*?)\]/);
       if (match && match[1]) {
           expId = match[1];
       }
       
       const group = messagesByExperience.get(expId) || [];
       group.push(msg);
       messagesByExperience.set(expId, group);
    }
    
    const tickets: any[] = [];

    // Send each group separately
    for (const [expId, groupMessages] of messagesByExperience) {
        // Chunk within the group to respect Expo limit (max 100)
        const chunks = expo.chunkPushNotifications(groupMessages);
        
        for (const chunk of chunks) {
            try {
                const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
                tickets.push(...ticketChunk);
                console.log(`✅ Sent ${chunk.length} notifications for experience '${expId}'`);
            } catch (error) {
                console.error(`❌ Error sending chunk for experience '${expId}':`, error);
            }
        }
    }
    
    // Log ticket results for debugging
    const successTickets = tickets.filter((t: any) => t.status === 'ok');
    const errorTickets = tickets.filter((t: any) => t.status === 'error');
    console.log(`📊 Push results: ${successTickets.length} ok, ${errorTickets.length} errors out of ${tickets.length} tickets`);
    if (errorTickets.length > 0) {
      console.error('❌ Error tickets:', JSON.stringify(errorTickets));
    }

    // Mark notifications as processed so edge function queue doesn't re-send them
    const notificationIds = notificationRecords.map((_: any, i: number) => i);
    try {
      // Update all notifications we just inserted to mark as already processed
      // We use the user IDs + timestamp to target the right records
      const { error: processError } = await supabase
        .from('notifications')
        .update({ processed_at: new Date().toISOString() })
        .gte('created_at', new Date(Date.now() - 30000).toISOString()) // Within last 30 seconds
        .in('user_id', targetUsers.map((u: any) => u.id));
      
      if (processError) {
        console.warn('⚠️ Could not mark notifications as processed:', processError.message);
      }
    } catch (markError) {
      console.warn('⚠️ Failed to mark as processed:', markError);
    }

    return {
      success: true,
      count: targetUsers.length,
      sent_count: messages.length,
      push_ok: successTickets.length,
      push_errors: errorTickets.length,
      error: null
    };
  } catch (error: any) {
    console.error('Send notification error:', error);
    return { success: false, count: 0, error: error.message };
  }
}

export async function getNotificationHistory(limit = 50) {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select(`
        id,
        user_id,
        title,
        body,
        is_read,
        created_at,
        users (name, role)
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    
    // Transform data to ensure users is always an object, not an array
    const formattedData = data?.map((item: any) => ({
      ...item,
      users: Array.isArray(item.users) ? item.users[0] : item.users
    }));

    return { data: formattedData || [], error: null };
  } catch (error: any) {
    console.error('Get history error:', error);
    return { data: [], error: error.message };
  }
}

export async function getNotificationStats() {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('id, is_read, created_at');

    if (error) throw error;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sentToday = data?.filter((n: any) => new Date(n.created_at) >= today).length || 0;
    const readCount = data?.filter((n: any) => n.is_read).length || 0;
    const readRate = data && data.length > 0 ? (readCount / data.length) * 100 : 0;

    return {
      total_sent: data?.length || 0,
      sent_today: sentToday,
      read_rate: Math.round(readRate),
      error: null
    };
  } catch (error: any) {
    console.error('Get stats error:', error);
    return { total_sent: 0, sent_today: 0, read_rate: 0, error: error.message };
  }
}
