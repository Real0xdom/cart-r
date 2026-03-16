import { expect } from 'chai';
import { loadEnv, env } from '../../configs/env';
import { startAndroidSession, stopSession } from '../../configs/mobile/appium';
import { DriverAuthPage } from './pages/auth.page';
import { DriverRequestsFlow } from './pages/requests.flow';

/**
 * Driver App Happy Flow (UI)
 */

describe('Driver APK - Happy Flow', function () {
  this.timeout(15 * 60 * 1000);

  let driver: any;

  before(async () => {
    loadEnv();
    driver = await startAndroidSession('driver');
  });

  after(async () => {
    await stopSession(driver);
  });

  it('login -> go online -> accept request -> open earnings', async () => {
    const auth = new DriverAuthPage(driver);
    await auth.loginWithOtp(env.driverPhone(), env.driverOtp());

    const requests = new DriverRequestsFlow(driver);
    await requests.goOnline();
    await requests.openRequestsTab();
    await requests.acceptFirstRequest();

    // Earnings/payout screen
    const tabEarnings = await driver.$('android=new UiSelector().textContains("Earnings")');
    if (await tabEarnings.isExisting()) {
      await tabEarnings.click();
    }

    const payoutMarker = await driver.$('android=new UiSelector().textContains("earn")');
    expect(await payoutMarker.isExisting()).to.equal(true);
  });
});
