import { supabase } from './supabase';

export interface ServiceArea {
  id: string;
  name: string;
  city: string;
  state: string;
  country: string;
  center_latitude: number;
  center_longitude: number;
  radius_km: number;
  is_active: boolean | null;
}

/**
 * Calculate the distance between two coordinates using the Haversine formula.
 * Returns distance in kilometers.
 */
export function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Check if a location is within any active service area.
 * Uses the Supabase RPC first (PostGIS-based), falls back to client-side
 * Haversine distance calculation using center + radius from the service_areas table.
 */
export async function isLocationSupported(
  latitude: number,
  longitude: number
): Promise<{
  supported: boolean;
  area?: ServiceArea;
  error?: string;
}> {
  try {
    // First, try the PostGIS RPC function
    const { data: rpcData, error: rpcError } = await supabase.rpc(
      'is_location_in_service_area' as any,
      { lat: latitude, lng: longitude }
    );

    if (!rpcError) {
      // RPC succeeded — but it returns a boolean, not area details
      // If true, fetch the matching area details
      if (rpcData === true) {
        const { data: areas } = await supabase
          .from('service_areas')
          .select('id, name, city, state, country, center_latitude, center_longitude, radius_km, is_active')
          .eq('is_active', true);

        if (areas && areas.length > 0) {
          // Find the best matching area by distance
          let bestArea: ServiceArea | null = null;
          let minDistance = Infinity;
          for (const area of areas) {
            const dist = haversineDistance(
              latitude, longitude,
              Number(area.center_latitude), Number(area.center_longitude)
            );
            if (dist <= Number(area.radius_km) && dist < minDistance) {
              minDistance = dist;
              bestArea = area as ServiceArea;
            }
          }
          if (bestArea) {
            console.log('[SERVICE AREA] Location supported (PostGIS):', bestArea.name);
            return { supported: true, area: bestArea };
          }
        }
        return { supported: true };
      } else {
        console.log('[SERVICE AREA] Location not supported (PostGIS)');
        return { supported: false };
      }
    }

    // RPC failed — fall back to client-side Haversine check
    console.warn('[SERVICE AREA] RPC failed, using client-side check:', rpcError?.message);
    return await isLocationSupportedClientSide(latitude, longitude);

  } catch (err: any) {
    console.error('[SERVICE AREA] Exception:', err);
    // Try client-side fallback
    return await isLocationSupportedClientSide(latitude, longitude);
  }
}

/**
 * Client-side fallback: fetch all active service areas and check radius using Haversine.
 * This works even if PostGIS is not available or the geometry column is not set.
 */
async function isLocationSupportedClientSide(
  latitude: number,
  longitude: number
): Promise<{ supported: boolean; area?: ServiceArea; error?: string }> {
  try {
    const { data: areas, error } = await supabase
      .from('service_areas')
      .select('id, name, city, state, country, center_latitude, center_longitude, radius_km, is_active')
      .eq('is_active', true);

    if (error) {
      console.error('[SERVICE AREA] Error fetching areas:', error);
      return { supported: false, error: error.message };
    }

    if (!areas || areas.length === 0) {
      console.log('[SERVICE AREA] No active service areas configured');
      return { supported: false };
    }

    // Sort by priority (if available) — check each area
    let bestArea: ServiceArea | null = null;
    let minDistance = Infinity;

    for (const area of areas) {
      const centerLat = Number(area.center_latitude);
      const centerLng = Number(area.center_longitude);
      const radiusKm = Number(area.radius_km);

      if (!centerLat || !centerLng || !radiusKm) continue;

      const distance = haversineDistance(latitude, longitude, centerLat, centerLng);
      console.log(`[SERVICE AREA] Distance to "${area.name}": ${distance.toFixed(2)} km (radius: ${radiusKm} km)`);

      if (distance <= radiusKm && distance < minDistance) {
        minDistance = distance;
        bestArea = area as ServiceArea;
      }
    }

    if (bestArea) {
      console.log('[SERVICE AREA] Location supported (client-side):', bestArea.name);
      return { supported: true, area: bestArea };
    }

    console.log('[SERVICE AREA] Location not supported (client-side)');
    return { supported: false };
  } catch (err: any) {
    console.error('[SERVICE AREA] Client-side check exception:', err);
    return { supported: false, error: err.message };
  }
}

/**
 * Record a user's interest in being notified when service expands to their area
 */
export async function recordExpansionInterest(
  userId: string,
  latitude: number,
  longitude: number,
  address: string
): Promise<{ error?: string }> {
  try {
    const { error } = await supabase
      .from('expansion_interests')
      .insert({
        user_id: userId,
        latitude,
        longitude,
        address,
        requested_at: new Date().toISOString()
      });

    if (error) {
      console.error('[SERVICE AREA] Error recording interest:', error);
      return { error: error.message };
    }

    console.log('[SERVICE AREA] Recorded expansion interest for user:', userId);
    return {};
  } catch (err: any) {
    console.error('[SERVICE AREA] Exception:', err);
    return { error: err.message };
  }
}

/**
 * Get all active service areas (for display purposes)
 */
export async function getActiveServiceAreas(): Promise<{
  data: ServiceArea[] | null;
  error?: string;
}> {
  try {
    const { data, error } = await supabase
      .from('service_areas')
      .select('id, name, city, state, country, center_latitude, center_longitude, radius_km, is_active')
      .eq('is_active', true)
      .order('priority', { ascending: false });

    if (error) {
      console.error('[SERVICE AREA] Error fetching areas:', error);
      return { data: null, error: error.message };
    }

    return { data: data as ServiceArea[] };
  } catch (err: any) {
    console.error('[SERVICE AREA] Exception:', err);
    return { data: null, error: err.message };
  }
}
