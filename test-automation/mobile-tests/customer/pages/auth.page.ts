import type { Browser } from 'webdriverio';
import { tapByAny, typeByAny, waitForAny } from '../../support/selectors';

export class CustomerAuthPage {
  constructor(private driver: Browser<'async'>) {}

  async loginWithOtp(phone: string, otp: string) {
    await typeByAny(this.driver, ['~auth.phoneInput', 'android=new UiSelector().className("android.widget.EditText")'], phone);
    await tapByAny(this.driver, ['~auth.requestOtpButton', 'android=new UiSelector().textContains("OTP")', 'android=new UiSelector().textContains("Get")']);

    await typeByAny(this.driver, ['~auth.otpInput'], otp);
    await tapByAny(this.driver, ['~auth.verifyOtpButton', 'android=new UiSelector().textContains("Verify")']);

    await waitForAny(this.driver, ['~customer.home', 'android=new UiSelector().textContains("Book")', 'android=new UiSelector().textContains("Start")'], 60_000);
  }
}