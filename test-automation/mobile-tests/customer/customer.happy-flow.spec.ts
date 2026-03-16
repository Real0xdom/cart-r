import { expect } from 'chai';
import { loadEnv, env } from '../../configs/env';
import { startAndroidSession, stopSession } from '../../configs/mobile/appium';
import { CustomerAuthPage } from './pages/auth.page';
import { CustomerBookingFlow } from './pages/booking.flow';

/**
 * Customer App Happy Flow (UI)
 *
 * IMPORTANT: To make this CI-stable, add accessibility ids/testIDs to critical elements.
 * The flow helpers try accessibility ids first and then fall back to text-based selectors.
 */

describe('Customer APK - Happy Flow', function () {
  this.timeout(15 * 60 * 1000);

  let driver: any;

  before(async () => {
    loadEnv();
    driver = await startAndroidSession('customer');
  });

  after(async () => {
    await stopSession(driver);
  });

  it('login -> create booking -> reach matching', async () => {
    const auth = new CustomerAuthPage(driver);
    await auth.loginWithOtp(env.customerPhone(), env.customerOtp());

    const booking = new CustomerBookingFlow(driver);
    await booking.startNewBooking();
    await booking.setPickupAndDrop(env.testPickupQuery(), env.testDropQuery());
    await booking.setReceiverDetails('Test Receiver', '9999999999');
    await booking.chooseFirstVehicleAndBook();

    // Minimal assertion: we are on waiting/matching screen.
    const marker = await driver.$('android=new UiSelector().textContains("Driver")');
    expect(await marker.isExisting()).to.equal(true);
  });
});
