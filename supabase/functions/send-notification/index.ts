// Send Notification Edge Function
// Sends push notifications via Expo Push API

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'

interface NotificationRequest {
  user_id: string
  title?: string
  body?: string
  data?: Record<string, any>
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

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
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

    // Get user's Expo push token from users table
    // Note: You'll need to add expo_push_token column to users table
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('expo_push_token')
      .eq('id', user_id)
      .single()

    if (userError || !user) {
      console.error('User not found:', user_id)
      return new Response(
        JSON.stringify({ error: 'User not found', sent: false }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!user.expo_push_token) {
      console.log('No push token for user:', user_id)
      // Still save notification to database for in-app notifications
      await supabase.from('notifications').insert({
        user_id,
        title,
        body,
        data,
      })
      
      return new Response(
        JSON.stringify({ 
          sent: false, 
          reason: 'No push token registered',
          saved_to_db: true,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate Expo push token format
    if (!user.expo_push_token.startsWith('ExponentPushToken[')) {
      console.error('Invalid push token format:', user.expo_push_token)
      return new Response(
        JSON.stringify({ error: 'Invalid push token format', sent: false }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Prepare Expo push message with high priority for overlay notifications
    const message: ExpoPushMessage = {
      to: user.expo_push_token,
      data: data || {},
      sound: 'default',
      priority: 'high',
      channelId: 'ride-requests', // Android notification channel for high-priority
      _displayInForeground: true, // Show even when app is in foreground
    }

    if (!data?.is_data_only) {
      if (!title || !body) {
         return new Response(
           JSON.stringify({ error: 'Missing required fields: title, body' }),
           { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
         )
      }
      message.title = title
      message.body = body
    }

    // Send to Expo Push API
    const pushResponse = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
      },
      body: JSON.stringify(message),
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
