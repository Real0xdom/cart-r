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
    const { data, error } = await supabase.functions.invoke('calculate-fare', {
      body: {
        origin_lat: originLat,
        origin_lng: originLng,
        dest_lat: destLat,
        dest_lng: destLng,
        get_all_vehicles: true,
      },
    });

    if (error) {
      console.error("Error invoking calculate-fare function:", error);
      throw error;
    }

    return data.options || [];
  } catch (error) {
    console.error("Error calculating fares:", error);
    throw error;
  }
};
