"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPaymentOrder = createPaymentOrder;
exports.initiateCashfreePayment = initiateCashfreePayment;
exports.checkPaymentStatus = checkPaymentStatus;
exports.subscribeToPaymentStatus = subscribeToPaymentStatus;
exports.handlePaymentCallback = handlePaymentCallback;
exports.calculateTotalWithFees = calculateTotalWithFees;
// Cashfree Payment Integration for CARTR Customer App
const supabase_1 = require("./supabase");
const react_native_1 = require("react-native");
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
/**
 * Create a payment order via Cashfree
 * Call this when user confirms booking and is ready to pay
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
 * Initiate Cashfree checkout
 * Opens Cashfree payment page in browser or native SDK
 */
async function initiateCashfreePayment(paymentSessionId, orderId) {
    try {
        // For React Native, we use Cashfree's web checkout via deep linking
        // The payment will redirect back to the app via the return URL
        const cashfreeEnv = process.env.CASHFREE_ENVIRONMENT || 'sandbox';
        const baseUrl = cashfreeEnv === 'production'
            ? 'https://api.cashfree.com/pg/orders/sessions'
            : 'https://sandbox.cashfree.com/pg/orders/sessions';
        // Construct checkout URL
        const checkoutUrl = `https://${cashfreeEnv === 'production' ? '' : 'sandbox.'}cashfree.com/pg/view/orders/${paymentSessionId}`;
        // Open in browser
        const canOpen = await react_native_1.Linking.canOpenURL(checkoutUrl);
        if (canOpen) {
            await react_native_1.Linking.openURL(checkoutUrl);
            // The actual payment result will come via deep linking or webhook
            // For now, return pending status
            return {
                success: true,
                order_id: orderId,
            };
        }
        else {
            return {
                success: false,
                error: 'Cannot open payment page',
            };
        }
    }
    catch (err) {
        console.error('Cashfree payment error:', err);
        return {
            success: false,
            error: err.message || 'Payment failed',
        };
    }
}
/**
 * Check payment status for a booking
 */
async function checkPaymentStatus(bookingId) {
    try {
        const { data, error } = await supabase_1.supabase
            .from('bookings')
            .select('payment_status, payment_id')
            .eq('id', bookingId)
            .single();
        if (error) {
            return { status: 'unknown', paid: false, error: error.message };
        }
        return {
            status: data.payment_status || 'pending',
            paid: data.payment_status === 'paid',
            error: null,
        };
    }
    catch (err) {
        return { status: 'unknown', paid: false, error: err.message };
    }
}
/**
 * Subscribe to payment status changes
 */
function subscribeToPaymentStatus(bookingId, onStatusChange) {
    const subscription = supabase_1.supabase
        .channel(`payment-${bookingId}`)
        .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'bookings',
        filter: `id=eq.${bookingId}`,
    }, (payload) => {
        if (payload.new.payment_status) {
            onStatusChange(payload.new.payment_status);
        }
    })
        .subscribe();
    return () => {
        subscription.unsubscribe();
    };
}
/**
 * Handle payment completion (called from deep link handler)
 */
async function handlePaymentCallback(orderId, status) {
    try {
        // Get booking by order/payment ID
        const { data: booking } = await supabase_1.supabase
            .from('bookings')
            .select('id, payment_status')
            .eq('payment_id', orderId)
            .single();
        if (!booking) {
            return {
                success: false,
                error: 'Booking not found',
            };
        }
        if (status === 'SUCCESS') {
            // Payment already handled by webhook, but update UI
            return {
                success: true,
                order_id: orderId,
            };
        }
        else {
            return {
                success: false,
                error: status === 'CANCELLED' ? 'Payment cancelled' : 'Payment failed',
            };
        }
    }
    catch (err) {
        return {
            success: false,
            error: err.message,
        };
    }
}
/**
 * Calculate total fare including any fees
 */
function calculateTotalWithFees(baseFare, platformFee = 0, gst = 0) {
    // Platform fee (if any)
    const fee = platformFee || 0;
    // GST on platform fee (18%)
    const gstAmount = gst || (fee * 0.18);
    // Total
    const total = baseFare + fee + gstAmount;
    return {
        baseFare,
        platformFee: fee,
        gst: gstAmount,
        total: Math.ceil(total),
    };
}
