import { supabase } from "./supabase";

export interface FareEstimate {
  vehicle_type: string;
  base_fare: number;
  distance_fare: number;
  time_fare: number;
  total_fare: number;
  distance_km: number;
  duration_minutes: number;
  surge_multiplier: number;
  currency: string;
}

export interface FareResponse {
  options: FareEstimate[];
}

export const calculateFares = async (
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number
): Promise<FareEstimate[]> => {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:3000';

    const response = await fetch(`${BACKEND_URL}/api/fare/calculate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        origin_lat: originLat,
        origin_lng: originLng,
        dest_lat: destLat,
        dest_lng: destLng,
        get_all_vehicles: true,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Error invoking calculate-fare function:", data.error || 'Failed to calculate fare');
      throw new Error(data.error || 'Failed to calculate fare');
    }

    return data.options || [];
  } catch (error) {
    console.error("Error calculating fares:", error);
    throw error;
  }
};
