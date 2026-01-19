"use strict";
// Calculate Fare Edge Function
// Calculates trip fare based on distance, duration, and vehicle type
Object.defineProperty(exports, "__esModule", { value: true });
const server_ts_1 = require("https://deno.land/std@0.168.0/http/server.ts");
const supabase_js_2_1 = require("https://esm.sh/@supabase/supabase-js@2");
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
// Haversine formula to calculate distance between two points
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}
function toRad(deg) {
    return deg * (Math.PI / 180);
}
// Estimate duration based on distance (rough estimate: 25 km/h avg speed in city)
function estimateDuration(distanceKm) {
    return Math.ceil(distanceKm / 25 * 60); // minutes
}
(0, server_ts_1.serve)(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }
    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        const supabase = (0, supabase_js_2_1.createClient)(supabaseUrl, supabaseKey);
        const { origin_lat, origin_lng, dest_lat, dest_lng, vehicle_type, get_all_vehicles } = await req.json();
        // Validate inputs
        if (!origin_lat || !origin_lng || !dest_lat || !dest_lng) {
            return new Response(JSON.stringify({ error: 'Missing required fields: origin/destination coordinates' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        if (!get_all_vehicles && !vehicle_type) {
            return new Response(JSON.stringify({ error: 'Missing required field: vehicle_type (or set get_all_vehicles=true)' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        // Calculate distance and duration once
        const distanceKm = calculateDistance(origin_lat, origin_lng, dest_lat, dest_lng);
        const durationMinutes = estimateDuration(distanceKm);
        const surgeMultiplier = 1.0; // TODO: Implement dynamic surge
        // Helper to calculate fare for a single config
        const calculateForConfig = (config) => {
            const baseFare = Number(config.base_fare);
            const distanceFare = distanceKm * Number(config.per_km_rate);
            const timeFare = durationMinutes * Number(config.per_minute_rate);
            let totalFare = (baseFare + distanceFare + timeFare) * surgeMultiplier;
            totalFare = Math.max(totalFare, Number(config.minimum_fare));
            totalFare = Math.round(totalFare);
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
            };
        };
        if (get_all_vehicles) {
            // Fetch ALL active vehicle configs
            const { data: allConfigs, error: configsError } = await supabase
                .from('fare_config')
                .select('*')
                .eq('is_active', true);
            if (configsError)
                throw configsError;
            const options = (allConfigs || []).map(calculateForConfig);
            // Sort: bike first, then by price
            options.sort((a, b) => {
                if (a.vehicle_type === 'bike')
                    return -1;
                if (b.vehicle_type === 'bike')
                    return 1;
                return a.total_fare - b.total_fare;
            });
            return new Response(JSON.stringify({ options }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        else {
            // Single vehicle calculation
            const { data: fareConfig, error: configError } = await supabase
                .from('fare_config')
                .select('*')
                .eq('vehicle_type', vehicle_type)
                .eq('is_active', true)
                .single();
            if (configError || !fareConfig) {
                return new Response(JSON.stringify({ error: 'Invalid vehicle type or fare config not found' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }
            const response = calculateForConfig(fareConfig);
            return new Response(JSON.stringify(response), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
    }
    catch (error) {
        console.error('Error calculating fare:', error);
        return new Response(JSON.stringify({ error: 'Internal server error', details: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
});
