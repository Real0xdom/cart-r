/**
 * Admin Bookings Tests (Playwright)
 * Tests: View bookings, filter, search, override status, assign driver
 * Priority: P0
 */
import { test, expect, Page } from '@playwright/test';
import { AdminLoginPage } from '../../page-objects/admin/LoginPage';
import { AdminDashboardPage } from '../../page-objects/admin/DashboardPage';
import { AdminBookingsPage, AdminBookingDetailPage } from '../../page-objects/admin/BookingsPage';
import { generateAdminCredentials } from '../../helpers/test-data-factory';
import * as db from '../../helpers/supabase-admin';
import { BOOKING_STATUS } from '../../config/constants';

const creds = generateAdminCredentials();
const TEST_RUN_ID = `admin_bookings_${Date.now()}`;
const PHONE_SUFFIX = Date.now().toString().slice(-6); // Unique per run

// Shared login helper
async function loginAsAdmin(page: Page) {
  const loginPage = new AdminLoginPage(page);
  await loginPage.goto();
  await loginPage.login(creds.email, creds.password);
}

test.describe('Admin Bookings Management @smoke @regression', () => {
  let testCustomerId: string;
  let testDriverId: string;
  let testBookingId: string;
  let testBookingNumber: string;

  test.beforeAll(async () => {
    // Seed test data
    const customer = await db.createTestCustomer({
      phone: `+9197000${PHONE_SUFFIX}1`,
      name: 'Admin Test Customer',
      testRunId: TEST_RUN_ID,
    });
    if (!customer.userId) throw new Error(`Failed to create customer: ${customer.error}`);
    testCustomerId = customer.userId;

    const driver = await db.createTestDriver({
      phone: `+9197000${PHONE_SUFFIX}2`,
      name: 'Admin Test Driver',
      vehicleType: 'sedan',
      verificationStatus: 'approved',
      isOnline: true,
      latitude: 19.136,
      longitude: 72.829,
      testRunId: TEST_RUN_ID,
    });
    if (!driver.driverId) throw new Error(`Failed to create driver: ${driver.error}`);
    testDriverId = driver.driverId;

    // Create test bookings in various states
    const booking = await db.createTestBooking({
      customerId: testCustomerId,
      driverId: testDriverId,
      status: BOOKING_STATUS.ACCEPTED,
      vehicleType: 'sedan',
      totalFare: 150,
    });
    if (!booking.bookingId) throw new Error(`Failed to create booking: ${booking.error}`);
    testBookingId = booking.bookingId;
    testBookingNumber = booking.bookingNumber;

    // Create additional bookings for filter testing
    await db.createTestBooking({
      customerId: testCustomerId,
      status: BOOKING_STATUS.PENDING,
      vehicleType: 'bike',
      totalFare: 50,
    });

    await db.createTestBooking({
      customerId: testCustomerId,
      driverId: testDriverId,
      status: BOOKING_STATUS.COMPLETED,
      vehicleType: 'sedan',
      totalFare: 200,
    });
  });

  test.afterAll(async () => {
    await db.cleanupTestData(TEST_RUN_ID);
  });

  test('should display bookings list @smoke', async ({ page }) => {
    await loginAsAdmin(page);
    const bookingsPage = new AdminBookingsPage(page);
    await bookingsPage.goto();

    const count = await bookingsPage.getBookingCount();
    expect(count).toBeGreaterThan(0);
  });

  test('should filter bookings by status', async ({ page }) => {
    await loginAsAdmin(page);
    const bookingsPage = new AdminBookingsPage(page);
    await bookingsPage.goto();

    // Filter by 'Completed'
    await bookingsPage.filterByStatus('Completed');
    // All visible rows should show completed status
    const rows = page.locator('table tbody tr');
    const count = await rows.count();
    for (let i = 0; i < Math.min(count, 5); i++) {
      const rowText = await rows.nth(i).innerText();
      expect(rowText.toLowerCase()).toContain('completed');
    }
  });

  test('should search booking by number', async ({ page }) => {
    await loginAsAdmin(page);
    const bookingsPage = new AdminBookingsPage(page);
    await bookingsPage.goto();

    await bookingsPage.searchBooking(testBookingNumber);
    await bookingsPage.verifyBookingVisible(testBookingNumber);
  });

  test('should open booking detail page', async ({ page }) => {
    await loginAsAdmin(page);
    const bookingsPage = new AdminBookingsPage(page);
    await bookingsPage.goto();

    await bookingsPage.openFirstBooking();

    // Should be on detail page
    const detailPage = new AdminBookingDetailPage(page);
    const status = await detailPage.getStatus();
    expect(status).toBeTruthy();
  });

  test('should override booking status', async ({ page }) => {
    await loginAsAdmin(page);

    // Navigate to the accepted booking's detail page
    await page.goto(`/bookings/${testBookingId}`);
    await page.waitForLoadState('domcontentloaded');

    const detailPage = new AdminBookingDetailPage(page);
    const initialStatus = await detailPage.getStatus();
    expect(initialStatus).toContain('accepted');

    // Override to cancelled
    await detailPage.overrideStatus('cancelled');

    // Verify in database
    const dbStatus = await db.getBookingStatus(testBookingId);
    expect(dbStatus).toBe(BOOKING_STATUS.CANCELLED);
  });
});
