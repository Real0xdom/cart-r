/**
 * Wait / Polling Utilities
 * Retry-based wait functions for async state transitions.
 */
import { TIMEOUTS } from '../config/constants';

/**
 * Poll a function until it returns a truthy value or times out.
 */
export async function waitUntil<T>(
  fn: () => Promise<T>,
  options: {
    timeout?: number;
    interval?: number;
    message?: string;
  } = {}
): Promise<T> {
  const timeout = options.timeout || TIMEOUTS.MEDIUM;
  const interval = options.interval || TIMEOUTS.POLLING_INTERVAL;
  const message = options.message || 'waitUntil timed out';
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      const result = await fn();
      if (result) return result;
    } catch (e) {
      // Ignore errors during polling — keep trying
    }
    await sleep(interval);
  }

  throw new Error(`${message} (waited ${timeout}ms)`);
}

/**
 * Wait for a specific booking status in the database.
 */
export async function waitForBookingStatus(
  getBookingStatus: (id: string) => Promise<string>,
  bookingId: string,
  expectedStatus: string,
  timeout: number = TIMEOUTS.LONG
): Promise<void> {
  await waitUntil(
    async () => {
      const status = await getBookingStatus(bookingId);
      return status === expectedStatus ? true : null;
    },
    {
      timeout,
      interval: TIMEOUTS.POLLING_INTERVAL,
      message: `Booking ${bookingId} did not reach status "${expectedStatus}"`,
    }
  );
}

/**
 * Wait for a payment status in the database.
 */
export async function waitForPaymentStatus(
  getPaymentStatus: (id: string) => Promise<string>,
  bookingId: string,
  expectedStatus: string,
  timeout: number = TIMEOUTS.LONG
): Promise<void> {
  await waitUntil(
    async () => {
      const status = await getPaymentStatus(bookingId);
      return status === expectedStatus ? true : null;
    },
    {
      timeout,
      interval: TIMEOUTS.POLLING_INTERVAL,
      message: `Payment for booking ${bookingId} did not reach status "${expectedStatus}"`,
    }
  );
}

/**
 * Wait for a condition to be truthy, with custom error message.
 */
export async function waitForCondition(
  conditionFn: () => Promise<boolean>,
  description: string,
  timeout: number = TIMEOUTS.MEDIUM
): Promise<void> {
  await waitUntil(
    async () => (await conditionFn()) ? true : null,
    { timeout, message: `Condition not met: ${description}` }
  );
}

/**
 * Retry a function up to N times with a delay between attempts.
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      if (attempt < maxAttempts) {
        console.log(`Retry ${attempt}/${maxAttempts} failed: ${err.message}. Retrying in ${delayMs}ms...`);
        await sleep(delayMs);
      }
    }
  }

  throw lastError || new Error('All retry attempts failed');
}

/**
 * Simple sleep function.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
