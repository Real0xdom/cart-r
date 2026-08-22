import { Request, Response } from 'express';
import { supabase } from '../utils/supabase';

const DRIVER_RIDE_REQUEST_CHANNEL = 'driver_ride_request_urgent';

interface ExpoPushMessage {
  to: string;
  title?: string;
  body?: string;
  data?: Record<string, any>;
  sound?: string;
  priority?: string;
  channelId?: string;
  ttl?: number;
}

function isMissingColumnError(error: any, column: string) {
  return Boolean(error?.message?.includes(column));
}

export const processNotifications = async (req: Request, res: Response): Promise<void> => {
  try {
    const { data: notifications, error: fetchError } = await supabase
      .from('notifications')
      .select(`
        id,
        user_id,
        title,
        body,
        data,
        is_read
      `)
      .is('processed_at', null)
      .order('created_at', { ascending: true })
      .limit(50);

    if (fetchError) {
      console.error('Error fetching notifications:', fetchError);
      res.status(500).json({ error: fetchError.message });
      return;
    }

    if (!notifications || notifications.length === 0) {
      res.status(200).json({ message: 'No notifications to process', processed: 0 });
      return;
    }

    const userIds = [...new Set(notifications.map(n => n.user_id))];
    
    const { data: userTokens } = await supabase
      .from('users')
      .select('id, expo_push_token')
      .in('id', userIds);
    
    let multiDeviceTokensResult = await supabase
      .from('push_tokens')
      .select('user_id, token, app_type')
      .in('user_id', userIds)
      .eq('is_active', true);

    if (isMissingColumnError(multiDeviceTokensResult.error, 'app_type')) {
      multiDeviceTokensResult = await supabase
        .from('push_tokens')
        .select('user_id, token')
        .in('user_id', userIds)
        .eq('is_active', true);
    }

    const multiDeviceTokens = multiDeviceTokensResult.data;

    const messagesByExperience = new Map<string, ExpoPushMessage[]>();
    const notificationIds: string[] = [];

    const userLegacyTokenMap = new Map<string, string>();
    userTokens?.forEach(u => {
      if (u.expo_push_token) {
        userLegacyTokenMap.set(u.id, u.expo_push_token);
      }
    });

    for (const notification of notifications) {
      const targetApp = notification.data?.target_app === 'customer' || notification.data?.target_app === 'driver'
        ? notification.data.target_app
        : null;

      const tokens = new Set<string>();
      if (!targetApp) {
        const legacyToken = userLegacyTokenMap.get(notification.user_id);
        if (legacyToken) {
          tokens.add(legacyToken);
        }
      }

      const multiDeviceMatches = (multiDeviceTokens || []).filter((tokenRow: any) => {
        if (tokenRow.user_id !== notification.user_id || !tokenRow.token) {
          return false;
        }
        return !targetApp || !('app_type' in tokenRow) || tokenRow.app_type === targetApp;
      });

      multiDeviceMatches.forEach((tokenRow: any) => tokens.add(tokenRow.token));

      if (!tokens || tokens.size === 0) {
        console.log(`No tokens found for user ${notification.user_id} (notif ${notification.id})`);
        notificationIds.push(notification.id);
        continue;
      }

      for (const pushToken of tokens) {
        if (!pushToken.startsWith('ExponentPushToken')) continue;

        let expId = 'default';
        const match = pushToken.match(/ExponentPushToken\[(.*?)\]/);
        if (match && match[1]) {
          expId = match[1];
        }

        const msg: ExpoPushMessage = {
          to: pushToken,
          data: notification.data || {},
          sound: 'default',
          priority: 'high',
          channelId: DRIVER_RIDE_REQUEST_CHANNEL,
          ttl: 0,
        };

        if (notification.data?.is_data_only) {
           msg.title = notification.title || '🚨 Ride Request Update';
           msg.body = notification.body || 'New ride request details available.';
        } else {
          msg.title = notification.title;
          msg.body = notification.body;
        }

        const group = messagesByExperience.get(expId) || [];
        group.push(msg);
        messagesByExperience.set(expId, group);
      }

      notificationIds.push(notification.id);
    }

    let totalSent = 0;
    const expoPushEndpoint = 'https://exp.host/--/api/v2/push/send';

    for (const [expId, messages] of messagesByExperience) {
      if (messages.length === 0) continue;

      try {
        const pushResponse = await fetch(expoPushEndpoint, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Accept-Encoding': 'gzip, deflate',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(messages),
        });

        const pushResult = await pushResponse.json();
        console.log(`Sent ${messages.length} notifications for experience '${expId}':`, JSON.stringify(pushResult));
        totalSent += messages.length;
      } catch (sendError) {
        console.error(`Error sending notifications for experience '${expId}':`, sendError);
      }
    }

    if (notificationIds.length > 0) {
      const { error: updateError } = await supabase
        .from('notifications')
        .update({ processed_at: new Date().toISOString() })
        .in('id', notificationIds);

      if (updateError) {
        console.error('Error marking notifications as processed:', updateError);
      }
    }

    res.status(200).json({
      message: 'Notifications processed',
      processed: totalSent,
      skipped: notifications.length - totalSent,
    });

  } catch (error: any) {
    console.error('Error processing notifications:', error);
    res.status(500).json({ error: error.message });
  }
};

