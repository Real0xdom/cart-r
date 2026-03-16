import type { Browser } from 'webdriverio';

export async function waitForAny(driver: Browser<'async'>, selectors: string[], timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  let lastErr: unknown;

  while (Date.now() < deadline) {
    for (const sel of selectors) {
      try {
        const el = await driver.$(sel);
        if (await el.isExisting()) {
          return el;
        }
      } catch (e) {
        lastErr = e;
      }
    }
    await driver.pause(500);
  }

  throw new Error(`waitForAny timed out. selectors=${JSON.stringify(selectors)} lastErr=${String(lastErr)}`);
}

export async function tapByAny(driver: Browser<'async'>, selectors: string[], timeoutMs = 30_000) {
  const el = await waitForAny(driver, selectors, timeoutMs);
  await el.click();
}

export async function typeByAny(driver: Browser<'async'>, selectors: string[], value: string, timeoutMs = 30_000) {
  const el = await waitForAny(driver, selectors, timeoutMs);
  await el.click();
  await el.clearValue();
  await el.setValue(value);
}