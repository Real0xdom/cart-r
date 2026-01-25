// Process Notification Queue Edge Function
// Polls the notifications table and sends push notifications via Expo

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

interface Notification {
  id: string
  user_id: string
  title: string
  body: string
  data: Record<string, any>
  notification_type: string
  expo_push_token?: string
}

interface ExpoPushMessage {
  to: string
  title: string
  body: string
  data?: Record<string, any>
  sound?: string
  priority?: string
  channelId?: string
  ttl?: number
}

serve(async (req) => {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Fetch unprocessed notifications with user push tokens
    const { data: notifications, error: fetchError } = await supabase
      .from('notifications')
      .select(`
        id,
        user_id,
        title,
        body,
        data,
        notification_type,
        users!inner(expo_push_token)
      `)
      .is('processed_at', null)
      .order('created_at', { ascending: true })
      .limit(100)

    if (fetchError) {
      console.error('Error fetching notifications:', fetchError)
      return new Response(
        JSON.stringify({ error: fetchError.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    if (!notifications || notifications.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No notifications to process', processed: 0 }),
        { headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Prepare Expo push messages
    const messages: ExpoPushMessage[] = []
    const notificationIds: string[] = []

    for (const notification of notifications) {
      const pushToken = (notification as any).users?.expo_push_token

      if (!pushToken || !pushToken.startsWith('ExponentPushToken')) {
        console.log(`Skipping notification ${notification.id}: Invalid push token`)
        continue
      }

      const isRideRequest = notification.notification_type === 'ride_request';
      const channelId = isRideRequest ? 'ride-requests' : (notification.notification_type === 'booking_update' ? 'booking-updates' : 'default');

      messages.push({
        to: pushToken,
        title: notification.title,
        body: notification.body,
        data: notification.data || {},
        sound: 'default',
        priority: 'high',
        channelId: channelId,
        ttl: 0, // Zero TTL for immediate high-priority delivery
      })

      notificationIds.push(notification.id)
    }

    // Send to Expo Push API
    if (messages.length > 0) {
      const expoPushEndpoint = 'https://exp.host/--/api/v2/push/send'
      
      const pushResponse = await fetch(expoPushEndpoint, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messages),
      })

      const pushResult = await pushResponse.json()
      console.log(`Sent ${messages.length} notifications:`, pushResult)
    }

    // Mark notifications as processed
    if (notificationIds.length > 0) {
      const { error: updateError } = await supabase
        .from('notifications')
        .update({ processed_at: new Date().toISOString() })
        .in('id', notificationIds)

      if (updateError) {
        console.error('Error marking notifications as processed:', updateError)
      }
    }

    return new Response(
      JSON.stringify({
        message: 'Notifications processed',
        processed: messages.length,
        skipped: notifications.length - messages.length,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('Error processing notifications:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
