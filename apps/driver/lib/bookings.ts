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
  // New fields for tip and fare adjustments
  tip_amount?: number;
  fare_multiplier?: number;
  driver_payout?: number;
  // Receiver details
  receiver_name?: string;
  receiver_phone?: string;
  // OTP fields
  pickup_otp: string | null;
  delivery_otp?: string | null;
  // Payment and status
  payment_status: 'pending' | 'paid' | 'refunded';
  payment_method: 'cash' | 'online';
  status: 'pending' | 'accepted' | 'driver_arrived' | 'in_progress' | 'completed' | 'cancelled';
  // Timestamps
  created_at: string;
  accepted_at?: string;
  started_at?: string;
  completed_at?: string;
  cancelled_at?: string;
  expires_at?: string;
  delivery_confirmed_at?: string;
  // Driver info (populated via join)
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
  // Customer info (populated via join)
  customer?: {
    name: string;
    phone: string;
    avatar_url: string | null;
  };
}

// Fare configuration per vehicle type (in INR)
const FARE_CONFIG = {
  bike: { baseFare: 25, perKmRate: 8, perMinRate: 1, minimumFare: 30 },
  tempo: { baseFare: 40, perKmRate: 15, perMinRate: 2, minimumFare: 60 },
  sedan: { baseFare: 60, perKmRate: 18, perMinRate: 2.5, minimumFare: 90 },
  truck: { baseFare: 120, perKmRate: 25, perMinRate: 3.5, minimumFare: 180 },
};

/**
 * Calculate fare based on distance, duration, and vehicle type
 */
export function calculateFare(
  distanceKm: number,
  durationMinutes: number,
  vehicleType: keyof typeof FARE_CONFIG
): number {
  const config = FARE_CONFIG[vehicleType];
  const distanceFare = distanceKm * config.perKmRate;
  const timeFare = durationMinutes * config.perMinRate;
  const totalFare = config.baseFare + distanceFare + timeFare;
  
  return Math.max(Math.round(totalFare), config.minimumFare);
}

/**
 * Generate a unique booking number with nanosecond precision and randomness
 * Format: CARTR-{timestamp}-{nano}-{random} = ~30 characters
 */
function generateBookingNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  // Add sub-millisecond precision using performance.now()
  const nano = Math.floor((performance.now() % 1) * 1000000).toString(36).toUpperCase();
  // Add random component for extra uniqueness
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `CARTR-${timestamp}${nano}${random}`;
}

/**
 * Generate a 4-digit OTP for pickup verification
 */
