import { test, expect } from '@playwright/test';
import { loadEnv, env } from '../../configs/env';
import { readState } from '../../configs/state';
import { AdminLoginPage, AdminNav } from '../admin/pages/admin.pages';

test.describe('Interaction - Admin observes lifecycle', () => {
  test.beforeAll(() => loadEnv());

  test('booking appears in admin bookings (scaffold)', async ({ page }) => {
    const state = readState();

    const login = new AdminLoginPage(page);
    await login.goto();
    await login.login(env.adminEmail(), env.adminPassword());

    const nav = new AdminNav(page);
    await nav.openBookings();

    // TODO: once bookingId/bookingNumber is captured from mobile UI, search for it here.
    // Example:
    // if (state.bookingNumber) {
    //   await page.getByPlaceholder(/Search by booking/i).fill(state.bookingNumber);
    //   await expect(page.getByText(state.bookingNumber)).toBeVisible();
    // }

    await expect(page.getByRole('heading', { name: 'Bookings' })).toBeVisible();
  });
});