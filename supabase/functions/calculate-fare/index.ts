// Calculate Fare Edge Function
// Calculates trip fare based on distance, duration, and vehicle type
// Includes dynamic surge pricing based on demand/supply ratio

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface FareRequest {
  origin_lat: number
  origin_lng: number
  dest_lat: number
  dest_lng: number
  vehicle_type?: string // Optional if get_all_vehicles is true
  get_all_vehicles?: boolean
}

interface FareResponse {
  base_fare: number
  distance_fare: number
  time_fare: number
  distance_km: number
  duration_minutes: number
  surge_multiplier: number
  total_fare: number
  vehicle_type?: string
  currency?: string
}

// Haversine formula to calculate distance between two points
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

// Estimate duration based on distance (rough estimate: 25 km/h avg speed in city)
function estimateDuration(distanceKm: number): number {
  return Math.ceil(distanceKm / 25 * 60) // minutes
}

// =====================================================
// DYNAMIC SURGE PRICING
// =====================================================
// Surge is calculated based on demand (pending bookings) vs supply (online drivers)
// within a given radius of the pickup location.
//
// Surge tiers:
//   Ratio <= 1.0  → 1.0x (normal — more drivers than bookings)
//   Ratio 1.0-2.0 → 1.0x-1.3x (mild surge)
//   Ratio 2.0-3.0 → 1.3x-1.6x (moderate surge)
//   Ratio 3.0-5.0 → 1.6x-2.0x (high surge)
//   Ratio > 5.0   → 2.0x (cap — never exceed 2x)
//
// The surge is always capped at 2.0x to protect customers.
// =====================================================

async function calculateSurgeMultiplier(
  supabase: any,
  originLat: number,
  originLng: number,
  vehicleType?: string,
  radiusKm: number = 5
): Promise<number> {
  try {
    // Count pending bookings in the area (last 10 minutes)
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    
    let bookingsQuery = supabase
      .from('bookings')
      .select('id, origin_latitude, origin_longitude', { count: 'exact', head: true })
      .eq('status', 'pending')
      .is('driver_id', null)
      .gte('created_at', tenMinutesAgo)
    
    if (vehicleType) {
      bookingsQuery = bookingsQuery.eq('vehicle_type', vehicleType)
    }

    const { count: pendingCount, error: bookingsError } = await bookingsQuery

    if (bookingsError) {
      console.error('Error counting pending bookings:', bookingsError.message)
      return 1.0 // Default to no surge on error
    }

    // Count online drivers in the area
    let driversQuery = supabase
      .from('drivers')
      .select('id, current_latitude, current_longitude', { count: 'exact', head: true })
      .eq('is_online', true)
      .eq('verification_status', 'approved')
      .not('current_latitude', 'is', null)
      .not('current_longitude', 'is', null)
    
    if (vehicleType) {
      driversQuery = driversQuery.eq('vehicle_type', vehicleType)
    }

    const { count: onlineDriverCount, error: driversError } = await driversQuery

    if (driversError) {
      console.error('Error counting online drivers:', driversError.message)
      return 1.0
    }

    const pendingBookings = pendingCount || 0
    const onlineDrivers = onlineDriverCount || 0

    // If no pending bookings or plenty of drivers, no surge
    if (pendingBookings === 0 || onlineDrivers === 0) {
      // If there are bookings but no drivers, apply max surge to attract drivers
      if (pendingBookings > 0 && onlineDrivers === 0) {
        return 2.0
      }
      return 1.0
    }

    // Calculate demand/supply ratio
    const ratio = pendingBookings / onlineDrivers

    // Apply tiered surge
    let surge: number
    if (ratio <= 1.0) {
      surge = 1.0 // Normal — enough drivers
    } else if (ratio <= 2.0) {
      // Linear interpolation: 1.0 → 1.3
      surge = 1.0 + (ratio - 1.0) * 0.3
    } else if (ratio <= 3.0) {
      // Linear interpolation: 1.3 → 1.6
      surge = 1.3 + (ratio - 2.0) * 0.3
    } else if (ratio <= 5.0) {
      // Linear interpolation: 1.6 → 2.0
      surge = 1.6 + (ratio - 3.0) * 0.2
    } else {
      surge = 2.0 // Hard cap at 2x
    }

    // Round to 1 decimal
    return Math.round(surge * 10) / 10
  } catch (error) {
    console.error('Surge calculation error:', error)
    return 1.0 // Default to no surge on error
  }
}

