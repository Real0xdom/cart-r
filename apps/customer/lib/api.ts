// API helper functions for Supabase Edge Functions
import { supabase } from './supabase';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';

interface FareCalculation {
  base_fare: number;
  distance_fare: number;
  time_fare: number;
  distance_km: number;
  duration_minutes: number;
  surge_multiplier: number;
  total_fare: number;
}

interface PaymentOrder {
  order_id: string;
  payment_session_id: string;
  order_status: string;
}

interface AssignDriverResult {
  assigned: boolean;
  driver?: {
    id: string;
    name: string;
    phone: string;
    avatar_url: string | null;
    vehicle_number: string;
    vehicle_model: string;
    rating: number;
    distance_km: number;
  };
  error?: string;
}

/**
 * Calculate fare for a trip using the Edge Function
 */
export async function calculateFareFromAPI(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number,
  vehicleType: 'bike' | 'auto' | 'mini' | 'sedan' | 'suv' | 'truck'
): Promise<{ data: FareCalculation | null; error: string | null }> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;

    const response = await fetch(`${SUPABASE_URL}/functions/v1/calculate-fare`, {
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
        vehicle_type: vehicleType,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { data: null, error: data.error || 'Failed to calculate fare' };
    }

    return { data, error: null };
  } catch (err: any) {
    console.error('Calculate fare error:', err);
    return { data: null, error: err.message || 'Network error' };
  }
}

/**
 * Create a payment order via Cashfree
 */
export async function createPaymentOrder(
  bookingId: string,
  customerId: string,
  customerName: string,
  customerEmail: string,
  customerPhone: string,
  amount: number
): Promise<{ data: PaymentOrder | null; error: string | null }> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;

    const response = await fetch(`${SUPABASE_URL}/functions/v1/create-payment-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        booking_id: bookingId,
        customer_id: customerId,
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone,
        amount,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { data: null, error: data.error || 'Failed to create payment order' };
    }

    return { data, error: null };
  } catch (err: any) {
    console.error('Create payment order error:', err);
    return { data: null, error: err.message || 'Network error' };
  }
}

/**
 * Request driver assignment for a booking
 */
export async function requestDriverAssignment(
  bookingId: string,
  maxRadiusKm: number = 10
): Promise<AssignDriverResult> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;

    const response = await fetch(`${SUPABASE_URL}/functions/v1/assign-driver`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        booking_id: bookingId,
        max_radius_km: maxRadiusKm,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { assigned: false, error: data.error || 'Failed to assign driver' };
    }

    return data;
  } catch (err: any) {
    console.error('Assign driver error:', err);
    return { assigned: false, error: err.message || 'Network error' };
  }
}

/**
 * Register Expo push token for notifications
 */
export async function registerPushToken(expoPushToken: string): Promise<{ success: boolean; error: string | null }> {
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

/**
 * Get user's notifications
 */
export async function getNotifications(limit: number = 20): Promise<{ data: any[]; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
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
 * Mark notification as read
 */
export async function markNotificationRead(notificationId: string): Promise<{ success: boolean; error: string | null }> {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
