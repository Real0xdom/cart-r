import { supabase } from './supabase';

export interface RatingData {
  booking_id: string;
  rating: number;
  review?: string;
  rated_by: string; // user_id of rater
  rated_user: string; // user_id of person being rated
  rater_type: 'customer' | 'driver';
}

/**
 * Submit a rating for a completed booking
 */
export async function submitRating(data: RatingData): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const { error } = await supabase.from('ratings').insert({
      booking_id: data.booking_id,
      rating: data.rating,
      review: data.review || null,
      rated_by: data.rated_by,
      rated_user: data.rated_user,
      rater_type: data.rater_type,
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error('[RATING] Error submitting:', error);
      return { success: false, error: error.message };
    }

    console.log('[RATING] Submitted successfully');
    return { success: true };
  } catch (err: any) {
    console.error('[RATING] Exception:', err);
    return { success: false, error: err.message || 'Failed to submit rating' };
  }
}

/**
 * Check if user has already rated for a booking
 */
export async function hasUserRated(
  bookingId: string,
  userId: string
): Promise<{ rated: boolean; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('ratings')
      .select('id')
      .eq('booking_id', bookingId)
      .eq('rated_by', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 is "no rows returned" which is expected if not rated
      console.error('[RATING] Error checking:', error);
      return { rated: false, error: error.message };
    }

    return { rated: !!data };
  } catch (err: any) {
    console.error('[RATING] Exception:', err);
    return { rated: false, error: err.message };
  }
}

/**
 * Get ratings for a booking (both customer and driver ratings)
 */
export async function getBookingRatings(bookingId: string): Promise<{
  customerRating: any | null;
  driverRating: any | null;
  error?: string;
}> {
  try {
    const { data, error } = await supabase
      .from('ratings')
      .select('*')
      .eq('booking_id', bookingId);

    if (error) {
      console.error('[RATING] Error fetching:', error);
      return { customerRating: null, driverRating: null, error: error.message };
    }

    const customerRating = data?.find(r => r.rater_type === 'customer') || null;
    const driverRating = data?.find(r => r.rater_type === 'driver') || null;

    return { customerRating, driverRating };
  } catch (err: any) {
    console.error('[RATING] Exception:', err);
    return { customerRating: null, driverRating: null, error: err.message };
  }
}

/**
 * Get user's rating history
 */
export async function getUserRatings(
  userId: string,
  type: 'received' | 'given'
): Promise<{ data: any[] | null; error?: string }> {
  try {
    let query = supabase
      .from('ratings')
      .select('*, booking:bookings!ratings_booking_id_fkey(*)')
      .order('created_at', { ascending: false });

    if (type === 'received') {
      query = query.eq('rated_user', userId);
    } else {
      query = query.eq('rated_by', userId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[RATING] Error fetching history:', error);
      return { data: null, error: error.message };
    }

    return { data };
  } catch (err: any) {
    console.error('[RATING] Exception:', err);
    return { data: null, error: err.message };
  }
}

/**
 * Calculate average rating for a user
 */
export async function getUserAverageRating(userId: string): Promise<{
  average: number;
  count: number;
  error?: string;
}> {
  try {
    const { data, error } = await supabase
      .from('ratings')
      .select('rating')
      .eq('rated_user', userId);

    if (error) {
      console.error('[RATING] Error calculating average:', error);
      return { average: 0, count: 0, error: error.message };
    }

    if (!data || data.length === 0) {
      return { average: 0, count: 0 };
    }

    const sum = data.reduce((acc, curr) => acc + curr.rating, 0);
    const average = sum / data.length;

    return { average: Math.round(average * 10) / 10, count: data.length };
  } catch (err: any) {
    console.error('[RATING] Exception:', err);
    return { average: 0, count: 0, error: err.message };
  }
}