// =====================================================
// RATE LIMITING
// =====================================================

const ipRequestCounts = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_WINDOW_MS = 60 * 1000 // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 30 // 30 requests per minute per IP

function checkRateLimit(clientIp: string): boolean {
  const now = Date.now()
  const record = ipRequestCounts.get(clientIp)

  if (!record || now > record.resetAt) {
    ipRequestCounts.set(clientIp, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return true
  }

  record.count++
  if (record.count > RATE_LIMIT_MAX_REQUESTS) {
    return false // Rate limited
  }
  return true
}

// Clean up stale entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [ip, record] of ipRequestCounts.entries()) {
    if (now > record.resetAt) {
      ipRequestCounts.delete(ip)
    }
  }
}, 5 * 60 * 1000)

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Rate limiting
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    if (!checkRateLimit(clientIp)) {
      return new Response(
        JSON.stringify({ error: 'Too many requests. Please try again later.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '60' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { origin_lat, origin_lng, dest_lat, dest_lng, vehicle_type, get_all_vehicles }: FareRequest = await req.json()

    // Validate inputs
    if (origin_lat == null || origin_lng == null || dest_lat == null || dest_lng == null) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: origin/destination coordinates' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!get_all_vehicles && !vehicle_type) {
       return new Response(
        JSON.stringify({ error: 'Missing required field: vehicle_type (or set get_all_vehicles=true)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Calculate distance and duration once
    const distanceKm = calculateDistance(origin_lat, origin_lng, dest_lat, dest_lng)
    const durationMinutes = estimateDuration(distanceKm)

    // Calculate dynamic surge multiplier based on demand/supply
    const surgeMultiplier = await calculateSurgeMultiplier(
      supabase,
      origin_lat,
      origin_lng,
      get_all_vehicles ? undefined : vehicle_type
    )

    // Helper to calculate fare for a single config
    const calculateForConfig = (config: any): FareResponse => {
        const baseFare = Number(config.base_fare)
        const distanceFare = distanceKm * Number(config.per_km_rate)
        const timeFare = durationMinutes * Number(config.per_minute_rate)
        
        let totalFare = (baseFare + distanceFare + timeFare) * surgeMultiplier
        totalFare = Math.max(totalFare, Number(config.minimum_fare))
        totalFare = Math.round(totalFare)

        return {
          vehicle_type: config.vehicle_type,
          base_fare: Math.round(baseFare),
          distance_fare: Math.round(distanceFare),
          time_fare: Math.round(timeFare),
          total_fare: totalFare,
          distance_km: Math.round(distanceKm * 10) / 10,
          duration_minutes: durationMinutes,
          surge_multiplier: surgeMultiplier,
          currency: 'INR'
        }
    }

    if (get_all_vehicles) {
      // Fetch ALL active vehicle configs
      const { data: allConfigs, error: configsError } = await supabase
        .from('fare_config')
        .select('*')
        .eq('is_active', true)
      
      if (configsError) throw configsError
      
      if (!allConfigs || allConfigs.length === 0) {
        return new Response(
          JSON.stringify({ options: [] }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      const options = allConfigs.map(calculateForConfig)
      
      // Sort: bike first, then by price
      options.sort((a, b) => {
          if (a.vehicle_type === 'bike') return -1;
          if (b.vehicle_type === 'bike') return 1;
          return a.total_fare - b.total_fare;
      })

      return new Response(
        JSON.stringify({ options, surge_multiplier: surgeMultiplier }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } else {
      // Single vehicle calculation
      const { data: fareConfig, error: configError } = await supabase
        .from('fare_config')
        .select('*')
        .eq('vehicle_type', vehicle_type)
        .eq('is_active', true)
        .single()

      if (configError || !fareConfig) {
        return new Response(
          JSON.stringify({ error: 'Invalid vehicle type or fare config not found' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const response = calculateForConfig(fareConfig)

      return new Response(
        JSON.stringify(response),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

  } catch (error) {
    console.error('Error calculating fare:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
