// Cashfree Payment Integration for CARTR Customer App
import { supabase } from './supabase';
import { Alert, Linking, Platform } from 'react-native';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';

export interface PaymentOrder {
  order_id: string;
  payment_session_id: string;
  order_status: string;
  cf_order_id?: string;
  environment?: 'sandbox' | 'production';
}

export interface PaymentResult {
  success: boolean;
  order_id?: string;
  payment_id?: string;
  error?: string;
}

/**
 * Create a payment order via Cashfree
 * Call this when user confirms booking and is ready to pay
 */
export async function createPaymentOrder(
  bookingId: string,
  customerId: string,
  customerName: string,
  customerEmail: string,
  customerPhone: string,
  amount: number,
  idempotencyKey?: string
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
        idempotency_key: idempotencyKey,
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
 * Initiate Cashfree checkout
 * Opens Cashfree payment page in browser or native SDK
 */
export async function initiateCashfreePayment(
  paymentSessionId: string,
  orderId: string
): Promise<PaymentResult> {
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
    const canOpen = await Linking.canOpenURL(checkoutUrl);
    if (canOpen) {
      await Linking.openURL(checkoutUrl);
      
      // The actual payment result will come via deep linking or webhook
      // For now, return pending status
      return {
        success: true,
        order_id: orderId,
      };
    } else {
      return {
        success: false,
        error: 'Cannot open payment page',
      };
    }
  } catch (err: any) {
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
export async function checkPaymentStatus(
  bookingId: string
): Promise<{ status: string; paid: boolean; error: string | null }> {
  try {
    const { data, error } = await supabase
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
  } catch (err: any) {
    return { status: 'unknown', paid: false, error: err.message };
  }
}

/**
 * Subscribe to payment status changes
 */
export function subscribeToPaymentStatus(
  bookingId: string,
  onStatusChange: (status: string) => void
): () => void {
  const subscription = supabase
    .channel(`payment-${bookingId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'bookings',
        filter: `id=eq.${bookingId}`,
      },
      (payload: any) => {
        if (payload.new.payment_status) {
          onStatusChange(payload.new.payment_status);
        }
      }
    )
    .subscribe();

  return () => {
    subscription.unsubscribe();
  };
}

/**
 * Handle payment completion (called from deep link handler)
 */
export async function handlePaymentCallback(
  orderId: string,
  status: 'SUCCESS' | 'FAILED' | 'CANCELLED'
): Promise<PaymentResult> {
  try {
    // Get booking by order/payment ID
    const { data: booking } = await supabase
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
    } else {
      return {
        success: false,
        error: status === 'CANCELLED' ? 'Payment cancelled' : 'Payment failed',
      };
    }
  } catch (err: any) {
    return {
      success: false,
      error: err.message,
    };
  }
}

/**
 * Calculate total fare including any fees
 */
export function calculateTotalWithFees(
  baseFare: number,
  platformFee: number = 0,
  gst: number = 0
): { baseFare: number; platformFee: number; gst: number; total: number } {
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
