import { supabase } from './supabase';
import bikeImage from '@/assets/images/bike.png';
import chotaHathiImage from '@/assets/images/chota-hathi.png';
import pickupImage from '@/assets/images/pickup.png';
import tempoImage from '@/assets/images/tempo.png';
import truckImage from '@/assets/images/truck.png';

/**
 * Vehicle Type from database with all specifications
 */
export interface VehicleType {
  vehicle_type: string;
  display_name: string;
  description: string;
  icon_emoji: string;
  icon_url?: string | null;
  base_fare: number;
  per_km_rate: number;
  minimum_fare: number;
  max_weight_kg: number;
  suitable_for: string[];
}

/**
 * Fetches active vehicle types from database with fare and specifications
 * Uses the get_vehicle_types_with_fare() RPC function
 */
export async function getActiveVehicleTypes(): Promise<{
  data: VehicleType[] | null;
  error: string | null;
}> {
  try {
    const { data, error } = await supabase.rpc('get_vehicle_types_with_fare');

    if (error) {
      console.error('[VEHICLE TYPES] Error fetching:', error);
      return { data: null, error: error.message };
    }

    console.log('[VEHICLE TYPES] Fetched from database:', data?.length, 'types');
    return { data, error: null };
  } catch (err: any) {
    console.error('[VEHICLE TYPES] Exception:', err);
    return { data: null, error: err.message || 'Failed to fetch vehicle types' };
  }
}

/**
 * Get vehicle icon emoji from database, with fallback
 */
export function getVehicleIcon(
  vehicleType: string,
  vehicles: VehicleType[]
): string {
  const vehicle = vehicles.find(v => v.vehicle_type === vehicleType);
  return vehicle?.icon_emoji || '🚗';
}

/**
 * Get vehicle description from database, with fallback
 */
export function getVehicleDescription(
  vehicleType: string,
  vehicles: VehicleType[]
): string {
  const vehicle = vehicles.find(v => v.vehicle_type === vehicleType);
  return vehicle?.description || 'Standard delivery';
}

/**
 * Get vehicle display name from database
 */
export function getVehicleDisplayName(
  vehicleType: string,
  vehicles: VehicleType[]
): string {
  const vehicle = vehicles.find(v => v.vehicle_type === vehicleType);
  return vehicle?.display_name || vehicleType;
}

/**
 * Format vehicle suitable_for array into readable string
 */
export function getVehicleSuitableFor(
  vehicleType: string,
  vehicles: VehicleType[]
): string {
  const vehicle = vehicles.find(v => v.vehicle_type === vehicleType);
  if (!vehicle?.suitable_for || vehicle.suitable_for.length === 0) {
    return '';
  }
  return vehicle.suitable_for.join(', ');
}

/**
 * Get vehicle image source (URL or local asset)
 */
export function getVehicleImageSource(
  vehicleType: string,
  iconUrl?: string | null
) {
  if (iconUrl) {
    return { uri: iconUrl };
  }

  switch (vehicleType) {
    case 'bike':
      return bikeImage;
    case 'chota_hathi':
      return chotaHathiImage;
    case 'pickup':
      return pickupImage;
    case 'tempo':
      return tempoImage;
    case 'truck':
      return truckImage;
    case 'auto':
    case 'three_wheeler':
      return chotaHathiImage;
    default:
      return null;
  }
}
