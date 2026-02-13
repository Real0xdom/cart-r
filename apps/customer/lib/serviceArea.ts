import { supabase } from './supabase';

export interface ServiceArea {
  id: string;
  name: string;
  city: string;
  coordinates: any; // GeoJSON polygon
  is_active: boolean;
}

/**
 * Check if a location is within any active service area
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
    const { data, error } = await supabase.rpc('is_location_in_service_area', {
      p_latitude: latitude,
      p_longitude: longitude
    });

    if (error) {
      console.error('[SERVICE AREA] Error checking location:', error);
      return { supported: false, error: error.message };
    }

    if (data && data.length > 0) {
      // Location is within at least one service area
      console.log('[SERVICE AREA] Location supported:', data[0].name);
      return { supported: true, area: data[0] };
    } else {
      console.log('[SERVICE AREA] Location not supported');
      return { supported: false };
    }
  } catch (err: any) {
    console.error('[SERVICE AREA] Exception:', err);
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
      .select('*')
      .eq('is_active', true);

    if (error) {
      console.error('[SERVICE AREA] Error fetching areas:', error);
      return { data: null, error: error.message };
    }

    return { data };
  } catch (err: any) {
    console.error('[SERVICE AREA] Exception:', err);
    return { data: null, error: err.message };
  }
}
