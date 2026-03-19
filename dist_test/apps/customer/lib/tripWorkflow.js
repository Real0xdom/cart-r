"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createBooking = createBooking;
exports.getBooking = getBooking;
exports.subscribeToBooking = subscribeToBooking;
exports.cancelBooking = cancelBooking;
exports.getCustomerBookings = getCustomerBookings;
exports.getActiveBooking = getActiveBooking;
exports.rateTrip = rateTrip;
// Complete Trip Workflow Management
const supabase_1 = require("./supabase");
/**
 * Create a new booking
 */
async function createBooking(originAddress, originLat, originLng, destAddress, destLat, destLng, vehicleType, fare) {
    try {
        const { data: { user } } = await supabase_1.supabase.auth.getUser();
        if (!user) {
            return { data: null, error: 'User not authenticated' };
        }
        // Generate 4-digit OTP for pickup verification
        const otpCode = Math.floor(1000 + Math.random() * 9000).toString();
        const { data, error } = await supabase_1.supabase
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
    }
    catch (err) {
        return { data: null, error: err.message };
    }
}
/**
 * Get booking details with driver info
 */
async function getBooking(bookingId) {
    try {
        const { data, error } = await supabase_1.supabase
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
    }
    catch (err) {
        return { data: null, error: err.message };
    }
}
/**
 * Subscribe to booking status updates
 */
function subscribeToBooking(bookingId, onUpdate) {
    const subscription = supabase_1.supabase
        .channel(`booking-${bookingId}`)
        .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'bookings',
        filter: `id=eq.${bookingId}`,
    }, async (payload) => {
        // Fetch full booking with driver info
        const { data } = await getBooking(bookingId);
        if (data) {
            onUpdate(data);
        }
    })
        .subscribe();
    return () => {
        subscription.unsubscribe();
    };
}
/**
 * Cancel a booking (customer)
 */
async function cancelBooking(bookingId, reason) {
    try {
        const { error } = await supabase_1.supabase
            .from('bookings')
            .update({
            status: 'cancelled',
            cancellation_reason: reason,
            cancelled_at: new Date().toISOString(),
        })
            .eq('id', bookingId)
            .in('status', ['pending', 'accepted']); // Can only cancel before trip starts
        if (error) {
            return { success: false, error: error.message };
        }
        return { success: true, error: null };
    }
    catch (err) {
        return { success: false, error: err.message };
    }
}
/**
 * Get customer's bookings history
 */
async function getCustomerBookings(limit = 20) {
    try {
        const { data: { user } } = await supabase_1.supabase.auth.getUser();
        if (!user) {
            return { data: [], error: 'User not authenticated' };
        }
        const { data, error } = await supabase_1.supabase
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
    }
    catch (err) {
        return { data: [], error: err.message };
    }
}
/**
 * Get customer's active booking
 */
async function getActiveBooking() {
    try {
        const { data: { user } } = await supabase_1.supabase.auth.getUser();
        if (!user) {
            return { data: null, error: 'User not authenticated' };
        }
        const { data, error } = await supabase_1.supabase
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
    }
    catch (err) {
        return { data: null, error: err.message };
    }
}
/**
 * Rate a completed trip
 */
async function rateTrip(bookingId, rating, review) {
    try {
        // Update booking with rating
        const { error: bookingError } = await supabase_1.supabase
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
        const { data: booking } = await supabase_1.supabase
            .from('bookings')
            .select('driver_id')
            .eq('id', bookingId)
            .single();
        if (booking === null || booking === void 0 ? void 0 : booking.driver_id) {
            // Calculate new average rating for driver
            const { data: ratings } = await supabase_1.supabase
                .from('bookings')
                .select('customer_rating')
                .eq('driver_id', booking.driver_id)
                .not('customer_rating', 'is', null);
            if (ratings && ratings.length > 0) {
                const avgRating = ratings.reduce((sum, r) => sum + r.customer_rating, 0) / ratings.length;
                await supabase_1.supabase
                    .from('drivers')
                    .update({ rating: avgRating })
                    .eq('id', booking.driver_id);
            }
        }
        return { success: true, error: null };
    }
    catch (err) {
        return { success: false, error: err.message };
    }
}
