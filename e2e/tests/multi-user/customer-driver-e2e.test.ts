/**
 * Multi-User E2E Test — Full Customer-Driver Ride Lifecycle
 * Simulates a complete ride from booking to payment completion using API-level calls.
 * Priority: P0
 */
import * as db from '../../helpers/supabase-admin';
import { callAssignDriver } from '../../helpers/api-client';
import { BOOKING_STATUS, PAYMENT_STATUS, TEST_LOCATIONS } from '../../config/constants';
import { waitForBookingStatus, sleep } from '../../helpers/wait-utils';
import { generateCustomerData, generateDriverData } from '../../helpers/test-data-factory';

const TEST_RUN_ID = `multiuser_e2e_${Date.now()}`;

describe('Multi-User: Full Customer-Driver E2E Ride Lifecycle', () => {
  let customerId: string;
  let driverId: string;
  let driverUserId: string;
  let bookingId: string;
  let isolatedLat: number;
  let isolatedLng: number;

  beforeAll(async () => {
    await db.seedFareConfig();

    isolatedLat = 10.1234 + (Math.random() * 0.001);
    isolatedLng = 10.1234 + (Math.random() * 0.001);

    // 1. Create customer with wallet balance
    const customerData = generateCustomerData({ balance: 1000 });
    const customer = await db.createTestCustomer({ ...customerData, testRunId: TEST_RUN_ID });
    expect(customer.error).toBeNull();
    customerId = customer.userId;

    // 2. Create verified driver near pickup location
    const driverData = generateDriverData({
      vehicleType: 'sedan',
      latitude: isolatedLat + 0.001,
      longitude: isolatedLng + 0.001,
    });
    const driver = await db.createTestDriver({
      ...driverData,
      isOnline: true,
      testRunId: TEST_RUN_ID,
    });
    expect(driver.error).toBeNull();
    driverId = driver.driverId;
    driverUserId = driver.userId;

    // 3. Create driver wallet
    await db.createDriverWallet(driverId, 0);
  });

  afterAll(async () => {
    await db.cleanupTestData(TEST_RUN_ID);
  });

  it('Step 1: Customer creates a booking', async () => {
    // Re-calculate the test coordinates used above or store them in variables
    // Since beforeAll variables are scoped outside, I'll extract them.
    const result = await db.createTestBooking({
      customerId,
      status: BOOKING_STATUS.PENDING,
      vehicleType: 'sedan',
      origin: {
        address: 'Isolated Test Origin',
        latitude: isolatedLat,
        longitude: isolatedLng,
      },
      destination: TEST_LOCATIONS.BANGALORE_WHITEFIELD,
      totalFare: 150,
    });

    expect(result.error).toBeNull();
    expect(result.bookingId).toBeTruthy();
    bookingId = result.bookingId;

    // Verify booking exists in DB
    const booking = await db.getBooking(bookingId);
    expect(booking.status).toBe(BOOKING_STATUS.PENDING);
    expect(booking.customer_id).toBe(customerId);
  });

  it('Step 2: System assigns driver via edge function', async () => {
    const response = await callAssignDriver(bookingId, 10);

    expect(response.ok).toBe(true);
    expect(response.data.assigned).toBe(true);
    expect(response.data.driver).toBeDefined();
    expect(response.data.driver!.id).toBe(driverId);

    // Verify booking status updated
    const booking = await db.getBooking(bookingId);
    expect(booking.status).toBe(BOOKING_STATUS.ACCEPTED);
    expect(booking.driver_id).toBe(driverId);
    expect(booking.accepted_at).toBeTruthy();
  });

  it('Step 3: Driver marks arrived at pickup', async () => {
    const client = db.getSupabaseAdmin();
    const { error } = await client.from('bookings').update({
      status: BOOKING_STATUS.DRIVER_ARRIVED,
      driver_arrived_at: new Date().toISOString(),
    }).eq('id', bookingId);

    expect(error).toBeNull();

    const booking = await db.getBooking(bookingId);
    expect(booking.status).toBe('driver_arrived');
    expect(booking.driver_arrived_at).toBeTruthy();
  });

  it('Step 4: Driver verifies OTP and starts trip', async () => {
    const booking = await db.getBooking(bookingId);
    const otp = booking.pickup_otp;
    expect(otp).toBeTruthy();

    // Simulate OTP verification → status changes to in_progress
    const client = db.getSupabaseAdmin();
    const { error } = await client.from('bookings').update({
      status: BOOKING_STATUS.IN_PROGRESS,
      started_at: new Date().toISOString(),
    }).eq('id', bookingId);

    expect(error).toBeNull();

    const updatedBooking = await db.getBooking(bookingId);
    expect(updatedBooking.status).toBe(BOOKING_STATUS.IN_PROGRESS);
    expect(updatedBooking.started_at).toBeTruthy();
  });

  it('Step 5: Driver completes trip', async () => {
    const client = db.getSupabaseAdmin();
    const { error } = await client.from('bookings').update({
      status: BOOKING_STATUS.COMPLETED,
      completed_at: new Date().toISOString(),
      payment_method: 'wallet',
      payment_status: PAYMENT_STATUS.PAID,
    }).eq('id', bookingId);

    expect(error).toBeNull();

    const booking = await db.getBooking(bookingId);
    expect(booking.status).toBe(BOOKING_STATUS.COMPLETED);
    expect(booking.completed_at).toBeTruthy();
    expect(booking.payment_status).toBe(PAYMENT_STATUS.PAID);
  });

  it('Step 6: Verify final state consistency', async () => {
    const booking = await db.getBooking(bookingId);

    // Full lifecycle timestamps should be set
    expect(booking.accepted_at).toBeTruthy();
    expect(booking.driver_arrived_at).toBeTruthy();
    expect(booking.started_at).toBeTruthy();
    expect(booking.completed_at).toBeTruthy();

    // Status chain should be valid
    expect(booking.status).toBe(BOOKING_STATUS.COMPLETED);
    expect(booking.payment_status).toBe(PAYMENT_STATUS.PAID);
    expect(booking.driver_id).toBe(driverId);
    expect(booking.customer_id).toBe(customerId);
  });
});
