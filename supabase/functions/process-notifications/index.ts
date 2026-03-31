// Process Notification Queue Edge Function
// Polls the notifications table and sends push notifications via Expo

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const DRIVER_RIDE_REQUEST_CHANNEL = 'driver_ride_request_urgent'

interface ExpoPushMessage {
  to: string
  title?: string
  body?: string
  data?: Record<string, any>
  sound?: string
  priority?: string
  channelId?: string
  ttl?: number
}

function isMissingColumnError(error: any, column: string) {
  return Boolean(error?.message?.includes(column))
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
        is_read
      `)
      .is('processed_at', null)
      .order('created_at', { ascending: true })
      .limit(50) // Reduce limit for manual token fetching efficiency

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

    // Get unique user IDs to fetch tokens efficiently
    const userIds = [...new Set(notifications.map(n => n.user_id))]
    
    // Fetch legacy tokens from users table
    const { data: userTokens } = await supabase
      .from('users')
      .select('id, expo_push_token')
      .in('id', userIds)
    
    // Fetch modern tokens from push_tokens table
    let multiDeviceTokensResult = await supabase
      .from('push_tokens')
      .select('user_id, token, app_type')
      .in('user_id', userIds)
      .eq('is_active', true)

    if (isMissingColumnError(multiDeviceTokensResult.error, 'app_type')) {
      multiDeviceTokensResult = await supabase
        .from('push_tokens')
        .select('user_id, token')
        .in('user_id', userIds)
        .eq('is_active', true)
    }

    const multiDeviceTokens = multiDeviceTokensResult.data

    // Prepare Expo push messages
    const messagesByExperience = new Map<string, ExpoPushMessage[]>()
    const notificationIds: string[] = []

    const userLegacyTokenMap = new Map<string, string>()
    userTokens?.forEach(u => {
      if (u.expo_push_token) {
        userLegacyTokenMap.set(u.id, u.expo_push_token)
      }
    })

    for (const notification of notifications) {
      const targetApp = notification.data?.target_app === 'customer' || notification.data?.target_app === 'driver'
        ? notification.data.target_app
        : null

      const tokens = new Set<string>()
      if (targetApp !== 'customer') {
        const legacyToken = userLegacyTokenMap.get(notification.user_id)
        if (legacyToken) {
          tokens.add(legacyToken)
        }
      }

      const multiDeviceMatches = (multiDeviceTokens || []).filter((tokenRow: any) => {
        if (tokenRow.user_id !== notification.user_id || !tokenRow.token) {
          return false
        }
        return !targetApp || !('app_type' in tokenRow) || tokenRow.app_type === targetApp
      })

      multiDeviceMatches.forEach((tokenRow: any) => tokens.add(tokenRow.token))

      if (!tokens || tokens.size === 0) {
        console.log(`No tokens found for user ${notification.user_id} (notif ${notification.id})`)
        notificationIds.push(notification.id)
        continue
      }

      for (const pushToken of tokens) {
        if (!pushToken.startsWith('ExponentPushToken')) continue

        // Extract experience ID from token for grouping
        let expId = 'default'
        const match = pushToken.match(/ExponentPushToken\[(.*?)\]/)
        if (match && match[1]) {
          expId = match[1]
        }

        const msg: ExpoPushMessage = {
          to: pushToken,
          data: notification.data || {},
          sound: 'default',
          priority: 'high',
          channelId: DRIVER_RIDE_REQUEST_CHANNEL,
          ttl: 0,
        }

        // Handle data-only notifications with fallback
        if (notification.data?.is_data_only) {
           // Provide fallback for background delivery in case TaskManager is killed
           msg.title = notification.title || '🚨 Ride Request Update'
           msg.body = notification.body || 'New ride request details available.'
        } else {
          msg.title = notification.title
          msg.body = notification.body
        }

        const group = messagesByExperience.get(expId) || []
        group.push(msg)
        messagesByExperience.set(expId, group)
      }

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
