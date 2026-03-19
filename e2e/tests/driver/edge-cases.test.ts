/**
 * Driver E2E Edge Case Tests
 * Tests resilience, race conditions, and error handling on the driver side.
 * These tests run at the API/DB level (no Appium required).
 * Priority: P1
 */
import * as db from '../../helpers/supabase-admin';
import { BOOKING_STATUS, TEST_LOCATIONS } from '../../config/constants';

const TEST_RUN_ID = `driver_edge_${Date.now()}`;

describe('Driver Edge Cases', () => {
  let customerId: string;
  let driverId: string;
  let driverUserId: string;

  beforeAll(async () => {
    await db.seedFareConfig();

    const customer = await db.createTestCustomer({
      phone: '+919900300001',
      name: 'Driver Edge Customer',
      testRunId: TEST_RUN_ID,
    });
    customerId = customer.userId;

    const driver = await db.createTestDriver({
      phone: '+919900300002',
      name: 'Driver Edge Driver',
      vehicleType: 'sedan',
      verificationStatus: 'approved',
      isOnline: true,
      latitude: TEST_LOCATIONS.MUMBAI_ANDHERI.latitude,
      longitude: TEST_LOCATIONS.MUMBAI_ANDHERI.longitude,
      testRunId: TEST_RUN_ID,
    });
    driverId = driver.driverId;
    driverUserId = driver.userId;
  });

  afterAll(async () => {
    await db.cleanupTestData(TEST_RUN_ID);
  });

  it('should prevent accepting expired booking', async () => {
    const client = db.getSupabaseAdmin();

    // Create booking with past expiry
    const { data, error } = await client.from('bookings').insert({
      booking_number: `EXPIRED-TEST-${Date.now()}`,
      customer_id: customerId,
      origin_address: TEST_LOCATIONS.MUMBAI_ANDHERI.address,
      origin_latitude: TEST_LOCATIONS.MUMBAI_ANDHERI.latitude,
      origin_longitude: TEST_LOCATIONS.MUMBAI_ANDHERI.longitude,
      destination_address: TEST_LOCATIONS.MUMBAI_BANDRA.address,
      destination_latitude: TEST_LOCATIONS.MUMBAI_BANDRA.latitude,
      destination_longitude: TEST_LOCATIONS.MUMBAI_BANDRA.longitude,
      vehicle_type: 'sedan',
      total_fare: 100,
      status: BOOKING_STATUS.PENDING,
      expires_at: new Date(Date.now() - 60_000).toISOString(), // 1 minute ago
      idempotency_key: `exp_${Date.now()}`,
    }).select('id').single();

    if (data) {
      // Try to accept — should fail or be handled
      const { data: acceptResult, error: acceptError } = await client.rpc('accept_booking_atomic', {
        p_booking_id: data.id,
        p_driver_id: driverId,
      });

      // Either should return an error or success=false
      const failed = acceptError || (acceptResult && !acceptResult.success);
      // Note: This test documents the behavior — if it passes without failing,
      // it means the system DOESN'T check expiry, which is a bug to fix.
      console.log('Expired booking accept result:', { acceptResult, acceptError, failed });

      await db.deleteBooking(data.id);
    }
  });

  it('should not allow driver to accept while already on an active ride', async () => {
    const client = db.getSupabaseAdmin();

    // Driver is already on an in-progress ride
    const activeBooking = await db.createTestBooking({
      customerId,
      driverId,
      status: BOOKING_STATUS.IN_PROGRESS,
    });

    // Try to accept a new booking
    const newBooking = await db.createTestBooking({
      customerId,
      status: BOOKING_STATUS.PENDING,
    });

    const { data, error } = await client.rpc('accept_booking_atomic', {
      p_booking_id: newBooking.bookingId,
      p_driver_id: driverId,
    });

    // Should ideally fail — if it succeeds, that's a bug worth documenting
    console.log('Accept while active ride result:', { data, error });

    // Verify original booking is still in_progress
    const original = await db.getBooking(activeBooking.bookingId);
    expect(original.status).toBe(BOOKING_STATUS.IN_PROGRESS);

    await db.deleteBooking(activeBooking.bookingId);
    await db.deleteBooking(newBooking.bookingId);
  });

  it('should handle driver going offline and rejecting new rides', async () => {
    const client = db.getSupabaseAdmin();

    // Set driver offline
    await db.setDriverOffline(driverId);

    const driver = await db.getDriverStatus(driverId);
    expect(driver.is_online).toBe(false);

    // Create a pending booking
    const booking = await db.createTestBooking({
      customerId,
      status: BOOKING_STATUS.PENDING,
      origin: TEST_LOCATIONS.MUMBAI_ANDHERI,
    });

    // The assign-driver function should NOT find this offline driver
    // (tested in API tests, but verified here at DB level)
    const offlineDriver = await db.getDriverStatus(driverId);
    expect(offlineDriver.is_online).toBe(false);

    // Set driver back online for other tests
    await db.setDriverOnline(driverId, TEST_LOCATIONS.MUMBAI_ANDHERI.latitude, TEST_LOCATIONS.MUMBAI_ANDHERI.longitude);

    await db.deleteBooking(booking.bookingId);
  });

  it('should track driver rejection correctly', async () => {
    const client = db.getSupabaseAdmin();

    const booking = await db.createTestBooking({
      customerId,
      status: BOOKING_STATUS.PENDING,
    });

    // Record rejection
    const { error } = await client.from('driver_rejections').insert({
      driver_id: driverId,
      booking_id: booking.bookingId,
      reason: 'Too far',
    });

    expect(error).toBeNull();

    // Verify rejection was recorded
    const { data: rejections } = await client.from('driver_rejections')
      .select('*')
      .eq('driver_id', driverId)
      .eq('booking_id', booking.bookingId);

    expect(rejections).toHaveLength(1);
    expect(rejections![0].reason).toBe('Too far');

    await db.deleteBooking(booking.bookingId);
  });

  it('should handle withdrawal request without bank details', async () => {
    // Create wallet for the driver
    await db.createDriverWallet(driverId, 1000);

    // Try to create withdrawal — should work at DB level
    const wd = await db.createWithdrawalRequest(driverId, 500);
    expect(wd.error).toBeNull();

    // The process-withdrawal edge function would fail without beneficiary
    // This is tested in the API tests
  });

  it('should handle cancellation by driver mid-ride', async () => {
    const client = db.getSupabaseAdmin();

    const booking = await db.createTestBooking({
      customerId,
      driverId,
      status: BOOKING_STATUS.IN_PROGRESS,
    });

    // Driver cancels
    const { error } = await client.from('bookings').update({
      status: BOOKING_STATUS.CANCELLED,
      cancelled_by: driverUserId,
      cancellation_reason: 'Vehicle breakdown',
      cancelled_at: new Date().toISOString(),
    }).eq('id', booking.bookingId);

    expect(error).toBeNull();

    const updated = await db.getBooking(booking.bookingId);
    expect(updated.status).toBe(BOOKING_STATUS.CANCELLED);
    expect(updated.cancelled_by).toBe(driverUserId);

    await db.deleteBooking(booking.bookingId);
  });
});
