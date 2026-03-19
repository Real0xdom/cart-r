/**
 * Admin Login Page Object (Playwright)
 * Maps to: apps/admin/app/login/page.tsx
 */
import { Page, Locator, expect } from '@playwright/test';

export class AdminLoginPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly loginButton: Locator;
  readonly errorMessage: Locator;
  readonly loadingSpinner: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.locator('input[type="email"], input[name="email"]');
    this.passwordInput = page.locator('input[type="password"], input[name="password"]');
    this.loginButton = page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign In")');
    this.errorMessage = page.locator('[class*="error"], [role="alert"], .text-red, .bg-red-50');
    this.loadingSpinner = page.locator('[class*="spinner"], [class*="loading"]');

    // Add console listener for debugging
    page.on('console', msg => {
      if (msg.type() === 'error' || msg.text().includes('CLIENT:')) {
        console.log(`BROWSER CONSOLE [${msg.type()}]: ${msg.text()}`);
      }
    });
  }

  async goto() {
    await this.page.goto('/login');
    await this.page.waitForLoadState('domcontentloaded');
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    
    // Wait for the login API response
    const responsePromise = this.page.waitForResponse(response => 
      response.url().includes('/api/auth/login') && response.request().method() === 'POST'
    );
    
    await this.loginButton.click();
    await responsePromise;

    // Wait for navigation away from login page
    await this.page.waitForURL(url => !url.href.includes('/login'), { timeout: 15_000 });
  }

  async loginAndVerify(email: string, password: string) {
    await this.login(email, password);
    // Should NOT be on login page anymore
    await expect(this.page).not.toHaveURL(/\/login/);
  }

  async loginExpectError(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.loginButton.click();
    await expect(this.errorMessage).toBeVisible({ timeout: 5_000 });
  }

  async isOnLoginPage(): Promise<boolean> {
    return this.page.url().includes('/login');
  }
}
