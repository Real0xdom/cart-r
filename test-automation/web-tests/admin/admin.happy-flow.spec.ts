import { test } from '@playwright/test';
import { loadEnv, env } from '../../configs/env';
import { AdminLoginPage, AdminNav } from './pages/admin.pages';

test.describe('Admin Web Console - Happy Flow', () => {
  test.beforeAll(() => loadEnv());

  test('login → bookings → drivers → users → finance', async ({ page }) => {
    const login = new AdminLoginPage(page);
    await login.goto();
    await login.login(env.adminEmail(), env.adminPassword());

    const nav = new AdminNav(page);
    await nav.openBookings();
    await nav.openDrivers();
    await nav.openUsers();
    await nav.openFinance();
  });
});