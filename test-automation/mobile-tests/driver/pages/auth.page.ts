import type { Browser } from 'webdriverio';
import { tapByAny, typeByAny, waitForAny } from '../../support/selectors';

export class DriverAuthPage {
  constructor(private driver: Browser<'async'>) {}

  async loginWithOtp(phone: string, otp: string) {
    await typeByAny(this.driver, ['~auth.phoneInput', 'android=new UiSelector().className("android.widget.EditText")'], phone);
    await tapByAny(this.driver, ['~auth.requestOtpButton', 'android=new UiSelector().textContains("OTP")', 'android=new UiSelector().textContains("Get")']);

    await typeByAny(this.driver, ['~auth.otpInput'], otp);
    await tapByAny(this.driver, ['~auth.verifyOtpButton', 'android=new UiSelector().textContains("Verify")']);

    await waitForAny(this.driver, ['~driver.home', 'android=new UiSelector().textContains("Active")', 'android=new UiSelector().textContains("Requests")'], 60_000);
  }
}