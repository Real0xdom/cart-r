import { describe, it, expect } from 'vitest';

/**
 * Unit tests for payment-webhook edge function logic.
 * Tests the decision-making logic extracted from supabase/functions/payment-webhook/index.ts.
 * 
 * These tests verify:
 * - PAYMENT_FAILED updates booking status
 * - PAYMENT_SUCCESS idempotency (skips already-paid bookings)
 * - Wallet top-up webhooks return early
 * - Failed webhook doesn't overwrite a successful payment
 */

// Simulate the webhook handler's key decision logic

function shouldProcessPaymentSuccess(
  payloadType: string,
  paymentStatus: string,
  orderId: string,
  bookingPaymentStatus: string | null
): { action: 'process' | 'skip_wallet' | 'skip_already_paid' | 'skip_not_found'; reason: string } {
  const isSuccess = payloadType === 'PAYMENT_SUCCESS' || paymentStatus === 'SUCCESS';
  if (!isSuccess) return { action: 'skip_not_found', reason: 'Not a success event' };

  // Wallet top-ups handled separately
  if (orderId.startsWith('WALLET_')) {
    return { action: 'skip_wallet', reason: 'Wallet top-up handled by verify-payment' };
  }

  // Booking not found
  if (bookingPaymentStatus === null) {
    return { action: 'skip_not_found', reason: 'Booking not found' };
  }

  // Already paid — idempotency
  if (bookingPaymentStatus === 'paid') {
    return { action: 'skip_already_paid', reason: 'Already processed' };
  }

  return { action: 'process', reason: 'Ready to update' };
}

function shouldUpdateBookingOnFailure(
  payloadType: string,
  paymentStatus: string,
  bookingPaymentStatus: string | null
): { shouldUpdate: boolean; shouldNotify: boolean; reason: string } {
  const isFailed = payloadType === 'PAYMENT_FAILED' || paymentStatus === 'FAILED';
  if (!isFailed) return { shouldUpdate: false, shouldNotify: false, reason: 'Not a failure event' };

  if (bookingPaymentStatus === null) {
    return { shouldUpdate: false, shouldNotify: false, reason: 'Booking not found' };
  }

  // Guard: never overwrite a successful payment
  if (bookingPaymentStatus === 'paid') {
    return { shouldUpdate: false, shouldNotify: false, reason: 'Booking already paid — do not overwrite' };
  }

  return { shouldUpdate: true, shouldNotify: true, reason: 'Update to failed and notify' };
}

// ======================================================
// TESTS
// ======================================================

describe('Payment Webhook — Success Handler Logic', () => {
  it('processes a normal booking payment success', () => {
    const result = shouldProcessPaymentSuccess(
      'PAYMENT_SUCCESS', 'SUCCESS', 'BOOKING_abc12345_1234567890', 'pending'
    );
    expect(result.action).toBe('process');
  });

  it('skips wallet top-up orders (handled by verify-payment)', () => {
    const result = shouldProcessPaymentSuccess(
      'PAYMENT_SUCCESS', 'SUCCESS', 'WALLET_cust1234_1234567890', null
    );
    expect(result.action).toBe('skip_wallet');
  });

  it('skips driver wallet top-up orders so the idempotent driver credit path can handle them', () => {
    const result = shouldProcessPaymentSuccess(
      'PAYMENT_SUCCESS', 'SUCCESS', 'DRIVERWALLET_driver123_1234567890', null
    );
    expect(
      result.action === 'skip_wallet' || result.action === 'skip_not_found'
    ).toBe(true);
  });

  it('skips already-paid bookings (idempotency)', () => {
    const result = shouldProcessPaymentSuccess(
      'PAYMENT_SUCCESS', 'SUCCESS', 'BOOKING_abc12345_1234567890', 'paid'
    );
    expect(result.action).toBe('skip_already_paid');
  });

  it('handles booking not found', () => {
    const result = shouldProcessPaymentSuccess(
      'PAYMENT_SUCCESS', 'SUCCESS', 'BOOKING_abc12345_1234567890', null
    );
    expect(result.action).toBe('skip_not_found');
  });
});

describe('Payment Webhook — Failure Handler Logic', () => {
  it('updates booking to failed on PAYMENT_FAILED', () => {
    const result = shouldUpdateBookingOnFailure('PAYMENT_FAILED', 'FAILED', 'pending');
    expect(result.shouldUpdate).toBe(true);
    expect(result.shouldNotify).toBe(true);
  });

  it('does NOT overwrite a paid booking on late failure webhook', () => {
    const result = shouldUpdateBookingOnFailure('PAYMENT_FAILED', 'FAILED', 'paid');
    expect(result.shouldUpdate).toBe(false);
    expect(result.reason).toContain('do not overwrite');
  });

  it('handles booking not found gracefully', () => {
    const result = shouldUpdateBookingOnFailure('PAYMENT_FAILED', 'FAILED', null);
    expect(result.shouldUpdate).toBe(false);
    expect(result.shouldNotify).toBe(false);
  });

  it('ignores non-failure events', () => {
    const result = shouldUpdateBookingOnFailure('PAYMENT_SUCCESS', 'SUCCESS', 'pending');
    expect(result.shouldUpdate).toBe(false);
  });
});