interface NotificationRequest {
  user_id: string;
  title?: string;
  body?: string;
  data?: Record<string, any>;
}

export const sendNotification = async (req: Request, res: Response): Promise<void> => {
  try {
    const { user_id, title, body, data }: NotificationRequest = req.body;

    if (!user_id) {
      res.status(400).json({ error: 'Missing required field: user_id' });
      return;
    }

    const targetApp = data?.target_app === 'customer' || data?.target_app === 'driver'
      ? data.target_app
      : null;

    const { data: userRecord } = targetApp
      ? { data: null as { expo_push_token?: string | null } | null }
      : await supabase
          .from('users')
          .select('expo_push_token')
          .eq('id', user_id)
          .single();

    let pushTokensQuery = supabase
      .from('push_tokens')
      .select('token, app_type')
      .eq('user_id', user_id)
      .eq('is_active', true);

    if (targetApp) {
      pushTokensQuery = pushTokensQuery.eq('app_type', targetApp);
    }

    let pushTokensResult = await pushTokensQuery;
    if (isMissingColumnError(pushTokensResult.error, 'app_type')) {
      pushTokensResult = await supabase
        .from('push_tokens')
        .select('token')
        .eq('user_id', user_id)
        .eq('is_active', true);
    }

    const pushTokens = pushTokensResult.data;

    const allTokens = new Set<string>();
    if (userRecord?.expo_push_token) allTokens.add(userRecord.expo_push_token);
    pushTokens?.forEach(t => { if (t.token) allTokens.add(t.token); });

    if (allTokens.size === 0) {
      console.log('No push tokens found for user:', user_id);
      await supabase.from('notifications').insert({
        user_id,
        title,
        body,
        data,
        processed_at: new Date().toISOString(),
      });
      
      res.status(200).json({ 
        sent: false, 
        reason: 'No push tokens registered',
        saved_to_db: true,
      });
      return;
    }

    const messages: ExpoPushMessage[] = [];
    
    for (const token of allTokens) {
      if (!token.startsWith('ExponentPushToken[')) {
        console.error('Invalid push token format:', token);
        continue;
      }

      const message: any = {
        to: token,
        data: data || {},
        sound: 'default',
        priority: 'high',
        channelId: DRIVER_RIDE_REQUEST_CHANNEL,
        _displayInForeground: true,
      };

      if (data?.is_data_only) {
        message.title = title || '🚨 Ride Request Update';
        message.body = body || 'New ride request details available.';
      } else {
        message.title = title;
        message.body = body;
      }
      
      messages.push(message);
    }

    if (messages.length === 0) {
       res.status(400).json({ error: 'No valid push tokens found', sent: false });
       return;
    }

    const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
    const pushResponse = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
      },
      body: JSON.stringify(messages),
    });

    const pushResult = await pushResponse.json();

    await supabase.from('notifications').insert({
      user_id,
      title,
      body,
      data,
      processed_at: new Date().toISOString(),
    });

    if (pushResult.data?.[0]?.status === 'error') {
      console.error('Expo push error:', pushResult.data[0]);
      res.status(200).json({
        sent: false,
        error: pushResult.data[0].message,
        details: pushResult.data[0].details,
        saved_to_db: true,
      });
      return;
    }

    console.log('Notification sent successfully to:', user_id);

    res.status(200).json({
      sent: true,
      ticket_id: pushResult.data?.[0]?.id,
      saved_to_db: true,
    });

  } catch (error) {
    console.error('Error sending notification:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
