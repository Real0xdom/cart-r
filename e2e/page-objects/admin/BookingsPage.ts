/**
 * Admin Bookings Page Object (Playwright)
 * Maps to: apps/admin/app/bookings/page.tsx
 */
import { Page, Locator, expect } from '@playwright/test';

export class AdminBookingsPage {
  readonly page: Page;
  readonly bookingsTable: Locator;
  readonly bookingRows: Locator;
  readonly statusFilter: Locator;
  readonly searchInput: Locator;
  readonly refreshButton: Locator;
  readonly loadingIndicator: Locator;

  constructor(page: Page) {
    this.page = page;
    this.bookingsTable = page.locator('table');
    this.bookingRows = page.locator('table tbody tr');
    this.statusFilter = page.locator('select');
    this.searchInput = page.locator('input[placeholder*="Search"]');
    this.refreshButton = page.locator('button:has-text("Refresh")');
    this.loadingIndicator = page.locator('div:has-text("Loading bookings")');
  }

  async goto() {
    await this.page.goto('/bookings');
    await this.page.waitForLoadState('domcontentloaded');
  }

  async getBookingCount(): Promise<number> {
    // Wait for loading spinner to disappear before counting
    await this.page.locator('div.animate-spin').waitFor({ state: 'hidden', timeout: 30_000 }).catch(() => {});
    await this.page.waitForTimeout(500);
    return await this.bookingRows.count();
  }

  async filterByStatus(status: string) {
    await this.statusFilter.selectOption({ label: status });
    // Wait for loading to finish
    await this.page.locator('div.animate-spin').waitFor({ state: 'hidden', timeout: 30_000 }).catch(() => {});
    await this.page.waitForLoadState('domcontentloaded');
  }

  async searchBooking(query: string) {
    await this.searchInput.clear();
    await this.searchInput.fill(query);
    await this.searchInput.press('Enter');
    // Wait for loading to finish
    await this.page.locator('div.animate-spin').waitFor({ state: 'hidden', timeout: 30_000 }).catch(() => {});
    await this.page.waitForTimeout(1000); // Wait for filtered list to settle
  }

  async openBooking(bookingNumber: string) {
    // Try to find the row with the exact booking number
    const row = this.page.locator(`tr:has-text("${bookingNumber}")`).first();
    await row.locator('button:has-text("View Details")').click();
    await this.page.waitForSelector('h2:has-text("Booking Details"), h1:has-text("Booking #")', { timeout: 10_000 });
  }

  async openFirstBooking() {
    const firstRow = this.bookingRows.first();
    const viewButton = firstRow.locator('button:has-text("View Details")');
    await viewButton.click();
    // If it's a modal, it might not trigger a network load state, but we wait for visibility
    await this.page.waitForSelector('h2:has-text("Booking Details"), h1:has-text("Booking #")', { timeout: 5000 });
  }

  async refreshList() {
    await this.refreshButton.click();
    await this.page.waitForLoadState('domcontentloaded');
  }

  async verifyBookingVisible(bookingNumber: string) {
    // Scope to table body to avoid strict mode violation on broad `text=` locator
    await expect(this.page.locator('table tbody').getByText(bookingNumber, { exact: false })).toBeVisible();
  }

  async verifyBookingNotVisible(bookingNumber: string) {
    await expect(this.page.locator('table tbody').getByText(bookingNumber, { exact: false })).not.toBeVisible();
  }
}

/**
 * Admin Booking Detail Page Object (Playwright)
 * Maps to: apps/admin/app/bookings/[id]/page.tsx
 */
export class AdminBookingDetailPage {
  readonly page: Page;
  readonly statusBadge: Locator;
  readonly customerInfo: Locator;
  readonly driverInfo: Locator;
  readonly fareBreakdown: Locator;
  readonly paymentInfo: Locator;
  readonly overrideStatusButton: Locator;
  readonly assignDriverButton: Locator;

  constructor(page: Page) {
    this.page = page;
    // The status badge on the booking detail page: a capitalized span.rounded-full
    // directly beneath the booking title h1 (inside its parent flex div)
    this.statusBadge = page.locator('div.flex.items-center.gap-3 > span.rounded-full').first();
    this.customerInfo = page.locator('div:has-text("Customer"), h3:has-text("Customer")');
    this.driverInfo = page.locator('div:has-text("Driver"), h3:has-text("Driver")');
    this.fareBreakdown = page.locator('div:has-text("Fare"), div:has-text("Payment")');
    this.paymentInfo = page.locator('div:has-text("Payment")');
    this.overrideStatusButton = page.locator('button:has-text("Update Status"), button:has-text("Cancel Booking"), select[name="status"]');
    this.assignDriverButton = page.locator('button:has-text("Assign Driver")');
  }

  async getStatus(): Promise<string> {
    // Wait for loading to finish
    await this.page.locator('div.animate-spin').waitFor({ state: 'hidden', timeout: 30_000 }).catch(() => {});
    // Wait for status badge to be visible and have text
    await this.statusBadge.waitFor({ state: 'visible', timeout: 10_000 });
    const text = await this.statusBadge.innerText();
    return text.toLowerCase().trim();
  }

  async overrideStatus(newStatus: string) {
    // Handle the browser confirmation dialog if it appears
    this.page.once('dialog', dialog => dialog.accept().catch(() => {}));

    const selectEl = this.page.locator('select[name="status"]');
    if (await selectEl.isVisible()) {
      await selectEl.selectOption(newStatus);
    } else {
      // Look for a button that matches the action or just the override button
      const specificButton = this.page.locator(`button:has-text("${newStatus}"), button:has-text("Cancel")`);
      if (await specificButton.isVisible()) {
        await specificButton.click();
      } else {
        await this.overrideStatusButton.click();
      }
    }
    
    // Wait for update to complete
    await this.page.waitForLoadState('domcontentloaded');
    await this.page.waitForTimeout(1000); // Give it a second for DB update
  }

  async assignDriver(driverName: string) {
    await this.assignDriverButton.click();
    await this.page.getByText(driverName, { exact: false }).click();
    const confirmBtn = this.page.locator('button:has-text("Confirm"), button:has-text("Assign")');
    if (await confirmBtn.isVisible()) {
      await confirmBtn.click();
    }
    await this.page.waitForLoadState('domcontentloaded');
  }
}
