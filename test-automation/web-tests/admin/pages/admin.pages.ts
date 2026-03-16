import { expect, type Page } from '@playwright/test';

export class AdminLoginPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/login');
  }

  async login(email: string, password: string) {
    await this.page.getByLabel('Email Address').fill(email);
    await this.page.getByLabel('Password').fill(password);
    await this.page.getByRole('button', { name: 'Sign In' }).click();
    await expect(this.page).toHaveURL(/\/$/);
  }
}

export class AdminNav {
  constructor(private page: Page) {}

  async openBookings() {
    await this.page.goto('/bookings');
    await expect(this.page.getByRole('heading', { name: 'Bookings' })).toBeVisible();
  }

  async openDrivers() {
    await this.page.goto('/drivers');
    await expect(this.page.getByRole('heading', { name: 'Drivers' })).toBeVisible();
  }

  async openUsers() {
    await this.page.goto('/users');
    await expect(this.page.getByRole('heading', { name: 'Users' })).toBeVisible();
  }

  async openFinance() {
    await this.page.goto('/finance');
    await expect(this.page.getByRole('heading', { name: 'Finance' })).toBeVisible();
  }
}