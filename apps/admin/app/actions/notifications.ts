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

type AppAudience = 'customer' | 'driver' | 'both';

interface UserAccessMetadata {
  has_customer_access: boolean;
  has_driver_access: boolean;
  customer_app_enabled: boolean;
  driver_app_enabled: boolean | null;
  driver_verification_status: string | null;
  customer_push_active: boolean;
  driver_push_active: boolean;
}

function isMissingColumnError(error: any, column: string) {
  return Boolean(error?.message?.includes(column));
}

async function getUserAccessMetadata(userIds: string[]) {
  const metadataMap = new Map<string, UserAccessMetadata>();

  if (userIds.length === 0) {
    return metadataMap;
  }

  const [usersResult, driversResult, pushTokensResult] = await Promise.all([
    supabase
      .from('users')
      .select('id, customer_app_enabled')
      .in('id', userIds),
    supabase
      .from('drivers')
      .select('user_id, driver_app_enabled, verification_status')
      .in('user_id', userIds),
    supabase
      .from('push_tokens')
      .select('user_id, app_type')
      .in('user_id', userIds)
      .eq('is_active', true),
  ]);

  let users = usersResult.data || [];
  if (isMissingColumnError(usersResult.error, 'customer_app_enabled')) {
    const fallbackUsersResult = await supabase
      .from('users')
      .select('id')
      .in('id', userIds);
    users = fallbackUsersResult.data || [];
  } else if (usersResult.error) {
    throw usersResult.error;
  }

  let drivers = driversResult.data || [];
  if (isMissingColumnError(driversResult.error, 'driver_app_enabled')) {
    const fallbackDriversResult = await supabase
      .from('drivers')
      .select('user_id, verification_status')
      .in('user_id', userIds);
    drivers = fallbackDriversResult.data || [];
  } else if (driversResult.error) {
    throw driversResult.error;
  }

  let pushTokens = pushTokensResult.data || [];
  if (isMissingColumnError(pushTokensResult.error, 'app_type')) {
    const fallbackPushTokensResult = await supabase
      .from('push_tokens')
      .select('user_id')
      .in('user_id', userIds)
      .eq('is_active', true);
    pushTokens = (fallbackPushTokensResult.data || []).map((entry: any) => ({
      user_id: entry.user_id,
      app_type: 'customer',
    }));
  } else if (pushTokensResult.error) {
    throw pushTokensResult.error;
  }

  const driverMap = new Map(
    drivers.map((driver: any) => [driver.user_id, driver])
  );

  const pushTokenMap = new Map<string, { customer: boolean; driver: boolean }>();
  for (const token of pushTokens) {
    if (!token?.user_id) {
      continue;
    }

    const current = pushTokenMap.get(token.user_id) || { customer: false, driver: false };
    if (token.app_type === 'driver') {
      current.driver = true;
    } else {
      current.customer = true;
    }
    pushTokenMap.set(token.user_id, current);
  }

  for (const user of users) {
    const driver = driverMap.get(user.id);
    const pushState = pushTokenMap.get(user.id) || { customer: false, driver: false };
    const customerAppEnabled = typeof (user as any).customer_app_enabled === 'boolean'
      ? (user as any).customer_app_enabled
      : true;

    metadataMap.set(user.id, {
      has_customer_access: customerAppEnabled,
      has_driver_access: Boolean(driver),
      customer_app_enabled: customerAppEnabled,
      driver_app_enabled: typeof driver?.driver_app_enabled === 'boolean' ? driver.driver_app_enabled : null,
      driver_verification_status: driver?.verification_status ?? null,
      customer_push_active: pushState.customer,
      driver_push_active: pushState.driver,
    });
  }

  return metadataMap;
}

async function getAudienceUsers(audience: string, userId?: string) {
  if (audience === 'single' && userId) {
    const { data } = await supabase
      .from('users')
      .select('id, expo_push_token')
      .eq('id', userId)
      .single();
    return data ? [data] : [];
  }

  if (audience === 'all_customers') {
    let result = await supabase
      .from('users')
      .select('id, expo_push_token')
      .eq('customer_app_enabled', true);

    if (isMissingColumnError(result.error, 'customer_app_enabled')) {
      result = await supabase
        .from('users')
        .select('id, expo_push_token')
        .eq('role', 'customer');
    }

    return result.data || [];
  }

  if (audience === 'all_drivers') {
    let result = await supabase
      .from('drivers')
      .select('user_id')
      .eq('driver_app_enabled', true);

    if (isMissingColumnError(result.error, 'driver_app_enabled')) {
      result = await supabase
        .from('drivers')
        .select('user_id');
    }

    const uniqueUserIds = [...new Set((result.data || []).map((driver: any) => driver.user_id).filter(Boolean))];
    if (uniqueUserIds.length === 0) {
      return [];
    }

    const { data: users } = await supabase
      .from('users')
      .select('id, expo_push_token')
      .in('id', uniqueUserIds);

    return users || [];
  }

  const { data } = await supabase
    .from('users')
    .select('id, expo_push_token');
  return data || [];
}

