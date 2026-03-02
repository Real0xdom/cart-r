/**
 * Admin Payouts Tests (Playwright)
 * Tests: View withdrawals, approve, reject, process payout
 * Priority: P1
 */
import { test, expect, Page } from '@playwright/test';
import { AdminLoginPage } from '../../page-objects/admin/LoginPage';
import { AdminPayoutsPage } from '../../page-objects/admin/PayoutsPage';
import { generateAdminCredentials } from '../../helpers/test-data-factory';
import * as db from '../../helpers/supabase-admin';

const creds = generateAdminCredentials();
const TEST_RUN_ID = `admin_payouts_${Date.now()}`;
const PHONE_SUFFIX = Date.now().toString().slice(-6); // Unique per run

async function loginAsAdmin(page: Page) {
  const loginPage = new AdminLoginPage(page);
  await loginPage.goto();
  await loginPage.login(creds.email, creds.password);
}

test.describe('Admin Payout Management @regression', () => {
  let testDriverId: string;
  let testWithdrawalId: string;

  test.beforeAll(async () => {
    // Create a driver with wallet balance and withdrawal request
    const driver = await db.createTestDriver({
      phone: `+9197000${PHONE_SUFFIX}3`,
      name: 'Payout Test Driver',
      vehicleType: 'sedan',
      verificationStatus: 'approved',
      testRunId: TEST_RUN_ID,
    });
    if (!driver.driverId) throw new Error(`Failed to create payout driver: ${driver.error}`);
    testDriverId = driver.driverId;

    // Create wallet with balance
    await db.createDriverWallet(testDriverId, 1000);

    // Create a withdrawal request
    const wd = await db.createWithdrawalRequest(testDriverId, 500);
    if (!wd.withdrawalId) throw new Error(`Failed to create withdrawal: ${wd.error}`);
    testWithdrawalId = wd.withdrawalId;
  });

  test.afterAll(async () => {
    await db.cleanupTestData(TEST_RUN_ID);
  });

  test('should display pending withdrawals @smoke', async ({ page }) => {
    await loginAsAdmin(page);
    const payoutsPage = new AdminPayoutsPage(page);
    await payoutsPage.goto();

    const count = await payoutsPage.getWithdrawalCount();
    expect(count).toBeGreaterThan(0);
  });

  test('should approve a withdrawal request', async ({ page }) => {
    await loginAsAdmin(page);
    const payoutsPage = new AdminPayoutsPage(page);
    await payoutsPage.goto();

    await payoutsPage.approveWithdrawal(0);

    // Verify in database
    const client = db.getSupabaseAdmin();
    const { data } = await client.from('withdrawals').select('status').eq('id', testWithdrawalId).single();
    expect(data?.status).toBe('approved');
  });

  test('should reject a withdrawal request', async ({ page }) => {
    // Create another withdrawal for rejection
    const wd = await db.createWithdrawalRequest(testDriverId, 200);

    await loginAsAdmin(page);
    const payoutsPage = new AdminPayoutsPage(page);
    await payoutsPage.goto();

    await payoutsPage.rejectWithdrawal(0, 'Insufficient verification');

    // Verify rejection
    const client = db.getSupabaseAdmin();
    const { data } = await client.from('withdrawals').select('status').eq('id', wd.withdrawalId).single();
    expect(data?.status).toBe('rejected');
  });
});
