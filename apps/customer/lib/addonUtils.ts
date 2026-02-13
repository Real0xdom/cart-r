import { supabase } from './supabase';

export interface AddonService {
  id: string;
  name: string;
  description: string;
  price: number;
  icon: string;
  is_active: boolean;
  applicable_vehicle_types: string[];
}

/**
 * Fetch applicable addon services for a vehicle type
 */
export async function getApplicableAddons(vehicleType: string): Promise<{
  data: AddonService[] | null;
  error: string | null;
}> {
  try {
    const { data, error } = await supabase.rpc('get_applicable_addons', {
      p_vehicle_type: vehicleType
    });

    if (error) {
      console.error('[ADDONS] Error fetching:', error);
      return { data: null, error: error.message };
    }

    console.log('[ADDONS] Fetched for vehicle type:', vehicleType, '→', data?.length, 'addons');
    return { data, error: null };
  } catch (err: any) {
    console.error('[ADDONS] Exception:', err);
    return { data: null, error: err.message || 'Failed to fetch addons' };
  }
}

/**
 * Add addon to booking (called after booking creation)
 */
export async function addAddonToBooking(
  bookingId: string,
  addonId: string
): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase.rpc('add_addon_to_booking', {
      p_booking_id: bookingId,
      p_addon_id: addonId
    });

    if (error) {
      console.error('[ADDONS] Error adding to booking:', error);
      return { error: error.message };
    }

    console.log('[ADDONS] Added addon to booking:', addonId);
    return { error: null };
  } catch (err: any) {
    console.error('[ADDONS] Exception:', err);
    return { error: err.message || 'Failed to add addon' };
  }
}

/**
 * Calculate total addon charges from selected addon IDs
 */
export function calculateAddonCharges(
  selectedAddonIds: string[],
  addons: AddonService[]
): number {
  return selectedAddonIds.reduce((total, id) => {
    const addon = addons.find(a => a.id === id);
    return total + (addon?.price || 0);
  }, 0);
}
