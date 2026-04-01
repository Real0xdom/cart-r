// Send Notification Edge Function
// Sends push notifications via Expo Push API

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'
const DRIVER_RIDE_REQUEST_CHANNEL = 'driver_ride_request_urgent'

interface NotificationRequest {
  user_id: string
  title?: string
  body?: string
  data?: Record<string, any>
}

function isMissingColumnError(error: any, column: string) {
  return Boolean(error?.message?.includes(column))
}

interface ExpoPushMessage {
  to: string
  title?: string
  body?: string
  data?: Record<string, any>
  sound?: 'default' | null
  badge?: number
  ttl?: number
  priority?: 'default' | 'normal' | 'high'
}

import { checkRateLimit, getClientIp, rateLimitedResponse } from '../_shared/rate-limiter.ts'

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Rate limiting: 20 requests per minute for notifications
  if (!checkRateLimit(getClientIp(req), { maxRequests: 20 })) {
    return rateLimitedResponse(corsHeaders)
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { user_id, title, body, data }: NotificationRequest = await req.json()

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: user_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const targetApp = data?.target_app === 'customer' || data?.target_app === 'driver'
      ? data.target_app
      : null

    // App-specific deliveries should only use scoped push_tokens rows so a
    // shared account does not receive driver notifications inside the customer app.
    const { data: userRecord } = targetApp
      ? { data: null as { expo_push_token?: string | null } | null }
      : await supabase
          .from('users')
          .select('expo_push_token')
          .eq('id', user_id)
          .single()

    let pushTokensQuery = supabase
      .from('push_tokens')
      .select('token, app_type')
      .eq('user_id', user_id)
      .eq('is_active', true)

    if (targetApp) {
      pushTokensQuery = pushTokensQuery.eq('app_type', targetApp)
    }

    let pushTokensResult = await pushTokensQuery
    if (isMissingColumnError(pushTokensResult.error, 'app_type')) {
      pushTokensResult = await supabase
        .from('push_tokens')
        .select('token')
        .eq('user_id', user_id)
        .eq('is_active', true)
    }

    const pushTokens = pushTokensResult.data

    const allTokens = new Set<string>()
    if (userRecord?.expo_push_token) allTokens.add(userRecord.expo_push_token)
    pushTokens?.forEach(t => { if (t.token) allTokens.add(t.token) })

    if (allTokens.size === 0) {
      console.log('No push tokens found for user:', user_id)
      // Save notification to database for in-app notifications
      await supabase.from('notifications').insert({
        user_id,
        title,
        body,
        data,
      })
      
      return new Response(
        JSON.stringify({ 
          sent: false, 
          reason: 'No push tokens registered',
          saved_to_db: true,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Send to all tokens found
    const messages: ExpoPushMessage[] = []
    
    for (const token of allTokens) {
      if (!token.startsWith('ExponentPushToken[')) {
        console.error('Invalid push token format:', token)
        continue
      }

      const message: ExpoPushMessage = {
        to: token,
        data: data || {},
        sound: 'default',
        priority: 'high',
        channelId: DRIVER_RIDE_REQUEST_CHANNEL,
        _displayInForeground: true,
      }

      if (data?.is_data_only) {
        // Fallback for background delivery
        message.title = title || '🚨 Ride Request Update'
        message.body = body || 'New ride request details available.'
      } else {
        message.title = title
        message.body = body
      }
      
      messages.push(message)
    }

    if (messages.length === 0) {
       return new Response(
         JSON.stringify({ error: 'No valid push tokens found', sent: false }),
         { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       )
    }

    // Send to Expo Push API
    const pushResponse = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
      },
      body: JSON.stringify(messages),
    })

    const pushResult = await pushResponse.json()

    // Save notification to database
    await supabase.from('notifications').insert({
      user_id,
      title,
      body,
      data,
    })

    // Check for errors in Expo response
    if (pushResult.data?.[0]?.status === 'error') {
      console.error('Expo push error:', pushResult.data[0])
      return new Response(
        JSON.stringify({
          sent: false,
          error: pushResult.data[0].message,
          details: pushResult.data[0].details,
          saved_to_db: true,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Notification sent successfully to:', user_id)

    return new Response(
      JSON.stringify({
        sent: true,
        ticket_id: pushResult.data?.[0]?.id,
        saved_to_db: true,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error sending notification:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
