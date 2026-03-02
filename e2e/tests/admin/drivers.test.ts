/**
 * Admin Drivers Tests (Playwright)
 * Tests: View drivers, approve, reject, disable
 * Priority: P0
 */
import { test, expect, Page } from '@playwright/test';
import { AdminLoginPage } from '../../page-objects/admin/LoginPage';
import { AdminDriversPage, AdminDriverDetailPage } from '../../page-objects/admin/DriversPage';
import { generateAdminCredentials } from '../../helpers/test-data-factory';
import * as db from '../../helpers/supabase-admin';
import { VERIFICATION_STATUS } from '../../config/constants';

const creds = generateAdminCredentials();
const TEST_RUN_ID = `admin_drivers_${Date.now()}`;
const PHONE_SUFFIX = Date.now().toString().slice(-6); // Unique per run

async function loginAsAdmin(page: Page) {
  const loginPage = new AdminLoginPage(page);
  await loginPage.goto();
  await loginPage.login(creds.email, creds.password);
}

test.describe('Admin Driver Management @regression', () => {
  let pendingDriverId: string;
  let approvedDriverId: string;

  test.beforeAll(async () => {
    // Create driver pending verification
    const pending = await db.createTestDriver({
      phone: `+9197000${PHONE_SUFFIX}1`,
      name: 'Pending Driver Test',
      vehicleType: 'sedan',
      verificationStatus: 'pending',
      testRunId: TEST_RUN_ID,
    });
    if (!pending.driverId) throw new Error(`Failed to create pending driver: ${pending.error}`);
    pendingDriverId = pending.driverId;

    // Create approved driver
    const approved = await db.createTestDriver({
      phone: `+9197000${PHONE_SUFFIX}2`,
      name: 'Approved Driver Test',
      vehicleType: 'bike',
      verificationStatus: 'approved',
      isOnline: true,
      latitude: 19.136,
      longitude: 72.829,
      testRunId: TEST_RUN_ID,
    });
    if (!approved.driverId) throw new Error(`Failed to create approved driver: ${approved.error}`);
    approvedDriverId = approved.driverId;
  });

  test.afterAll(async () => {
    await db.cleanupTestData(TEST_RUN_ID);
  });

  test('should display drivers list @smoke', async ({ page }) => {
    await loginAsAdmin(page);
    const driversPage = new AdminDriversPage(page);
    await driversPage.goto();

    const count = await driversPage.getDriverCount();
    expect(count).toBeGreaterThan(0);
  });

  test('should search for a driver', async ({ page }) => {
    await loginAsAdmin(page);
    const driversPage = new AdminDriversPage(page);
    await driversPage.goto();

    await driversPage.searchDriver('Pending Driver Test');
    await driversPage.verifyDriverVisible('Pending Driver Test');
  });

  test('should approve a pending driver', async ({ page }) => {
    await loginAsAdmin(page);

    await page.goto(`/drivers/${pendingDriverId}`);
    await page.waitForLoadState('domcontentloaded');

    const detailPage = new AdminDriverDetailPage(page);
    await detailPage.approveDriver();

    // Verify in database
    const driver = await db.getDriverStatus(pendingDriverId);
    expect(driver.verification_status).toBe(VERIFICATION_STATUS.APPROVED);
  });

  test('should reject a pending driver with reason', async ({ page }) => {
    // Create a new pending driver for rejection
    const toReject = await db.createTestDriver({
      phone: '+919700010003',
      name: 'Reject Driver Test',
      vehicleType: 'tempo',
      verificationStatus: 'pending',
      testRunId: TEST_RUN_ID,
    });

    await loginAsAdmin(page);
    await page.goto(`/drivers/${toReject.driverId}`);
    await page.waitForLoadState('domcontentloaded');

    const detailPage = new AdminDriverDetailPage(page);
    await detailPage.rejectDriver('Documents not clear, please resubmit');

    // Verify in database
    const driver = await db.getDriverStatus(toReject.driverId);
    expect(driver.verification_status).toBe(VERIFICATION_STATUS.REJECTED);
  });

  test('should view driver ride history', async ({ page }) => {
    await loginAsAdmin(page);

    // Create a completed booking for the approved driver
    const customer = await db.createTestCustomer({
      phone: '+919700010004',
      name: 'History Customer',
      testRunId: TEST_RUN_ID,
    });
    await db.createTestBooking({
      customerId: customer.userId,
      driverId: approvedDriverId,
      status: 'completed',
      totalFare: 200,
    });

    await page.goto(`/drivers/${approvedDriverId}`);
    await page.waitForLoadState('domcontentloaded');

    const detailPage = new AdminDriverDetailPage(page);
    await detailPage.viewRideHistory();

    // History section should show at least 1 ride
    const historyContent = await page.locator('table, [class*="history"]').innerText();
    expect(historyContent).toBeTruthy();
  });
});
