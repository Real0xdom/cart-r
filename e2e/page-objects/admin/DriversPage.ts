/**
 * Admin Drivers Page Object (Playwright)
 * Maps to: apps/admin/app/drivers/page.tsx and drivers/[id]/page.tsx
 */
import { Page, Locator, expect } from '@playwright/test';

export class AdminDriversPage {
  readonly page: Page;
  readonly driversTable: Locator;
  readonly driverRows: Locator;
  readonly searchInput: Locator;
  readonly statusFilter: Locator;
  readonly refreshButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.driversTable = page.locator('table');
    this.driverRows = page.locator('table tbody tr');
    this.searchInput = page.locator('input[placeholder*="search" i], input[type="search"]');
    this.statusFilter = page.locator('select, [class*="filter"]');
    this.refreshButton = page.locator('button:has-text("Refresh")');
  }

  async goto() {
    await this.page.goto('/drivers');
    await this.page.waitForLoadState('domcontentloaded');
  }

  async getDriverCount(): Promise<number> {
    // Wait for loading spinner to disappear before counting
    await this.page.locator('div.animate-spin').waitFor({ state: 'hidden', timeout: 30_000 }).catch(() => {});
    await this.page.waitForTimeout(500);
    return await this.driverRows.count();
  }

  async searchDriver(query: string) {
    await this.searchInput.fill(query);
    // Wait for 500ms debounce + API fetch to complete
    await this.page.waitForTimeout(700);
    await this.page.locator('div.animate-spin').waitFor({ state: 'hidden', timeout: 30_000 }).catch(() => {});
    await this.page.waitForTimeout(300);
  }

  async openDriver(name: string) {
    await this.page.click(`a:has-text("${name}"), tr:has-text("${name}") a`);
    await this.page.waitForLoadState('domcontentloaded');
  }

  async openFirstDriver() {
    const link = this.driverRows.first().locator('a').first();
    await link.click();
    await this.page.waitForLoadState('domcontentloaded');
  }

  async filterByStatus(status: string) {
    const button = this.page.locator(`button:has-text("${status}")`);
    if (await button.isVisible()) {
      await button.click();
    }
    await this.page.waitForTimeout(500);
  }

  async verifyDriverVisible(driverName: string) {
    await expect(this.page.locator('table tbody').getByText(driverName, { exact: false })).toBeVisible();
  }
}

export class AdminDriverDetailPage {
  readonly page: Page;
  readonly verificationBadge: Locator;
  readonly approveButton: Locator;
  readonly rejectButton: Locator;
  readonly driverName: Locator;
  readonly vehicleInfo: Locator;
  readonly documents: Locator;
  readonly rideHistory: Locator;
  readonly disableToggle: Locator;
  readonly rejectionReasonInput: Locator;

  constructor(page: Page) {
    this.page = page;
    this.verificationBadge = page.locator('[class*="badge"]:has-text("pending"), [class*="badge"]:has-text("approved"), [class*="badge"]:has-text("rejected")').first();
    this.approveButton = page.locator('button:has-text("Approve")');
    this.rejectButton = page.locator('button:has-text("Reject")');
    this.driverName = page.locator('h1, h2, [class*="driver-name"]').first();
    this.vehicleInfo = page.locator('[class*="vehicle"], section:has-text("Vehicle")');
    this.documents = page.locator('[class*="document"], section:has-text("Document")');
    this.rideHistory = page.locator('[class*="history"], section:has-text("History"), button:has-text("History")');
    this.disableToggle = page.locator('[class*="toggle"], input[type="checkbox"]:near(:text("Disable"))');
    this.rejectionReasonInput = page.locator('textarea, input[placeholder*="reason" i]');
  }

  async approveDriver() {
    await this.approveButton.click();
    // Confirm dialog if any
    const confirmBtn = this.page.locator('button:has-text("Confirm"), button:has-text("Yes")');
    if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirmBtn.click();
    }
    await this.page.waitForLoadState('domcontentloaded');
  }

  async rejectDriver(reason: string) {
    await this.rejectButton.click();
    if (await this.rejectionReasonInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.rejectionReasonInput.fill(reason);
    }
    const confirmBtn = this.page.locator('button:has-text("Confirm"), button:has-text("Submit"), button:has-text("Reject")').last();
    await confirmBtn.click();
    await this.page.waitForLoadState('domcontentloaded');
  }

  async disableDriver() {
    await this.disableToggle.click();
    await this.page.waitForLoadState('domcontentloaded');
  }

  async getVerificationStatus(): Promise<string> {
    const text = await this.verificationBadge.innerText();
    return text.toLowerCase().trim();
  }

  async viewRideHistory() {
    if (await this.rideHistory.isVisible()) {
      await this.rideHistory.click();
      await this.page.waitForTimeout(1000);
    }
  }
}