function generateOTP(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

/**
 * Create a new booking
 */
export async function createBooking(params: CreateBookingParams): Promise<{ data: Booking | null; error: string | null }> {
  try {
    const { customerId, vehicleType, estimatedDistance = 0, estimatedDuration = 0 } = params;
    
    // Calculate fare
    const totalFare = calculateFare(estimatedDistance, estimatedDuration, vehicleType);
    
    const { data, error } = await supabase
      .from('bookings')
      .insert({
        booking_number: generateBookingNumber(),
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
        base_fare: FARE_CONFIG[vehicleType].baseFare,
        distance_fare: estimatedDistance * FARE_CONFIG[vehicleType].perKmRate,
        time_fare: estimatedDuration * FARE_CONFIG[vehicleType].perMinRate,
        pickup_otp: generateOTP(),
        status: 'pending',
        payment_status: 'pending',
        payment_method: 'cash',
      })
      .select()
      .single();
    
    if (error) {
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
 * Get available bookings for drivers (pending bookings nearby, not expired, matching vehicle type)
 */
export async function getAvailableBookings(
  driverLatitude: number,
  driverLongitude: number,
  driverVehicleType: string,
  radiusKm: number = 10
): Promise<{ data: Booking[]; error: string | null }> {
  try {
    console.log('[getAvailableBookings] Called with:', {
      driverLatitude,
      driverLongitude,
      driverVehicleType,
      radiusKm
    });
    
    // Fetch pending bookings matching driver's vehicle type
    // Only show bookings that match the driver's registered vehicle
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('status', 'pending')
      .eq('vehicle_type', driverVehicleType) // Filter by driver's vehicle type
      .is('driver_id', null)
      .is('cancelled_at', null)
      .order('created_at', { ascending: false })
      .limit(30);
    
    console.log('[getAvailableBookings] Database query result:', {
      count: data?.length || 0,
      error: error?.message || null
    });
    
    if (error) {
      console.error('[getAvailableBookings] Database error:', error);
      return { data: [], error: error.message };
    }
    
    console.log('[getAvailableBookings] Raw bookings from DB:', JSON.stringify(data, null, 2));
    
    const now = new Date();
    
    // Client-side filtering for distance and expiration
    const filtered = (data || []).filter((booking: any) => {
      // Filter out expired bookings
      if (booking.expires_at && new Date(booking.expires_at) < now) {
        console.log(`[getAvailableBookings] Filtered out expired booking: ${booking.id}`);
        return false;
      }
      
      // Filter by distance
      const distance = calculateDistance(
        driverLatitude,
        driverLongitude,
        booking.origin_latitude,
        booking.origin_longitude
      );
      
      console.log(`[getAvailableBookings] Booking ${booking.id}: distance = ${distance.toFixed(2)}km (limit: ${radiusKm}km)`);
      
      if (distance > radiusKm) {
        console.log(`[getAvailableBookings] Filtered out - too far: ${booking.id}`);
        return false;
      }
      
      return true;
    });
    
    console.log('[getAvailableBookings] After filtering:', {
      total: data?.length || 0,
      filtered: filtered.length
    });
    
    return { data: filtered as Booking[], error: null };
  } catch (err: any) {
    console.error('[getAvailableBookings] Exception:', err);
    return { data: [], error: err.message };
  }
}

/**
 * Accept a booking (for drivers) - uses atomic database function for race condition protection
 */
export async function acceptBooking(
  bookingId: string,
  driverId: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    // Use atomic database function for proper race condition handling
    const { data, error } = await supabase.rpc('accept_booking_atomic', {
      p_booking_id: bookingId,
      p_driver_id: driverId,
    });

    if (error) {
      console.error('RPC Error accepting booking:', error);
      return { success: false, error: error.message };
    }

    // Parse the result from the RPC function
    const result = data as { success: boolean; message: string };
    
    if (!result.success) {
      return { success: false, error: result.message };
    }

    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Subscribe to available bookings for drivers (real-time) - filtered by vehicle type
 */
export function subscribeToAvailableBookings(
  driverVehicleType: string,
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
        // Only show bookings matching driver's vehicle type
        if (payload.new.status === 'pending' && !payload.new.driver_id && payload.new.vehicle_type === driverVehicleType) {
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

// =====================================================
// DRIVER WORKFLOW FUNCTIONS
// =====================================================

/**
 * Mark driver as arrived at pickup location
 */
export async function markDriverArrived(
  bookingId: string
): Promise<{ success: boolean; error: string | null }> {
  return updateBookingStatus(bookingId, 'driver_arrived');
}

/**
 * Verify pickup OTP and start the trip
 */
export async function verifyPickupOTPAndStartTrip(
  bookingId: string,
  enteredOTP: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    // Fetch booking to verify OTP
    const { data: booking, error: fetchError } = await getBookingById(bookingId);
    
    if (fetchError || !booking) {
      return { success: false, error: fetchError || 'Booking not found' };
    }
    
    // Verify OTP
    if (booking.pickup_otp !== enteredOTP) {
      return { success: false, error: 'Invalid OTP' };
    }
    
    // Start the trip
    return updateBookingStatus(bookingId, 'in_progress');
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Complete trip with payment confirmation
 */
export async function completeTrip(
  bookingId: string,
  paymentMethod: 'cash' | 'online' = 'cash',
  deliveryOTPVerified: boolean = false
): Promise<{ success: boolean; error: string | null }> {
  try {
    const additionalData: Record<string, any> = {
      payment_status: 'paid',
      payment_method: paymentMethod,
      delivery_confirmed_at: new Date().toISOString(),
    };
    
    if (deliveryOTPVerified) {
      additionalData.delivery_otp_verified = true;
    }
    
    return updateBookingStatus(bookingId, 'completed', additionalData);
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Cancel booking by driver
 */
export async function cancelBookingByDriver(
  bookingId: string,
  reason: string
): Promise<{ success: boolean; error: string | null }> {
  return updateBookingStatus(bookingId, 'cancelled', {
    cancelled_by: 'driver',
    cancellation_reason: reason,
  });
}

/**
 * Get driver's active booking (if any)
 */
export async function getDriverActiveBooking(
  driverId: string
): Promise<{ data: Booking | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('bookings')
      .select(`
        *,
        customer:users!bookings_customer_id_fkey(name, phone, avatar_url)
      `)
      .eq('driver_id', driverId)
      .in('status', ['accepted', 'driver_arrived', 'in_progress'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (error) {
      return { data: null, error: error.message };
    }
    
    return { data: data as Booking | null, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

/**
 * Get driver's completed trips
 */
export async function getDriverCompletedTrips(
  driverId: string,
  limit: number = 20
): Promise<{ data: Booking[]; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('driver_id', driverId)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(limit);
    
    if (error) {
      return { data: [], error: error.message };
    }
    
    return { data: data as Booking[], error: null };
  } catch (err: any) {
    return { data: [], error: err.message };
  }
}

