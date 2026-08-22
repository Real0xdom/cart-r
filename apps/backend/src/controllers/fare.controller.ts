import { Request, Response } from 'express';
import { supabase } from '../utils/supabase';

interface FareRequest {
  origin_lat: number;
  origin_lng: number;
  dest_lat: number;
  dest_lng: number;
  vehicle_type?: string;
  get_all_vehicles?: boolean;
}

interface FareResponse {
  base_fare: number;
  distance_fare: number;
  time_fare: number;
  distance_km: number;
  duration_minutes: number;
  surge_multiplier: number;
  total_fare: number;
  vehicle_type?: string;
  currency?: string;
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

async function getRouteInfo(lat1: number, lon1: number, lat2: number, lon2: number): Promise<{ distanceKm: number }> {
  const apiKey = process.env.OLA_MAPS_API_KEY;
  
  if (!apiKey) {
    console.warn('Ola Maps API Key not found in env OLA_MAPS_API_KEY, falling back to straight-line distance');
    return { distanceKm: calculateDistance(lat1, lon1, lat2, lon2) };
  }

  try {
    const url = `https://api.olamaps.io/routing/v1/directions?origin=${lat1},${lon1}&destination=${lat2},${lon2}&api_key=${apiKey}`;
    const response = await fetch(url);
    
    if (!response.ok) {
        throw new Error(`Ola Maps API error: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (data.status === "SUCCESS" || data.routes) {
      if (data.routes && data.routes.length > 0 && data.routes[0].legs && data.routes[0].legs.length > 0) {
        const route = data.routes[0];
        let distanceMeters = 0;
        
        if (route.legs && route.legs.length > 0) {
          distanceMeters = route.legs[0].distance; // distance is in meters
        }
        
        if (typeof distanceMeters === 'number' && distanceMeters > 0) {
          console.log(`[CALCULATE-FARE] Fetched real route distance from Ola Maps: ${distanceMeters / 1000} km`);
          return { distanceKm: distanceMeters / 1000 };
        }
      }
    }
    
    console.warn(`[CALCULATE-FARE] Route fetch failed or empty: ${data.error_msg || 'unknown error'}`);
  } catch (error) {
    console.error('[CALCULATE-FARE] Error fetching route from Ola Maps:', error);
  }

  console.log('[CALCULATE-FARE] Falling back to straight-line Haversine distance');
  return { distanceKm: calculateDistance(lat1, lon1, lat2, lon2) };
}

const VEHICLE_SPEED_KMPH: Record<string, number> = {
  bike: 20,
  three_wheeler: 22,
  auto: 22,
  mini: 24,
  sedan: 25,
  suv: 24,
  pickup: 23,
  tempo: 21,
  chota_hathi: 20,
  truck: 18,
};

function estimateDuration(distanceKm: number, vehicleType?: string): number {
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) return 0;
  const speedKmph = VEHICLE_SPEED_KMPH[vehicleType ?? ''] ?? 25;
  return Math.max(1, Math.ceil((distanceKm / speedKmph) * 60)); // minutes
}

async function calculateSurgeMultiplier(
  originLat: number,
  originLng: number,
  vehicleType?: string,
  radiusKm: number = 5
): Promise<number> {
  try {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    
    let bookingsQuery = supabase
      .from('bookings')
      .select('id, origin_latitude, origin_longitude', { count: 'exact', head: true })
      .eq('status', 'pending')
      .is('driver_id', null)
      .gte('created_at', tenMinutesAgo);
    
    if (vehicleType) {
      bookingsQuery = bookingsQuery.eq('vehicle_type', vehicleType);
    }

    const { count: pendingCount, error: bookingsError } = await bookingsQuery;

    if (bookingsError) {
      console.error('Error counting pending bookings:', bookingsError.message);
      return 1.0;
    }

    let driversQuery = supabase
      .from('drivers')
      .select('id, current_latitude, current_longitude', { count: 'exact', head: true })
      .eq('is_online', true)
      .eq('verification_status', 'approved')
      .not('current_latitude', 'is', null)
      .not('current_longitude', 'is', null);
    
    if (vehicleType) {
      driversQuery = driversQuery.eq('vehicle_type', vehicleType);
    }

    const { count: onlineDriverCount, error: driversError } = await driversQuery;

    if (driversError) {
      console.error('Error counting online drivers:', driversError.message);
      return 1.0;
    }

    const pendingBookings = pendingCount || 0;
    const onlineDrivers = onlineDriverCount || 0;

    if (pendingBookings === 0 || onlineDrivers === 0) {
      if (pendingBookings > 0 && onlineDrivers === 0) {
        return 2.0;
      }
      return 1.0;
    }

    const ratio = pendingBookings / onlineDrivers;
    let surge: number;
    if (ratio <= 1.0) {
      surge = 1.0;
    } else if (ratio <= 2.0) {
      surge = 1.0 + (ratio - 1.0) * 0.3;
    } else if (ratio <= 3.0) {
      surge = 1.3 + (ratio - 2.0) * 0.3;
    } else if (ratio <= 5.0) {
      surge = 1.6 + (ratio - 3.0) * 0.2;
    } else {
      surge = 2.0;
    }

    return Math.round(surge * 10) / 10;
  } catch (error) {
    console.error('Surge calculation error:', error);
    return 1.0;
  }
}

export const calculateFare = async (req: Request, res: Response): Promise<void> => {
  try {
    const { origin_lat, origin_lng, dest_lat, dest_lng, vehicle_type, get_all_vehicles }: FareRequest = req.body;

    if (origin_lat == null || origin_lng == null || dest_lat == null || dest_lng == null) {
      res.status(400).json({ error: 'Missing required fields: origin/destination coordinates' });
      return;
    }

    if (!get_all_vehicles && !vehicle_type) {
      res.status(400).json({ error: 'Missing required field: vehicle_type (or set get_all_vehicles=true)' });
      return;
    }

    const { distanceKm } = await getRouteInfo(origin_lat, origin_lng, dest_lat, dest_lng);
    
    const surgeMultiplier = await calculateSurgeMultiplier(
      origin_lat,
      origin_lng,
      get_all_vehicles ? undefined : vehicle_type
    );

    const calculateForConfig = (config: any): FareResponse => {
        const durationMinutes = estimateDuration(distanceKm, config.vehicle_type);
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
      const { data: allConfigs, error: configsError } = await supabase
        .from('fare_config')
        .select('*')
        .eq('is_active', true);
      
      if (configsError) throw configsError;
      
      if (!allConfigs || allConfigs.length === 0) {
        res.status(200).json({ options: [] });
        return;
      }
      
      const options = allConfigs.map(calculateForConfig);
      options.sort((a, b) => {
          if (a.vehicle_type === 'bike') return -1;
          if (b.vehicle_type === 'bike') return 1;
          return a.total_fare - b.total_fare;
      });

      res.status(200).json({ options, surge_multiplier: surgeMultiplier });
      return;
    } else {
      const { data: fareConfig, error: configError } = await supabase
        .from('fare_config')
        .select('*')
        .eq('vehicle_type', vehicle_type)
        .eq('is_active', true)
        .single();

      if (configError || !fareConfig) {
        res.status(400).json({ error: 'Invalid vehicle type or fare config not found' });
        return;
      }

      const response = calculateForConfig(fareConfig);
      res.status(200).json(response);
      return;
    }
  } catch (error) {
    console.error('Error calculating fare:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
