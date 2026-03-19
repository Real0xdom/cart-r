import { supabase } from './supabase';

export interface SavedAddress {
  id: string;
  user_id: string;
  label: string;
  address: string;
  latitude: number;
  longitude: number;
  icon_type: string;
  created_at: string;
}

/** Map saved_address icon_type (e.g. "place", "home") to a valid Ionicon name. */
export function getPlaceIoniconName(iconType: string | undefined): string {
  const map: Record<string, string> = {
    place: 'location-outline',
    home: 'home-outline',
    work: 'briefcase-outline',
    heart: 'heart-outline',
  };
  return (iconType && map[iconType]) || 'location-outline';
}

export interface SavedRoute {
  id: string;
  user_id: string;
  name: string;
  origin_address: string;
  origin_latitude: number;
  origin_longitude: number;
  destination_address: string;
  destination_latitude: number;
  destination_longitude: number;
  created_at: string;
}

/**
 * Get all saved addresses for the current user
 */
export async function getSavedAddresses(): Promise<{ data: SavedAddress[] | null; error: any }> {
  try {
    const { data, error } = await supabase
      .from('saved_addresses')
      .select('*')
      .order('created_at', { ascending: false });

    return { data, error };
  } catch (error) {
    return { data: null, error };
  }
}

/**
 * Save a new address
 */
export async function saveAddress(addressData: Omit<SavedAddress, 'id' | 'user_id' | 'created_at'>): Promise<{ data: SavedAddress | null; error: any }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('saved_addresses')
      .insert({
        ...addressData,
        user_id: user.id
      })
      .select()
      .single();

    return { data, error };
  } catch (error) {
    return { data: null, error };
  }
}

/**
 * Delete a saved address
 */
export async function deleteAddress(addressId: string): Promise<{ success: boolean; error: any }> {
  try {
    const { error } = await supabase
      .from('saved_addresses')
      .delete()
      .eq('id', addressId);

    return { success: !error, error };
  } catch (error) {
    return { success: false, error };
  }
}

/**
 * Get all saved routes
 */
export async function getSavedRoutes(): Promise<{ data: SavedRoute[] | null; error: any }> {
  try {
    const { data, error } = await supabase
      .from('saved_routes')
      .select('*')
      .order('created_at', { ascending: false });

    return { data, error };
  } catch (error) {
    return { data: null, error };
  }
}

/**
 * Save a new route
 */
export async function saveRoute(routeData: Omit<SavedRoute, 'id' | 'user_id' | 'created_at'>): Promise<{ data: SavedRoute | null; error: any }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('saved_routes')
      .insert({
        ...routeData,
        user_id: user.id
      })
      .select()
      .single();

    return { data, error };
  } catch (error) {
    return { data: null, error };
  }
}
/**
 * Delete a saved route
 */
export async function deleteRoute(routeId: string): Promise<{ success: boolean; error: any }> {
  try {
    const { error } = await supabase
      .from('saved_routes')
      .delete()
      .eq('id', routeId);

    return { success: !error, error };
  } catch (error) {
    return { success: false, error };
  }
}
