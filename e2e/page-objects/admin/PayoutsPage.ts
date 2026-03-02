/**
 * Admin Payouts Page Object (Playwright)
 * Maps to: apps/admin/app/payouts/page.tsx
 */
import { Page, Locator, expect } from '@playwright/test';

export class AdminPayoutsPage {
  readonly page: Page;
  readonly withdrawalTable: Locator;
  readonly withdrawalRows: Locator;
  readonly statusFilter: Locator;
  readonly refreshButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.withdrawalTable = page.locator('table');
    this.withdrawalRows = page.locator('table tbody tr');
    this.statusFilter = page.locator('select, [class*="filter"]');
    this.refreshButton = page.locator('button:has-text("Refresh")');
  }

  async goto() {
    await this.page.goto('/payouts');
    await this.page.waitForLoadState('domcontentloaded');
  }

  async getWithdrawalCount(): Promise<number> {
    // Wait for loading spinner to disappear, then count rows
    await this.page.locator('div.animate-spin').waitFor({ state: 'hidden', timeout: 30_000 }).catch(() => {});
    await this.page.waitForTimeout(500);
    return await this.withdrawalRows.count();
  }

  async approveWithdrawal(index: number = 0) {
    // Ensure we are looking at pending rows only
    await this.filterByStatus('Pending');
    await this.page.waitForTimeout(500);
    const row = this.withdrawalRows.nth(index);
    const approveBtn = row.locator('button:has-text("Approve")');
    await approveBtn.click();
    const confirmBtn = this.page.locator('button:has-text("Confirm"), button:has-text("Yes")');
    if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirmBtn.click();
    }
    await this.page.waitForLoadState('domcontentloaded');
  }

  async rejectWithdrawal(index: number = 0, reason: string = 'Test rejection') {
    // Ensure we are looking at pending rows only
    await this.filterByStatus('Pending');
    await this.page.waitForTimeout(500);
    const row = this.withdrawalRows.nth(index);
    const rejectBtn = row.locator('button:has-text("Reject")');
    await rejectBtn.click();
    const reasonInput = this.page.locator('textarea, input[placeholder*="reason" i]');
    if (await reasonInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await reasonInput.fill(reason);
    }
    const confirmBtn = this.page.locator('button:has-text("Reject & Refund"), button:has-text("Reject"), button:has-text("Confirm")');
    await confirmBtn.first().click();
    await this.page.waitForLoadState('domcontentloaded');
  }

  async processAutoPayout(index: number = 0) {
    const row = this.withdrawalRows.nth(index);
    const processBtn = row.locator('button:has-text("Process"), button:has-text("Payout")');
    await processBtn.click();
    const confirmBtn = this.page.locator('button:has-text("Confirm"), button:has-text("Yes")');
    if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirmBtn.click();
    }
    await this.page.waitForLoadState('domcontentloaded');
  }

  async filterByStatus(status: string) {
    const button = this.page.locator(`button:has-text("${status}")`);
    if (await button.isVisible()) {
      await button.click();
    }
    await this.page.waitForTimeout(500);
  }
}
