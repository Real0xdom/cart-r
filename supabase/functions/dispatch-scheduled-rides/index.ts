import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('[Scheduler] Checking for scheduled rides that need dispatching...')

    // 1. Find all 'scheduled' bookings where scheduled_at is within the next 15 minutes
    // and hasn't been picked up yet
    const { data: upcomingBookings, error: fetchError } = await supabaseClient
      .from('bookings')
      .select('id, scheduled_at')
      .eq('status', 'scheduled')
      // Make sure scheduled_at is NOT NULL and is within the next 15 minutes (or in the past)
      .lte('scheduled_at', new Date(Date.now() + 15 * 60 * 1000).toISOString());

    if (fetchError) {
      console.error('[Scheduler] Error fetching scheduled bookings:', fetchError)
      throw fetchError;
    }

    if (!upcomingBookings || upcomingBookings.length === 0) {
      console.log('[Scheduler] No scheduled rides to dispatch right now.')
      return new Response(JSON.stringify({ 
        message: 'No scheduled rides to dispatch right now.',
        count: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    console.log(`[Scheduler] Found ${upcomingBookings.length} rides to dispatch.`)
    let successCount = 0;

    // 2. Update their status to 'pending'
    // This will automatically trigger the `assign-driver` function if it's set up 
    // to listen to UPDATE events where status changes to 'pending'.
    for (const booking of upcomingBookings) {
      const { error: updateError } = await supabaseClient
        .from('bookings')
        .update({ status: 'pending' })
        .eq('id', booking.id);
        
      if (updateError) {
        console.error(`[Scheduler] Failed to dispatch booking ${booking.id}:`, updateError);
      } else {
        successCount++;
        console.log(`[Scheduler] Successfully dispatched booking ${booking.id} (status -> pending)`);
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: `Dispatched ${successCount}/${upcomingBookings.length} scheduled rides.`,
      dispatched: successCount
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error: any) {
    console.error('[Scheduler] Critical Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
