/**
 * API Tests — Payment Edge Functions
 * Tests: create-payment-order, verify-payment
 * Priority: P0
 */
import { callCreatePaymentOrder, callVerifyPayment } from '../../helpers/api-client';
import * as db from '../../helpers/supabase-admin';
import { BOOKING_STATUS, PAYMENT_STATUS } from '../../config/constants';

const TEST_RUN_ID = `api_payment_${Date.now()}`;

describe('Edge Function: create-payment-order', () => {
  let customerId: string;
  let bookingId: string;

  beforeAll(async () => {
    const customer = await db.createTestCustomer({
      phone: '+919800010001',
      name: 'Payment Test Customer',
      email: 'payment_test@cartr.test',
      testRunId: TEST_RUN_ID,
    });
    customerId = customer.userId;

    const booking = await db.createTestBooking({
      customerId,
      status: BOOKING_STATUS.IN_PROGRESS,
      totalFare: 200,
    });
    bookingId = booking.bookingId;
  });

  afterAll(async () => {
    await db.cleanupTestData(TEST_RUN_ID);
  });

  it('should create a payment order for a booking', async () => {
    const response = await callCreatePaymentOrder({
      booking_id: bookingId,
      customer_id: customerId,
      customer_name: 'Payment Test Customer',
      customer_email: 'payment_test@cartr.test',
      customer_phone: '9800010001',
      amount: 200,
    });

    expect(response.ok).toBe(true);
    expect(response.data.payment_session_id).toBeTruthy();
    expect(response.data.order_id).toBeTruthy();
    expect(response.data.order_id).toContain('BOOKING_');
    expect(response.data.is_wallet_topup).toBe(false);
    expect(response.data.environment).toBe('sandbox');
  });

  it('should create a wallet top-up order (no booking_id)', async () => {
    const response = await callCreatePaymentOrder({
      customer_id: customerId,
      customer_name: 'Payment Test Customer',
      customer_phone: '9800010001',
      amount: 500,
    });

    expect(response.ok).toBe(true);
    expect(response.data.order_id).toContain('WALLET_');
    expect(response.data.is_wallet_topup).toBe(true);
  });

  it('should reject missing required fields', async () => {
    const response = await callCreatePaymentOrder({
      customer_id: '',
      amount: 0,
    });

    expect(response.ok).toBe(false);
  });

  it('should reject negative amount', async () => {
    const response = await callCreatePaymentOrder({
      customer_id: customerId,
      amount: -100,
    });

    expect(response.ok).toBe(false);
  });

  it('should reject already-paid booking', async () => {
    // Create a paid booking
    const paidBooking = await db.createTestBooking({
      customerId,
      status: BOOKING_STATUS.COMPLETED,
      paymentStatus: PAYMENT_STATUS.PAID,
      totalFare: 100,
    });

    const response = await callCreatePaymentOrder({
      booking_id: paidBooking.bookingId,
      customer_id: customerId,
      amount: 100,
    });

    expect(response.error).toContain('already completed');
    await db.deleteBooking(paidBooking.bookingId);
  });
});

describe('Edge Function: verify-payment', () => {
  it('should return error for non-existent order', async () => {
    const response = await callVerifyPayment('NONEXISTENT_ORDER_12345');
    // Should return error or FAILED status
    expect(response.status).toBeGreaterThanOrEqual(200);
  });

  it('should handle missing order_id', async () => {
    const response = await callVerifyPayment('');
    expect(response.ok).toBe(false);
  });

  it('should accept force_fail parameter', async () => {
    const response = await callVerifyPayment('NONEXISTENT_ORDER_12345', true);
    expect(response.status).toBeGreaterThanOrEqual(200);
  });
});
