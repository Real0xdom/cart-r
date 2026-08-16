// Wallet Payment Library
// Handles all wallet payment operations with race condition protection

import { supabase } from './supabase';

// =====================================================
// TYPES
// =====================================================
export interface WalletPaymentResult {
  success: boolean;
  error?: string;
  wallet_deducted?: number;
  remaining_to_pay?: number;
  new_wallet_balance?: number;
  fully_paid?: boolean;
  booking_status?: string;
  shortfall?: number;
  required?: number;
  available?: number;
}

export interface PartialPaymentResult {
  success: boolean;
  error?: string;
  wallet_amount?: number;
  online_amount?: number;
  total_amount?: number;
}

// =====================================================
// WALLET PAYMENT - FULL OR PARTIAL
// =====================================================
/**
 * Pay for booking using wallet
 * @param bookingId - Booking ID to pay for
 * @param userId - Customer user ID
 * @param useFullWallet - true = pay all from wallet, false = use wallet + online for remaining
 * @param paymentSessionId - Optional Cashfree session ID for partial payments
 * @returns Payment result with wallet deduction details
 */
export async function payWithWallet(
  bookingId: string,
  userId: string,
  useFullWallet: boolean = true,
  paymentSessionId?: string
): Promise<WalletPaymentResult> {
  try {
    console.log('[WALLET PAY] Starting payment...', {
      bookingId,
      userId,
      useFullWallet,
      paymentSessionId
    });

    const { data, error } = await (supabase.rpc as any)('pay_with_wallet', {
      p_booking_id: bookingId,
      p_user_id: userId,
      p_use_full_wallet: useFullWallet,
      p_payment_session_id: paymentSessionId || null
    });

    if (error) {
      console.error('[WALLET PAY] RPC error:', error);
      return {
        success: false,
        error: error.message
      };
    }

    console.log('[WALLET PAY] Result:', data);
    return data as any;
  } catch (err: any) {
    console.error('[WALLET PAY] Exception:', err);
    return {
      success: false,
      error: err.message || 'Payment failed'
    };
  }
}

// =====================================================
// COMPLETE PARTIAL PAYMENT
// =====================================================
/**
 * Complete a partial payment after online payment succeeds
 * @param bookingId - Booking ID
 * @param paymentOrderId - Cashfree order ID
 * @param amountPaid - Amount paid online
 * @returns Completion result
 */
export async function completePartialPayment(
  bookingId: string,
  paymentOrderId: string,
  amountPaid: number
): Promise<PartialPaymentResult> {
  try {
    console.log('[COMPLETE PARTIAL] Finalizing payment...', {
      bookingId,
      paymentOrderId,
      amountPaid
    });

    const { data, error } = await (supabase.rpc as any)('complete_partial_payment', {
      p_booking_id: bookingId,
      p_payment_order_id: paymentOrderId,
      p_amount_paid: amountPaid
    });

    if (error) {
      console.error('[COMPLETE PARTIAL] RPC error:', error);
      return {
        success: false,
        error: error.message
      };
    }

    console.log('[COMPLETE PARTIAL] Success:', data);
    return data as any;
  } catch (err: any) {
    console.error('[COMPLETE PARTIAL] Exception:', err);
    return {
      success: false,
      error: err.message || 'Failed to complete payment'
    };
  }
}

// =====================================================
// GET WALLET BALANCE
// =====================================================
/**
 * Fetch current wallet balance for user
 * @param userId - User ID
 * @returns Current balance or 0
 */
export async function getWalletBalance(userId: string): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('balance')
      .eq('id', userId)
      .single();

    if (error || !data) {
      console.error('[WALLET BALANCE] Error:', error);
      throw error || new Error('Wallet balance not found');
    }

    return data.balance || 0;
  } catch (err) {
    console.error('[WALLET BALANCE] Exception:', err);
    throw err;
  }
}

// =====================================================
// ROLLBACK PARTIAL PAYMENT
// =====================================================
/**
 * Rollback a partial wallet payment if online payment fails
 * @param bookingId - Booking ID to rollback
 * @returns Result of the rollback operation
 */
export async function rollbackPartialPayment(
  bookingId: string
): Promise<{ success: boolean; error?: string; restored_amount?: number }> {
  try {
    console.log('[WALLET ROLLBACK] Rolling back partial payment...', { bookingId });

    const { data, error } = await (supabase.rpc as any)('rollback_partial_wallet_payment', {
      p_booking_id: bookingId
    });

    if (error) {
      console.error('[WALLET ROLLBACK] RPC error:', error);
      return { success: false, error: error.message };
    }

    console.log('[WALLET ROLLBACK] Result:', data);
    return data as any;
  } catch (err: any) {
    console.error('[WALLET ROLLBACK] Exception:', err);
    return { success: false, error: err.message || 'Rollback failed' };
  }
}

// =====================================================
// CALCULATE PAYMENT SPLIT
// =====================================================
/**
 * Calculate how much to pay from wallet vs online
 * @param walletBalance - Current wallet balance
 * @param totalAmount - Total trip amount
 * @returns Payment split details
 */
export function calculatePaymentSplit(
  walletBalance: number,
  totalAmount: number
): {
  canPayFull: boolean;
  walletAmount: number;
  onlineAmount: number;
  needsOnlinePayment: boolean;
} {
  const canPayFull = walletBalance >= totalAmount;
  
  if (canPayFull) {
    return {
      canPayFull: true,
      walletAmount: totalAmount,
      onlineAmount: 0,
      needsOnlinePayment: false
    };
  }
  
  return {
    canPayFull: false,
    walletAmount: walletBalance,
    onlineAmount: totalAmount - walletBalance,
    needsOnlinePayment: true
  };
}

// =====================================================
// SUBSCRIBE TO WALLET BALANCE CHANGES
// =====================================================
/**
 * Subscribe to real-time wallet balance updates
 * @param userId - User ID to monitor
 * @param callback - Function to call when balance changes
 * @returns Unsubscribe function
 */
export function subscribeToWalletBalance(
  userId: string,
  callback: (balance: number) => void
): () => void {
  const channel = supabase
    .channel(`wallet-${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'users',
        filter: `id=eq.${userId}`
      },
      (payload) => {
        console.log('[WALLET SUBSCRIBE] Balance updated:', payload.new.balance);
        callback(payload.new.balance || 0);
      }
    )
    .subscribe();

  return () => {
    console.log('[WALLET SUBSCRIBE] Unsubscribing');
    supabase.removeChannel(channel);
  };
}
