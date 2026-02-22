// Process Notification Queue Edge Function
// Polls the notifications table and sends push notifications via Expo

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

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
    // Only select columns that definitely exist in the table
    const { data: notifications, error: fetchError } = await supabase
      .from('notifications')
      .select(`
        id,
        user_id,
        title,
        body,
        data,
        is_read,
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

    // Prepare Expo push messages, grouped by token to avoid PUSH_TOO_MANY_EXPERIENCE_IDS
    const messagesByExperience = new Map<string, ExpoPushMessage[]>()
    const notificationIds: string[] = []

    for (const notification of notifications) {
      const pushToken = (notification as any).users?.expo_push_token

      if (!pushToken || !pushToken.startsWith('ExponentPushToken')) {
        console.log(`Skipping notification ${notification.id}: Invalid push token "${pushToken}"`)
        // Still mark as processed so we don't retry forever
        notificationIds.push(notification.id)
        continue
      }

      // Extract experience ID from token for grouping
      let expId = 'default'
      const match = pushToken.match(/ExponentPushToken\[(.*?)\]/)
      if (match && match[1]) {
        expId = match[1]
      }

      const msg: ExpoPushMessage = {
        to: pushToken,
        title: notification.title,
        body: notification.body,
        data: notification.data || {},
        sound: 'default',
        priority: 'high',
        channelId: 'default',
        ttl: 0,
      }

      const group = messagesByExperience.get(expId) || []
      group.push(msg)
      messagesByExperience.set(expId, group)

      notificationIds.push(notification.id)
    }

    // Send to Expo Push API, grouped by experience
    let totalSent = 0
    const expoPushEndpoint = 'https://exp.host/--/api/v2/push/send'

    for (const [expId, messages] of messagesByExperience) {
      if (messages.length === 0) continue

      try {
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
        console.log(`Sent ${messages.length} notifications for experience '${expId}':`, JSON.stringify(pushResult))
        totalSent += messages.length
      } catch (sendError) {
        console.error(`Error sending notifications for experience '${expId}':`, sendError)
      }
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
        processed: totalSent,
        skipped: notifications.length - totalSent,
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
