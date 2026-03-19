// API helper functions for Driver App
import { supabase } from './supabase';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';

/**
 * Update driver's online/offline status
 */
export async function updateDriverStatus(isOnline: boolean): Promise<{ success: boolean; error: string | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    const { error } = await supabase
      .from('drivers')
      .update({ 
        is_online: isOnline,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, error: null };
  } catch (err: any) {
    console.error('Update driver status error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Update driver's current location
 */
export async function updateDriverLocation(
  latitude: number,
  longitude: number,
  heading?: number,
  speed?: number
): Promise<{ success: boolean; error: string | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    // Get driver record
    const { data: driver, error: driverError } = await supabase
      .from('drivers')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (driverError || !driver) {
      return { success: false, error: 'Driver profile not found' };
    }

    // Update current location in drivers table
    const { error: updateError } = await supabase
      .from('drivers')
      .update({
        current_latitude: latitude,
        current_longitude: longitude,
        last_location_update: new Date().toISOString(),
      })
      .eq('id', driver.id);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    // Also insert into location history (for tracking during active trips)
    await supabase.from('driver_locations').insert({
      driver_id: driver.id,
      latitude,
      longitude,
      heading,
      speed,
    });

    return { success: true, error: null };
  } catch (err: any) {
    console.error('Update driver location error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Get driver's current profile and stats
 */
export async function getDriverProfile(): Promise<{ data: any | null; error: string | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { data: null, error: 'User not authenticated' };
    }

    const { data, error } = await supabase
      .from('drivers')
      .select(`
        *,
        user:users(name, email, phone, avatar_url)
      `)
      .eq('user_id', user.id)
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
 * Accept a booking request
 */
export async function acceptBooking(bookingId: string): Promise<{ success: boolean; error: string | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    // Get driver ID
    const { data: driver, error: driverError } = await supabase
      .from('drivers')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (driverError || !driver) {
      return { success: false, error: 'Driver profile not found' };
    }

    // Accept the booking
    const { error } = await supabase
      .from('bookings')
      .update({
        driver_id: driver.id,
        status: 'accepted',
        accepted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', bookingId)
      .eq('status', 'pending'); // Only if still pending

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, error: null };
  } catch (err: any) {
    console.error('Accept booking error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Update booking status (driver arrived, started, completed)
 */
export async function updateBookingStatus(
  bookingId: string,
  status: 'driver_arrived' | 'in_progress' | 'completed',
  additionalData?: Record<string, any>
): Promise<{ success: boolean; error: string | null }> {
  try {
    const updateData: Record<string, any> = {
      status,
      updated_at: new Date().toISOString(),
    };

    // Add status-specific timestamps
    if (status === 'driver_arrived') {
      updateData.driver_arrived_at = new Date().toISOString();
    } else if (status === 'in_progress') {
      updateData.started_at = new Date().toISOString();
    } else if (status === 'completed') {
      updateData.completed_at = new Date().toISOString();
    }

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
    console.error('Update booking status error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Get driver's active booking
 */
export async function getActiveBooking(): Promise<{ data: any | null; error: string | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { data: null, error: 'User not authenticated' };
    }

    const { data: driver } = await supabase
      .from('drivers')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!driver) {
      return { data: null, error: 'Driver profile not found' };
    }

    const { data, error } = await supabase
      .from('bookings')
      .select(`
        *,
        customer:users!bookings_customer_id_fkey(name, phone, avatar_url)
      `)
      .eq('driver_id', driver.id)
      .in('status', ['accepted', 'driver_arrived', 'in_progress'])
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
 * Get driver's booking history
 */
export async function getDriverBookings(limit: number = 20): Promise<{ data: any[]; error: string | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { data: [], error: 'User not authenticated' };
    }

    const { data: driver } = await supabase
      .from('drivers')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!driver) {
      return { data: [], error: 'Driver profile not found' };
    }

    const { data, error } = await supabase
      .from('bookings')
      .select(`
        *,
        customer:users!bookings_customer_id_fkey(name, phone, avatar_url)
      `)
      .eq('driver_id', driver.id)
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
 * Get pending ride requests for driver
 */
export async function getPendingRideRequests(): Promise<{ data: any[]; error: string | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { data: [], error: 'User not authenticated' };
    }

    const { data: driver } = await supabase
      .from('drivers')
      .select('id, vehicle_type, current_latitude, current_longitude')
      .eq('user_id', user.id)
      .single();

    if (!driver || !driver.current_latitude || !driver.current_longitude) {
      return { data: [], error: 'Driver location not available' };
    }

    // Get pending bookings matching driver's vehicle type
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('status', 'pending')
      .eq('vehicle_type', driver.vehicle_type)
      .is('driver_id', null)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      return { data: [], error: error.message };
    }

    return { data: data || [], error: null };
  } catch (err: any) {
    return { data: [], error: err.message };
  }
}

/**
 * Register Expo push token for driver notifications
 */
export async function registerDriverPushToken(expoPushToken: string): Promise<{ success: boolean; error: string | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    const { error } = await supabase
      .from('users')
      .update({ expo_push_token: expoPushToken })
      .eq('id', user.id);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, error: null };
  } catch (err: any) {
    console.error('Register push token error:', err);
    return { success: false, error: err.message };
  }
}
