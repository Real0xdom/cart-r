/**
 * Admin Auth Tests (Playwright)
 * Tests: Login, invalid credentials, session persistence, logout
 * Priority: P0
 */
import { test, expect } from '@playwright/test';
import { AdminLoginPage } from '../../page-objects/admin/LoginPage';
import { AdminDashboardPage } from '../../page-objects/admin/DashboardPage';
import { generateAdminCredentials } from '../../helpers/test-data-factory';

test.describe('Admin Authentication @smoke @regression', () => {
  const creds = generateAdminCredentials();

  test('should login with valid credentials', async ({ page }) => {
    const loginPage = new AdminLoginPage(page);
    await loginPage.goto();
    await loginPage.loginAndVerify(creds.email, creds.password);

    const dashboard = new AdminDashboardPage(page);
    await dashboard.verifyDashboardLoaded();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    const loginPage = new AdminLoginPage(page);
    await loginPage.goto();
    await loginPage.loginExpectError('wrong@email.com', 'wrongpassword');

    // Should still be on login page
    expect(await loginPage.isOnLoginPage()).toBe(true);
  });

  test('should persist session after page refresh', async ({ page }) => {
    const loginPage = new AdminLoginPage(page);
    await loginPage.goto();
    await loginPage.loginAndVerify(creds.email, creds.password);

    // Refresh the page
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    // Should NOT be redirected to login
    const isOnLogin = await loginPage.isOnLoginPage();
    expect(isOnLogin).toBe(false);
  });

  test('should redirect to login when not authenticated', async ({ page, context }) => {
    // Clear all cookies to ensure we are not authenticated
    await context.clearCookies();
    // Try to access protected route without login
    await page.goto('/bookings');
    await page.waitForLoadState('domcontentloaded');

    // Should be redirected to login
    expect(page.url()).toContain('/login');
  });
});
