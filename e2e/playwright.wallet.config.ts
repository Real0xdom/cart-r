import { defineConfig } from '@playwright/test';
import * as dotenv from 'dotenv';

dotenv.config();

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  timeout: 60_000,
  use: {
    trace: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
  },
});
