import { supabase } from './supabase';

// =====================================================
// BOOKING API HELPERS
// =====================================================

export interface CreateBookingParams {
  customerId: string;
  originAddress: string;
  originLatitude: number;
  originLongitude: number;
  destinationAddress: string;
  destinationLatitude: number;
  destinationLongitude: number;
  vehicleType: 'bike' | 'tempo' | 'sedan' | 'truck';
  estimatedDistance?: number;
  estimatedDuration?: number;
  scheduledAt?: string;
}

export interface Booking {
  id: string;
  booking_number: string;
  customer_id: string;
  driver_id: string | null;
  origin_address: string;
  origin_latitude: number;
  origin_longitude: number;
  destination_address: string;
  destination_latitude: number;
  destination_longitude: number;
  vehicle_type: string;
  estimated_distance: number | null;
  estimated_duration: number | null;
  total_fare: number;
  payment_status: 'pending' | 'paid' | 'refunded';
  payment_method: 'cash' | 'online';
  status: 'pending' | 'accepted' | 'driver_arrived' | 'in_progress' | 'completed' | 'cancelled' | 'scheduled';
  pickup_otp: string | null;
  scheduled_at?: string;
  created_at: string;
  driver?: {
    id: string;
    vehicle_number: string;
    vehicle_model: string;
    rating: number;
    user: {
      name: string;
      phone: string;
      avatar_url: string | null;
    };
  };
}

// Fare configuration — fetched from database `fare_config` table at runtime
// Fallback values used only if DB fetch fails (should match DB defaults)
// Note: Only includes vehicles that should be active by default
const FARE_CONFIG_FALLBACK: Record<string, { baseFare: number; perKmRate: number; perMinRate: number; minimumFare: number; cancellationFee: number; driverSearchRadiusKm: number }> = {
  bike: { baseFare: 25, perKmRate: 8, perMinRate: 1, minimumFare: 30, cancellationFee: 20, driverSearchRadiusKm: 20 },
  tempo: { baseFare: 40, perKmRate: 15, perMinRate: 2, minimumFare: 60, cancellationFee: 20, driverSearchRadiusKm: 20 },
  sedan: { baseFare: 60, perKmRate: 18, perMinRate: 2.5, minimumFare: 90, cancellationFee: 20, driverSearchRadiusKm: 20 },
  truck: { baseFare: 120, perKmRate: 25, perMinRate: 3.5, minimumFare: 180, cancellationFee: 20, driverSearchRadiusKm: 20 },
};

// Cache for DB fare config (refreshed every 5 minutes)
let fareConfigCache: Record<string, { baseFare: number; perKmRate: number; perMinRate: number; minimumFare: number; cancellationFee: number; driverSearchRadiusKm: number }> | null = null;
let fareConfigCacheExpiry = 0;

async function getFareConfig(): Promise<typeof FARE_CONFIG_FALLBACK> {
  const now = Date.now();
  if (fareConfigCache && now < fareConfigCacheExpiry) {
    return fareConfigCache;
  }
  
  try {
    const { data, error } = await supabase
      .from('fare_config')
      .select('vehicle_type, base_fare, per_km_rate, per_minute_rate, minimum_fare, cancellation_fee, driver_search_radius_km')
      .eq('is_active', true);
    
    if (!error && data && data.length > 0) {
      fareConfigCache = {};
      for (const row of data) {
        fareConfigCache[row.vehicle_type] = {
          baseFare: Number(row.base_fare),
          perKmRate: Number(row.per_km_rate),
          perMinRate: Number(row.per_minute_rate),
          minimumFare: Number(row.minimum_fare),
          cancellationFee: Number(row.cancellation_fee ?? 20),
          driverSearchRadiusKm: Number(row.driver_search_radius_km ?? 20),
        };
      }
      fareConfigCacheExpiry = now + 5 * 60 * 1000;
      return fareConfigCache;
    }
  } catch (err) {
    console.error('Failed to fetch fare config from DB, using fallback:', err);
  }
  
  return FARE_CONFIG_FALLBACK;
}

/**
 * Calculate fare based on distance, duration, and vehicle type
 */
