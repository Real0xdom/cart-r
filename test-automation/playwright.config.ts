import { defineConfig, devices } from '@playwright/test';
import { loadEnv, env } from './configs/env';

loadEnv();

const baseURL = env.adminBaseUrl();

export default defineConfig({
  testDir: './web-tests',
  timeout: 2 * 60 * 1000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ['list'],
    ['allure-playwright'],
  ],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: env.adminStartLocal()
    ? {
        command: `npm --prefix ../apps/admin run build && npm --prefix ../apps/admin run start -- -p ${env.adminPort()}`,
        url: `http://127.0.0.1:${env.adminPort()}`,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      }
    : undefined,
});