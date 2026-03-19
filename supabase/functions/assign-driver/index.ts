// Assign Driver Edge Function
// Finds and assigns the nearest available driver to a booking

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AssignDriverRequest {
  booking_id: string
  max_radius_km?: number
}

interface DriverResult {
  id: string
  user_id: string
  vehicle_type: string
  vehicle_number: string
  vehicle_model: string
  rating: number
  distance_km: number
  user: {
    name: string
    phone: string
    avatar_url: string | null
  }
}

import { checkRateLimit, getClientIp, rateLimitedResponse } from '../_shared/rate-limiter.ts'

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Rate limiting: 10 requests per minute for driver assignment
  if (!checkRateLimit(getClientIp(req), { maxRequests: 10 })) {
    return rateLimitedResponse(corsHeaders)
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { booking_id, max_radius_km = 10 }: AssignDriverRequest = await req.json()

    if (!booking_id) {
      return new Response(
        JSON.stringify({ error: 'Missing booking_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get booking details
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', booking_id)
      .single()

    if (bookingError || !booking) {
      return new Response(
        JSON.stringify({ error: 'Booking not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (booking.status !== 'pending') {
      return new Response(
        JSON.stringify({ error: 'Booking is not in pending status' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (booking.driver_id) {
      return new Response(
        JSON.stringify({ error: 'Booking already has a driver assigned' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Find nearby available drivers
    // Using Haversine formula in SQL for distance calculation
    const { data: drivers, error: driversError } = await supabase.rpc('find_nearby_drivers', {
      pickup_lat: booking.origin_latitude,
      pickup_lng: booking.origin_longitude,
      radius_km: max_radius_km,
      required_vehicle_type: booking.vehicle_type,
    })

    // Fallback: If RPC doesn't exist, use client-side filtering
    let availableDrivers: DriverResult[] = drivers || []

    if (driversError || !drivers) {
      console.log('RPC not available, using client-side filtering')
      
      // Get all online, approved drivers with matching vehicle type
      const { data: allDrivers, error: allDriversError } = await supabase
        .from('drivers')
        .select(`
          id,
          user_id,
          vehicle_type,
          vehicle_number,
          vehicle_model,
          rating,
          current_latitude,
          current_longitude,
          user:users!drivers_user_id_fkey(name, phone, avatar_url)
        `)
        .eq('is_online', true)
        .eq('verification_status', 'approved')
        .eq('vehicle_type', booking.vehicle_type)

      if (allDriversError || !allDrivers) {
        return new Response(
          JSON.stringify({ error: 'No drivers available', assigned: false }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Filter by distance and sort
      availableDrivers = allDrivers
        .filter((d: any) => d.current_latitude && d.current_longitude)
        .map((d: any) => ({
          ...d,
          distance_km: calculateDistance(
            booking.origin_latitude,
            booking.origin_longitude,
            d.current_latitude,
            d.current_longitude
          ),
        }))
        .filter((d: any) => d.distance_km <= max_radius_km)
        .sort((a: any, b: any) => {
          // Sort by distance first, then by rating
          if (a.distance_km !== b.distance_km) {
            return a.distance_km - b.distance_km
          }
          return b.rating - a.rating
        })
    }

    if (availableDrivers.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: 'No drivers available in your area',
          assigned: false,
          searched_radius_km: max_radius_km,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Assign the nearest driver
    const assignedDriver = availableDrivers[0]

    // Update booking with driver
    const { error: updateError } = await supabase
      .from('bookings')
      .update({
        driver_id: assignedDriver.id,
        status: 'accepted',
        accepted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', booking_id)
      .eq('status', 'pending') // Ensure still pending (race condition protection)

    if (updateError) {
      return new Response(
        JSON.stringify({ error: 'Failed to assign driver', details: updateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create notification for driver (will be picked up by notification trigger)
    await supabase.from('notifications').insert({
      user_id: assignedDriver.user_id,
      title: 'New Ride Request!',
      body: `Pickup: ${booking.origin_address}`,
      data: { booking_id, type: 'new_ride' },
    })

    return new Response(
      JSON.stringify({
        assigned: true,
        driver: {
          id: assignedDriver.id,
          name: assignedDriver.user?.name,
          phone: assignedDriver.user?.phone,
          avatar_url: assignedDriver.user?.avatar_url,
          vehicle_number: assignedDriver.vehicle_number,
          vehicle_model: assignedDriver.vehicle_model,
          rating: assignedDriver.rating,
          distance_km: Math.round(assignedDriver.distance_km * 10) / 10,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error assigning driver:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// Haversine formula
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371 // Earth's radius in km
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180)
}