export async function calculateFare(
  distanceKm: number,
  durationMinutes: number,
  vehicleType: string
): Promise<number> {
  const fareConfig = await getFareConfig();
  const config = fareConfig[vehicleType] || FARE_CONFIG_FALLBACK[vehicleType];
  if (!config) return 0;
  
  const distanceFare = distanceKm * config.perKmRate;
  const timeFare = durationMinutes * config.perMinRate;
  const totalFare = config.baseFare + distanceFare + timeFare;
  
  return Math.max(Math.round(totalFare), config.minimumFare);
}

/**
 * Generate a unique booking number
 */
function generateBookingNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `CARTR-${timestamp}-${random}`;
}

/**
 * Generate a 4-digit OTP for pickup verification
 */
function generateOTP(): string {
  // Use crypto.getRandomValues if available (web/browser), fallback to Math.random for React Native
  let randomValue: number;
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    randomValue = array[0];
  } else {
    // Fallback for React Native (crypto not available)
    randomValue = Math.floor(Math.random() * 9000);
  }
  return (1000 + (randomValue % 9000)).toString();
}

/**
 * Create a new booking
 */
export async function createBooking(params: CreateBookingParams & { idempotencyKey?: string }): Promise<{ data: Booking | null; error: string | null }> {
  try {
    const { customerId, vehicleType, estimatedDistance = 0, estimatedDuration = 0, idempotencyKey, scheduledAt } = params;
    
    // Calculate fare from DB config
    const totalFare = await calculateFare(estimatedDistance, estimatedDuration, vehicleType);
    
    // Get fare breakdown for insert
    const fareConfig = await getFareConfig();
    const config = fareConfig[vehicleType] || FARE_CONFIG_FALLBACK[vehicleType];
    
    // Note: booking_number is auto-generated by database trigger
    const { data, error } = await supabase
      .from('bookings')
      .insert({
        customer_id: customerId,
        origin_address: params.originAddress,
        origin_latitude: params.originLatitude,
        origin_longitude: params.originLongitude,
        destination_address: params.destinationAddress,
        destination_latitude: params.destinationLatitude,
        destination_longitude: params.destinationLongitude,
        vehicle_type: vehicleType,
        estimated_distance: estimatedDistance,
        estimated_duration: estimatedDuration,
        total_fare: totalFare,
        base_fare: config?.baseFare || 0,
        distance_fare: estimatedDistance * (config?.perKmRate || 0),
        time_fare: estimatedDuration * (config?.perMinRate || 0),
        pickup_otp: generateOTP(),
        status: (scheduledAt ? 'scheduled' : 'pending') as any,
        payment_status: 'pending',
        payment_method: 'cash',
        scheduled_at: scheduledAt || null,
        idempotency_key: idempotencyKey,
      } as Partial<Database['public']['Tables']['bookings']['Insert']>)
      .select()
      .single();
    
    if (error) {
      // Handle Idempotency: If key exists, return the existing booking
      if (error.code === '23505' && idempotencyKey) { // 23505 is unique_violation
        console.log('Idempotency hit! Fetching existing booking for key:', idempotencyKey);
        const { data: existingBooking, error: fetchError } = await supabase
            .from('bookings')
            .select('*')
            .eq('idempotency_key', idempotencyKey)
            .single();
            
        if (existingBooking) {
            return { data: existingBooking as Booking, error: null };
        }
      }

      console.error('Error creating booking:', error);
      return { data: null, error: error.message };
    }
    
    return { data: data as Booking, error: null };
  } catch (err: any) {
    console.error('Booking creation failed:', err);
    return { data: null, error: err.message || 'Failed to create booking' };
  }
}

/**
 * Fetch customer's bookings
 */
export async function getCustomerBookings(customerId: string): Promise<{ data: Booking[]; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('bookings')
      .select(`
        *,
        driver:drivers(
          id,
          vehicle_number,
          vehicle_model,
          rating,
          user:users(name, phone, avatar_url)
        )
      `)
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });
    
    if (error) {
      return { data: [], error: error.message };
    }
    
    return { data: data as Booking[], error: null };
  } catch (err: any) {
    return { data: [], error: err.message };
  }
}

