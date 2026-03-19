/**
 * API Tests — Assign Driver Edge Function
 * Tests: Assign driver, no drivers available, already assigned, race conditions
 * Priority: P0
 */
import { callAssignDriver } from '../../helpers/api-client';
import * as db from '../../helpers/supabase-admin';
import { BOOKING_STATUS, TEST_LOCATIONS } from '../../config/constants';

const TEST_RUN_ID = `api_assign_${Date.now()}`;

describe('Edge Function: assign-driver', () => {
  let customerId: string;
  let driverId: string;

  beforeAll(async () => {
    await db.seedFareConfig();

    const customer = await db.createTestCustomer({
      phone: '+919800000001',
      name: 'Assign Test Customer',
      testRunId: TEST_RUN_ID,
    });
    customerId = customer.userId;

    const driver = await db.createTestDriver({
      phone: '+919800000002',
      name: 'Assign Test Driver',
      vehicleType: 'sedan',
      verificationStatus: 'approved',
      isOnline: true,
      latitude: TEST_LOCATIONS.MUMBAI_ANDHERI.latitude,
      longitude: TEST_LOCATIONS.MUMBAI_ANDHERI.longitude,
      testRunId: TEST_RUN_ID,
    });
    driverId = driver.driverId;
  });

  afterAll(async () => {
    await db.cleanupTestData(TEST_RUN_ID);
  });

  it('should assign the nearest available driver to a pending booking', async () => {
    const booking = await db.createTestBooking({
      customerId,
      status: BOOKING_STATUS.PENDING,
      vehicleType: 'sedan',
      origin: TEST_LOCATIONS.MUMBAI_ANDHERI,
      destination: TEST_LOCATIONS.MUMBAI_BANDRA,
    });

    const response = await callAssignDriver(booking.bookingId);

    expect(response.ok).toBe(true);
    expect(response.data.assigned).toBe(true);
    expect(response.data.driver).toBeDefined();
    expect(response.data.driver!.id).toBe(driverId);

    // Verify booking updated in DB
    const dbStatus = await db.getBookingStatus(booking.bookingId);
    expect(dbStatus).toBe(BOOKING_STATUS.ACCEPTED);

    // Cleanup
    await db.deleteBooking(booking.bookingId);
  });

  it('should return error when booking is not pending', async () => {
    const booking = await db.createTestBooking({
      customerId,
      driverId,
      status: BOOKING_STATUS.ACCEPTED,
    });

    const response = await callAssignDriver(booking.bookingId);

    expect(response.error).toContain('not in pending');

    await db.deleteBooking(booking.bookingId);
  });

  it('should return error for non-existent booking', async () => {
    const response = await callAssignDriver('00000000-0000-0000-0000-000000000000');
    expect(response.error).toBeTruthy();
  });

  it('should return no drivers when none are available in radius', async () => {
    // Driver is in Mumbai, booking is in Delhi — too far
    const booking = await db.createTestBooking({
      customerId,
      status: BOOKING_STATUS.PENDING,
      vehicleType: 'sedan',
      origin: TEST_LOCATIONS.DELHI_CONNAUGHT,
      destination: TEST_LOCATIONS.DELHI_AIRPORT,
    });

    const response = await callAssignDriver(booking.bookingId, 5);

    expect(response.data.assigned).toBe(false);
    expect(response.data.error).toContain('No drivers available in your area');

    await db.deleteBooking(booking.bookingId);
  });

  it('should handle missing booking_id', async () => {
    const response = await callAssignDriver('');
    expect(response.ok).toBe(false);
  });
});