async function getPushTokensForAudience(
  targetUsers: Array<{ id: string; expo_push_token?: string | null }>,
  appAudience: AppAudience
) {
  const userIds = targetUsers.map((user) => user.id);
  if (userIds.length === 0) {
    return new Map<string, Set<string>>();
  }

  let query = supabase
    .from('push_tokens')
    .select('user_id, token, app_type')
    .in('user_id', userIds)
    .eq('is_active', true);

  if (appAudience !== 'both') {
    query = query.eq('app_type', appAudience);
  }

  let pushTokensResult = await query;
  if (isMissingColumnError(pushTokensResult.error, 'app_type')) {
    pushTokensResult = await supabase
      .from('push_tokens')
      .select('user_id, token')
      .in('user_id', userIds)
      .eq('is_active', true);
  } else if (pushTokensResult.error) {
    throw pushTokensResult.error;
  }

  const pushTokens = pushTokensResult.data;

  const tokenMap = new Map<string, Set<string>>();
  for (const entry of pushTokens || []) {
    if (!entry?.user_id || !entry?.token) {
      continue;
    }
    if (!tokenMap.has(entry.user_id)) {
      tokenMap.set(entry.user_id, new Set());
    }
    tokenMap.get(entry.user_id)?.add(entry.token);
  }

  // Legacy fallback: if a user has no active push_tokens row yet, still try the
  // older users.expo_push_token field so direct sends keep working during rollout.
  for (const user of targetUsers) {
    const legacyToken = user.expo_push_token;
    const hasActiveToken = (tokenMap.get(user.id)?.size || 0) > 0;
    if (!legacyToken || hasActiveToken || !Expo.isExpoPushToken(legacyToken)) {
      continue;
    }

    if (!tokenMap.has(user.id)) {
      tokenMap.set(user.id, new Set());
    }
    tokenMap.get(user.id)?.add(legacyToken);
  }

  return tokenMap;
}

export async function getAudienceCounts() {
  try {
    let customersResult = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('customer_app_enabled', true);

    if (isMissingColumnError(customersResult.error, 'customer_app_enabled')) {
      customersResult = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'customer');
    }

    let driversResult = await supabase
      .from('drivers')
      .select('*', { count: 'exact', head: true })
      .eq('driver_app_enabled', true);

    if (isMissingColumnError(driversResult.error, 'driver_app_enabled')) {
      driversResult = await supabase
        .from('drivers')
        .select('*', { count: 'exact', head: true });
    }

    const { count: totalCount } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });

    return {
      all_customers: customersResult.count || 0,
      all_drivers: driversResult.count || 0,
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
      .select('id, name, email, phone, role, expo_push_token')
      .or(`name.ilike.%${query}%,email.ilike.%${query}%,phone.ilike.%${query}%`)
      .limit(10);

    if (error) throw error;

    const users = data || [];
    const accessMetadata = await getUserAccessMetadata(users.map((user: any) => user.id));

    return users.map((user: any) => {
      const metadata = accessMetadata.get(user.id);
      return {
        ...user,
        has_customer_access: metadata?.has_customer_access ?? true,
        has_driver_access: metadata?.has_driver_access ?? false,
        customer_app_enabled: metadata?.customer_app_enabled ?? true,
        driver_app_enabled: metadata?.driver_app_enabled ?? null,
        driver_verification_status: metadata?.driver_verification_status ?? null,
        customer_push_active: metadata?.customer_push_active ?? false,
        driver_push_active: metadata?.driver_push_active ?? false,
      };
    });
  } catch (error: any) {
    console.error('Search error:', error);
    return [];
  }
}

export async function sendNotificationToAudience(
  audience: string,
  title: string,
  body: string,
  userId?: string,
  singleUserTargetApp: AppAudience = 'both',
  notificationData: Record<string, any> = {}
) {
  try {
    const targetUsers = await getAudienceUsers(audience, userId);

    if (targetUsers.length === 0) {
      return { success: false, count: 0, error: 'No users found' };
    }

    const appAudience: AppAudience =
      audience === 'single'
        ? singleUserTargetApp
        : audience === 'all_customers'
        ? 'customer'
        : audience === 'all_drivers'
          ? 'driver'
          : 'both';

    const pushTokenMap = await getPushTokensForAudience(targetUsers, appAudience);

    // 1. Store notifications in database for history
    const notificationPayload =
      appAudience === 'both'
        ? notificationData
        : { ...notificationData, target_app: appAudience };

    const notificationRecords = targetUsers.map(user => ({
      user_id: user.id,
      title,
      body,
      data: notificationPayload,
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
      const tokens = pushTokenMap.get(user.id) || new Set<string>();

      for (const token of tokens) {
        if (!Expo.isExpoPushToken(token)) {
          console.warn(`Skipping invalid push token for user ${user.id}: ${token}`);
          continue;
        }

        messages.push({
          to: token,
          sound: 'default',
          title: title,
          body: body,
          data: notificationPayload,
        });
      }
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
