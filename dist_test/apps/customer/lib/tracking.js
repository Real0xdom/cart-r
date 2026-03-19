"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.subscribeToDriverLocation = subscribeToDriverLocation;
exports.subscribeToBookingStatus = subscribeToBookingStatus;
exports.findNearbyDrivers = findNearbyDrivers;
exports.estimateETA = estimateETA;
exports.getDriverCurrentLocation = getDriverCurrentLocation;
// Real-time location tracking utilities for Customer App
const supabase_1 = require("./supabase");
/**
 * Subscribe to real-time driver location updates
 * Used during active trips to show driver on map
 */
function subscribeToDriverLocation(driverId, onLocationUpdate) {
    console.log(`📍 Subscribing to driver location: ${driverId}`);
    const subscription = supabase_1.supabase
        .channel(`driver-${driverId}-location`)
        .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'drivers',
        filter: `id=eq.${driverId}`,
    }, (payload) => {
        const { current_latitude, current_longitude, last_location_update } = payload.new;
        if (current_latitude && current_longitude) {
            onLocationUpdate({
                latitude: parseFloat(current_latitude),
                longitude: parseFloat(current_longitude),
                last_update: last_location_update,
            });
        }
    })
        .subscribe();
    return () => {
        console.log(`📍 Unsubscribing from driver location: ${driverId}`);
        subscription.unsubscribe();
    };
}
/**
 * Subscribe to booking status changes
 * Used to update UI when booking status changes
 */
function subscribeToBookingStatus(bookingId, onStatusChange) {
    console.log(`📦 Subscribing to booking status: ${bookingId}`);
    const subscription = supabase_1.supabase
        .channel(`booking-${bookingId}`)
        .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'bookings',
        filter: `id=eq.${bookingId}`,
    }, (payload) => {
        onStatusChange(payload.new.status, payload.new);
    })
        .subscribe();
    return () => {
        console.log(`📦 Unsubscribing from booking: ${bookingId}`);
        subscription.unsubscribe();
    };
}
/**
 * Find nearby available drivers using PostGIS
 * Attempts RPC function first, falls back to client-side calculation
 */
async function findNearbyDrivers(latitude, longitude, vehicleType, radiusKm = 10) {
    try {
        // Try using PostGIS RPC function first
        const rpcParams = {
            pickup_lat: latitude,
            pickup_lng: longitude,
            radius_km: radiusKm,
        };
        if (vehicleType) {
            rpcParams.required_vehicle_type = vehicleType;
        }
        const { data: rpcData, error: rpcError } = await supabase_1.supabase.rpc('find_nearby_drivers', rpcParams);
        if (!rpcError && rpcData) {
            console.log(`🚗 Found ${rpcData.length} nearby drivers via PostGIS`);
            return { data: rpcData, error: null };
        }
        console.log('⚠️ PostGIS function not available, using fallback');
        // Fallback: Client-side calculation
        let query = supabase_1.supabase
            .from('drivers')
            .select(`
        *,
        user:users(name, phone, avatar_url)
      `)
            .eq('is_online', true)
            .eq('verification_status', 'approved')
            .not('current_latitude', 'is', null)
            .not('current_longitude', 'is', null);
        if (vehicleType) {
            query = query.eq('vehicle_type', vehicleType);
        }
        const { data: drivers, error } = await query;
        if (error) {
            return { data: [], error: error.message };
        }
        if (!drivers || drivers.length === 0) {
            return { data: [], error: null };
        }
        // Calculate distance for each driver using Haversine formula
        const driversWithDistance = drivers
            .map((driver) => ({
            ...driver,
            latitude: parseFloat(driver.current_latitude),
            longitude: parseFloat(driver.current_longitude),
            distance_km: calculateDistance(latitude, longitude, parseFloat(driver.current_latitude), parseFloat(driver.current_longitude)),
        }))
            .filter((driver) => driver.distance_km <= radiusKm)
            .sort((a, b) => a.distance_km - b.distance_km)
            .slice(0, 20); // Limit to 20 drivers
        console.log(`🚗 Found ${driversWithDistance.length} nearby drivers via fallback`);
        return { data: driversWithDistance, error: null };
    }
    catch (err) {
        console.error('Error finding nearby drivers:', err);
        return { data: [], error: err.message };
    }
}
/**
 * Calculate distance between two points using Haversine formula
 */
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
function toRad(value) {
    return value * (Math.PI / 180);
}
/**
 * Get estimated time of arrival
 * Uses Google Maps Distance Matrix API if available, otherwise estimates based on distance
 */
function estimateETA(distanceKm, vehicleType) {
    // Average speeds by vehicle type (km/h) in city traffic
    const averageSpeeds = {
        bike: 25,
        tempo: 20,
        sedan: 22,
        truck: 18,
    };
    const speed = averageSpeeds[vehicleType] || 20;
    const etaMinutes = (distanceKm / speed) * 60;
    // Add buffer for pickup preparation
    return Math.ceil(etaMinutes) + 2;
}
/**
 * Get driver's current location once (for initial display)
 */
async function getDriverCurrentLocation(driverId) {
    try {
        const { data, error } = await supabase_1.supabase
            .from('drivers')
            .select('current_latitude, current_longitude, last_location_update')
            .eq('id', driverId)
            .single();
        if (error || !data) {
            return null;
        }
        if (!data.current_latitude || !data.current_longitude) {
            return null;
        }
        return {
            latitude: parseFloat(data.current_latitude),
            longitude: parseFloat(data.current_longitude),
            last_update: data.last_location_update,
        };
    }
    catch (error) {
        console.error('Error getting driver location:', error);
        return null;
    }
}
