/**
 * Multi-User Test — Race Condition: Multiple Drivers Competing for Same Booking
 * Tests atomic booking acceptance to ensure exactly 1 driver gets the ride.
 * Priority: P0
 */
import * as db from '../../helpers/supabase-admin';
import { BOOKING_STATUS, TEST_LOCATIONS } from '../../config/constants';
import { generateDriverData } from '../../helpers/test-data-factory';

const TEST_RUN_ID = `race_condition_${Date.now()}`;

describe('Multi-User: Race Condition — Multiple Drivers Accept Same Booking', () => {
  let customerId: string;
  let driverIds: string[] = [];
  let bookingId: string;

  beforeAll(async () => {
    await db.seedFareConfig();

    const customer = await db.createTestCustomer({
      phone: '+919900100001',
      name: 'Race Condition Customer',
      testRunId: TEST_RUN_ID,
    });
    customerId = customer.userId;

    // Create 5 drivers, all near the pickup
    for (let i = 0; i < 5; i++) {
      const data = generateDriverData({
        phone: `+9199001100${String(i + 1).padStart(2, '0')}`,
        name: `Race Driver ${i + 1}`,
        vehicleType: 'sedan',
        latitude: TEST_LOCATIONS.MUMBAI_ANDHERI.latitude + (i * 0.001),
        longitude: TEST_LOCATIONS.MUMBAI_ANDHERI.longitude,
      });

      const driver = await db.createTestDriver({
        ...data,
        isOnline: true,
        testRunId: TEST_RUN_ID,
      });
      driverIds.push(driver.driverId);
    }
  }, 60000);

  afterAll(async () => {
    await db.cleanupTestData(TEST_RUN_ID);
  }, 60000);

  it('should allow exactly 1 driver to accept when 5 try simultaneously', async () => {
    // Create a pending booking
    const booking = await db.createTestBooking({
      customerId,
      status: BOOKING_STATUS.PENDING,
      vehicleType: 'sedan',
      origin: TEST_LOCATIONS.MUMBAI_ANDHERI,
      destination: TEST_LOCATIONS.MUMBAI_BANDRA,
      totalFare: 150,
    });
    bookingId = booking.bookingId;

    // All 5 drivers try to accept simultaneously using the atomic RPC
    const client = db.getSupabaseAdmin();
    const acceptPromises = driverIds.map(async (driverId) => {
      try {
        const { data, error } = await client.rpc('accept_booking_atomic', {
          p_booking_id: bookingId,
          p_driver_id: driverId,
        });

        return {
          driverId,
          success: data?.success ?? !error,
          data,
          error: error?.message || data?.error,
        };
      } catch (err: any) {
        return { driverId, success: false, data: null, error: err.message };
      }
    });

    const results = await Promise.all(acceptPromises);

    // Count successes
    const successes = results.filter(r => r.success);
    const failures = results.filter(r => !r.success);

    console.log('Race condition results:', JSON.stringify(results, null, 2));

    // EXACTLY 1 should succeed
    expect(successes.length).toBe(1);
    expect(failures.length).toBe(4);

    // Verify booking has exactly 1 driver
    const finalBooking = await db.getBooking(bookingId);
    expect(finalBooking.status).toBe(BOOKING_STATUS.ACCEPTED);
    expect(finalBooking.driver_id).toBeTruthy();
    expect(finalBooking.driver_id).toBe(successes[0].driverId);
  });

  it('should reject acceptance after booking is already accepted', async () => {
    // The booking from the previous test should be accepted
    const client = db.getSupabaseAdmin();

    // A new driver tries to accept the already-accepted booking
    const lateDriver = await db.createTestDriver({
      phone: '+919900110006',
      name: 'Late Driver',
      vehicleType: 'sedan',
      isOnline: true,
      testRunId: TEST_RUN_ID,
    });

    const { data, error } = await client.rpc('accept_booking_atomic', {
      p_booking_id: bookingId,
      p_driver_id: lateDriver.driverId,
    });

    // Should fail
    expect(data?.success ?? !error).toBe(false);

    // Booking should still have original driver
    const booking = await db.getBooking(bookingId);
    expect(booking.driver_id).not.toBe(lateDriver.driverId);
  });
});

describe('Multi-User: Concurrent Bookings — 5 Customers, 5 Drivers', () => {
  const customerIds: string[] = [];
  const driverIds: string[] = [];
  const bookingIds: string[] = [];
  const CONCURRENT_TEST_RUN_ID = `concurrent_${Date.now()}`;

  beforeAll(async () => {
    await db.seedFareConfig();

    // Create 5 customers and 5 drivers
    for (let i = 0; i < 5; i++) {
      const customer = await db.createTestCustomer({
        phone: `+9199002000${String(i + 1).padStart(2, '0')}`,
        name: `Concurrent Customer ${i + 1}`,
        testRunId: CONCURRENT_TEST_RUN_ID,
      });
      customerIds.push(customer.userId);

      const driver = await db.createTestDriver({
        phone: `+9199002100${String(i + 1).padStart(2, '0')}`,
        name: `Concurrent Driver ${i + 1}`,
        vehicleType: 'sedan',
        isOnline: true,
        latitude: TEST_LOCATIONS.MUMBAI_ANDHERI.latitude + (i * 0.002),
        longitude: TEST_LOCATIONS.MUMBAI_ANDHERI.longitude,
        testRunId: CONCURRENT_TEST_RUN_ID,
      });
      driverIds.push(driver.driverId);
    }
  }, 60000);

  afterAll(async () => {
    await db.cleanupTestData(CONCURRENT_TEST_RUN_ID);
  }, 60000);

  it('should create 5 bookings in parallel without conflicts', async () => {
    const bookingPromises = customerIds.map(async (customerId, i) => {
      return db.createTestBooking({
        customerId,
        status: BOOKING_STATUS.PENDING,
        vehicleType: 'sedan',
        origin: {
          address: `Pickup ${i + 1}`,
          latitude: TEST_LOCATIONS.MUMBAI_ANDHERI.latitude + (i * 0.003),
          longitude: TEST_LOCATIONS.MUMBAI_ANDHERI.longitude,
        },
        destination: TEST_LOCATIONS.MUMBAI_BANDRA,
        totalFare: 100 + (i * 25),
      });
    });

    const results = await Promise.all(bookingPromises);

    // All should succeed
    for (const result of results) {
      expect(result.error).toBeNull();
      expect(result.bookingId).toBeTruthy();
      bookingIds.push(result.bookingId);
    }

    // All should have unique IDs
    const uniqueIds = new Set(bookingIds);
    expect(uniqueIds.size).toBe(5);
  });

  it('should allow each driver to accept a different booking independently', async () => {
    const client = db.getSupabaseAdmin();

    const acceptPromises = driverIds.map(async (driverId, i) => {
      const { data, error } = await client.rpc('accept_booking_atomic', {
        p_booking_id: bookingIds[i],
        p_driver_id: driverId,
      });
      return { driverId, bookingId: bookingIds[i], success: data?.success ?? !error, error: error?.message };
    });

    const results = await Promise.all(acceptPromises);

    // All should succeed (each driver accepts a different booking)
    for (const result of results) {
      expect(result.success).toBe(true);
    }

    // Verify each booking has the correct driver
    for (let i = 0; i < 5; i++) {
      const booking = await db.getBooking(bookingIds[i]);
      expect(booking.driver_id).toBe(driverIds[i]);
      expect(booking.status).toBe(BOOKING_STATUS.ACCEPTED);
    }
  });
});
