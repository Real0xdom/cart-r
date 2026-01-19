"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateFareFromAPI = calculateFareFromAPI;
exports.createPaymentOrder = createPaymentOrder;
exports.requestDriverAssignment = requestDriverAssignment;
exports.registerPushToken = registerPushToken;
exports.getNotifications = getNotifications;
exports.markNotificationRead = markNotificationRead;
// API helper functions for Supabase Edge Functions
const supabase_1 = require("./supabase");
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
/**
 * Calculate fare for a trip using the Edge Function
 */
async function calculateFareFromAPI(originLat, originLng, destLat, destLng, vehicleType) {
    var _a;
    try {
        const { data: sessionData } = await supabase_1.supabase.auth.getSession();
        const token = (_a = sessionData === null || sessionData === void 0 ? void 0 : sessionData.session) === null || _a === void 0 ? void 0 : _a.access_token;
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
    }
    catch (err) {
        console.error('Calculate fare error:', err);
        return { data: null, error: err.message || 'Network error' };
    }
}
/**
 * Create a payment order via Cashfree
 */
async function createPaymentOrder(bookingId, customerId, customerName, customerEmail, customerPhone, amount) {
    var _a;
    try {
        const { data: sessionData } = await supabase_1.supabase.auth.getSession();
        const token = (_a = sessionData === null || sessionData === void 0 ? void 0 : sessionData.session) === null || _a === void 0 ? void 0 : _a.access_token;
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
    }
    catch (err) {
        console.error('Create payment order error:', err);
        return { data: null, error: err.message || 'Network error' };
    }
}
/**
 * Request driver assignment for a booking
 */
async function requestDriverAssignment(bookingId, maxRadiusKm = 10) {
    var _a;
    try {
        const { data: sessionData } = await supabase_1.supabase.auth.getSession();
        const token = (_a = sessionData === null || sessionData === void 0 ? void 0 : sessionData.session) === null || _a === void 0 ? void 0 : _a.access_token;
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
    }
    catch (err) {
        console.error('Assign driver error:', err);
        return { assigned: false, error: err.message || 'Network error' };
    }
}
/**
 * Register Expo push token for notifications
 */
async function registerPushToken(expoPushToken) {
    try {
        const { data: { user } } = await supabase_1.supabase.auth.getUser();
        if (!user) {
            return { success: false, error: 'User not authenticated' };
        }
        const { error } = await supabase_1.supabase
            .from('users')
            .update({ expo_push_token: expoPushToken })
            .eq('id', user.id);
        if (error) {
            return { success: false, error: error.message };
        }
        return { success: true, error: null };
    }
    catch (err) {
        console.error('Register push token error:', err);
        return { success: false, error: err.message };
    }
}
/**
 * Get user's notifications
 */
async function getNotifications(limit = 20) {
    try {
        const { data, error } = await supabase_1.supabase
            .from('notifications')
            .select('*')
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
 * Mark notification as read
 */
async function markNotificationRead(notificationId) {
    try {
        const { error } = await supabase_1.supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('id', notificationId);
        if (error) {
            return { success: false, error: error.message };
        }
        return { success: true, error: null };
    }
    catch (err) {
        return { success: false, error: err.message };
    }
}
