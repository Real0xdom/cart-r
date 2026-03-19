/**
 * Admin Dashboard Page Object (Playwright)
 * Maps to: apps/admin/app/page.tsx
 */
import { Page, Locator, expect } from '@playwright/test';

export class AdminDashboardPage {
  readonly page: Page;
  readonly sidebar: Locator;
  readonly totalBookingsCard: Locator;
  readonly activeDriversCard: Locator;
  readonly totalUsersCard: Locator;
  readonly revenueCard: Locator;
  readonly recentBookingsTable: Locator;
  readonly refreshButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.sidebar = page.locator('div.fixed.left-0.top-0, nav.space-y-1').first();
    this.totalBookingsCard = page.locator('div.bg-white.p-6.rounded-2xl:has(h3:has-text("Total Bookings"))');
    this.activeDriversCard = page.locator('div.bg-white.p-6.rounded-2xl:has(h3:has-text("Drivers"))');
    this.totalUsersCard = page.locator('div.bg-white.p-6.rounded-2xl:has(h3:has-text("Total Users"))');
    this.revenueCard = page.locator('div.bg-white.p-6.rounded-2xl:has(h3:has-text("Total Revenue"))');
    this.recentBookingsTable = page.locator('table');
    this.refreshButton = page.locator('button:has-text("Refresh"), button[aria-label="Refresh"]');
  }

  async goto() {
    await this.page.goto('/');
    await this.page.waitForLoadState('domcontentloaded');
  }

  async verifyDashboardLoaded() {
    // Wait for the main content area to appear
    await this.page.locator('h1:has-text("Dashboard")').waitFor({ state: 'visible', timeout: 15_000 });
    // Wait for at least one stat card to be visible
    await expect(this.totalBookingsCard).toBeVisible({ timeout: 10_000 });
  }

  async navigateTo(section: string) {
    await this.page.click(`a:has-text("${section}"), [href*="${section.toLowerCase()}"]`);
    await this.page.waitForLoadState('domcontentloaded');
  }

  async navigateToBookings() { await this.navigateTo('Bookings'); }
  async navigateToDrivers() { await this.navigateTo('Drivers'); }
  async navigateToUsers() { await this.navigateTo('Users'); }
  async navigateToPricing() { await this.navigateTo('Pricing'); }
  async navigateToPayouts() { await this.navigateTo('Payouts'); }
  async navigateToFinance() { await this.navigateTo('Finance'); }
  async navigateToSupport() { await this.navigateTo('Support'); }
  async navigateToSettings() { await this.navigateTo('Settings'); }
  async navigateToNotifications() { await this.navigateTo('Notifications'); }
  async navigateToRatings() { await this.navigateTo('Ratings'); }
  async navigateToServiceAreas() { await this.navigateTo('Service Areas'); }
}