/**
 * Get a single booking by ID
 */
export async function getBookingById(bookingId: string): Promise<{ data: Booking | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('bookings')
      .select(`
        *,
        driver:drivers(
          id,
          vehicle_number,
          vehicle_model,
          rating,
          user:users(name, phone, avatar_url)
        )
      `)
      .eq('id', bookingId)
      .single();
    
    if (error) {
      return { data: null, error: error.message };
    }
    
    return { data: data as Booking, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

/**
 * Update booking status
 */
export async function updateBookingStatus(
  bookingId: string,
  status: Booking['status'],
  additionalData?: Record<string, any>
): Promise<{ success: boolean; error: string | null }> {
  try {
    const updateData: Record<string, any> = { status, updated_at: new Date().toISOString() };
    
    // Add timestamps based on status
    if (status === 'accepted') updateData.accepted_at = new Date().toISOString();
    if (status === 'driver_arrived') updateData.driver_arrived_at = new Date().toISOString();
    if (status === 'in_progress') updateData.started_at = new Date().toISOString();
    if (status === 'completed') updateData.completed_at = new Date().toISOString();
    if (status === 'cancelled') updateData.cancelled_at = new Date().toISOString();
    
    if (additionalData) {
      Object.assign(updateData, additionalData);
    }
    
    const { error } = await supabase
      .from('bookings')
      .update(updateData)
      .eq('id', bookingId);
    
    if (error) {
      return { success: false, error: error.message };
    }
    
    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Subscribe to booking updates (real-time)
 */
export function subscribeToBooking(
  bookingId: string,
  onUpdate: (booking: Booking) => void
) {
  const subscription = supabase
    .channel(`booking-${bookingId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'bookings',
        filter: `id=eq.${bookingId}`,
      },
      (payload) => {
        onUpdate(payload.new as Booking);
      }
    )
    .subscribe();
  
  return () => {
    subscription.unsubscribe();
  };
}

/**
 * Get available bookings for drivers (pending bookings nearby)
 */
export async function getAvailableBookings(
  driverLatitude: number,
  driverLongitude: number,
  radiusKm: number = 10
): Promise<{ data: Booking[]; error: string | null }> {
  try {
    // For now, fetch all pending bookings
    // TODO: Implement PostGIS distance filtering
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('status', 'pending')
      .is('driver_id', null)
      .order('created_at', { ascending: false })
      .limit(20);
    
    if (error) {
      return { data: [], error: error.message };
    }
    
    // Client-side distance filtering (temporary solution)
    const filtered = (data || []).filter((booking: any) => {
      const distance = calculateDistance(
        driverLatitude,
        driverLongitude,
        booking.origin_latitude,
        booking.origin_longitude
      );
      return distance <= radiusKm;
    });
    
    return { data: filtered as Booking[], error: null };
  } catch (err: any) {
    return { data: [], error: err.message };
  }
}

/**
 * Accept a booking (for drivers)
 */
export async function acceptBooking(
  bookingId: string,
  driverId: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    const { error } = await supabase
      .from('bookings')
      .update({
        driver_id: driverId,
        status: 'accepted',
        accepted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', bookingId)
      .eq('status', 'pending'); // Only accept if still pending
    
    if (error) {
      return { success: false, error: error.message };
    }
    
    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Subscribe to available bookings for drivers (real-time)
 */
export function subscribeToAvailableBookings(
  onInsert: (booking: Booking) => void,
  onDelete: (bookingId: string) => void
) {
  const subscription = supabase
    .channel('available-bookings')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'bookings',
      },
      (payload) => {
        if (payload.new.status === 'pending' && !payload.new.driver_id) {
          onInsert(payload.new as Booking);
        }
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'bookings',
      },
      (payload) => {
        // If booking was accepted or cancelled, remove from available list
        if (payload.new.status !== 'pending' || payload.new.driver_id) {
          onDelete(payload.new.id as string);
        }
      }
    )
    .subscribe();
  
  return () => {
    subscription.unsubscribe();
  };
}

// Helper: Calculate distance between two coordinates (Haversine formula)
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
