// Complete Trip Workflow Management
import { supabase } from './supabase';

export type BookingStatus = 
  | 'pending'        // Waiting for driver assignment
  | 'accepted'       // Driver accepted, en route to pickup
  | 'driver_arrived' // Driver at pickup location
  | 'otp_verified'   // Customer OTP verified, ready to start
  | 'in_progress'    // Trip is ongoing
  | 'completed'      // Trip completed
  | 'cancelled';     // Trip cancelled

export interface Booking {
  id: string;
  customer_id: string;
  driver_id: string | null;
  origin_address: string;
  origin_latitude: number;
  origin_longitude: number;
  destination_address: string;
  destination_latitude: number;
  destination_longitude: number;
  vehicle_type: string;
  fare: number;
  status: BookingStatus;
  payment_status: 'pending' | 'paid' | 'failed';
  otp_code: string;
  created_at: string;
  accepted_at: string | null;
  started_at: string | null;
  completed_at: string | null;
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

/**
 * Create a new booking
 */
export async function createBooking(
  originAddress: string,
  originLat: number,
  originLng: number,
  destAddress: string,
  destLat: number,
  destLng: number,
  vehicleType: string,
  fare: number
): Promise<{ data: Booking | null; error: string | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: 'User not authenticated' };
    }

    // Generate 4-digit OTP for pickup verification
    const otpArray = new Uint32Array(1);
    crypto.getRandomValues(otpArray);
    const otpCode = (1000 + (otpArray[0] % 9000)).toString();

    const { data, error } = await supabase
      .from('bookings')
      .insert({
        customer_id: user.id,
        origin_address: originAddress,
        origin_latitude: originLat,
        origin_longitude: originLng,
        destination_address: destAddress,
        destination_latitude: destLat,
        destination_longitude: destLng,
        vehicle_type: vehicleType,
        fare,
        status: 'pending',
        payment_status: 'pending',
        otp_code: otpCode,
      })
      .select()
      .single();

    if (error) {
      return { data: null, error: error.message };
    }

    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

/**
 * Get booking details with driver info
 */
export async function getBooking(bookingId: string): Promise<{ data: Booking | null; error: string | null }> {
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

    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

/**
 * Subscribe to booking status updates
 */
export function subscribeToBooking(
  bookingId: string,
  onUpdate: (booking: Booking) => void
): () => void {
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
      async (payload: any) => {
        // Fetch full booking with driver info
        const { data } = await getBooking(bookingId);
        if (data) {
          onUpdate(data);
        }
      }
    )
    .subscribe();

  return () => {
    subscription.unsubscribe();
  };
}

/**
 * Cancel a booking (customer)
 */
export async function cancelBooking(
  bookingId: string,
  reason?: string
): Promise<{ success: boolean; cancellationFee?: number; error: string | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    const { error } = await supabase
      .from('bookings')
      .update({
        status: 'cancelled',
        cancelled_by: user.id,
        cancellation_reason: reason,
        cancelled_at: new Date().toISOString(),
      })
      .eq('id', bookingId)
      .in('status', ['pending', 'accepted', 'driver_arrived', 'in_progress']); // Cancellation supported until trip is settled

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Get customer's bookings history
 */
export async function getCustomerBookings(
  limit: number = 20
): Promise<{ data: Booking[]; error: string | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: [], error: 'User not authenticated' };
    }

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
      .eq('customer_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      return { data: [], error: error.message };
    }

    return { data: data || [], error: null };
  } catch (err: any) {
    return { data: [], error: err.message };
  }
}

/**
 * Get customer's active booking
 */
export async function getActiveBooking(): Promise<{ data: Booking | null; error: string | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: 'User not authenticated' };
    }

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
      .eq('customer_id', user.id)
      .in('status', ['pending', 'accepted', 'driver_arrived', 'otp_verified', 'in_progress'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
      return { data: null, error: error.message };
    }

    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

/**
 * Rate a completed trip
 */
export async function rateTrip(
  bookingId: string,
  rating: number,
  review?: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    // Update booking with rating
    const { error: bookingError } = await supabase
      .from('bookings')
      .update({
        customer_rating: rating,
        customer_review: review,
      })
      .eq('id', bookingId);

    if (bookingError) {
      return { success: false, error: bookingError.message };
    }

    // Get driver ID and update their average rating
    const { data: booking } = await supabase
      .from('bookings')
      .select('driver_id')
      .eq('id', bookingId)
      .single();

    if (booking?.driver_id) {
      // Calculate new average rating for driver
      const { data: ratings } = await supabase
        .from('bookings')
        .select('customer_rating')
        .eq('driver_id', booking.driver_id)
        .not('customer_rating', 'is', null);

      if (ratings && ratings.length > 0) {
        const avgRating = ratings.reduce((sum: number, r: any) => sum + r.customer_rating, 0) / ratings.length;
        
        await supabase
          .from('drivers')
          .update({ rating: avgRating })
          .eq('id', booking.driver_id);
      }
    }

    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
