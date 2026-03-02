/**
 * Customer App Page Objects (Appium / WebdriverIO)
 * Skeleton page objects for mobile app E2E testing.
 * These require Appium server running + Android emulator with Customer APK installed.
 */

// =====================================================
// SignInPage
// =====================================================
export class CustomerSignInPage {
  constructor(private driver: WebdriverIO.Browser) {}

  get phoneInput() { return this.driver.$('~phone-input'); }
  get sendOtpButton() { return this.driver.$('~send-otp-button'); }
  get otpInput() { return this.driver.$('~otp-input'); }
  get verifyButton() { return this.driver.$('~verify-button'); }
  get termsCheckbox() { return this.driver.$('~terms-checkbox'); }
  get errorText() { return this.driver.$('~error-text'); }

  async enterPhone(phone: string) {
    await this.phoneInput.waitForDisplayed({ timeout: 10000 });
    await this.phoneInput.setValue(phone);
  }

  async sendOtp() {
    await this.sendOtpButton.waitForDisplayed();
    await this.sendOtpButton.click();
  }

  async enterOtp(otp: string) {
    await this.otpInput.waitForDisplayed({ timeout: 10000 });
    await this.otpInput.setValue(otp);
  }

  async verify() {
    await this.verifyButton.waitForDisplayed();
    await this.verifyButton.click();
  }

  async acceptTerms() {
    if (await this.termsCheckbox.isDisplayed()) {
      await this.termsCheckbox.click();
    }
  }

  async login(phone: string, otp: string) {
    await this.enterPhone(phone);
    await this.sendOtp();
    await this.enterOtp(otp);
    await this.verify();
  }
}

// =====================================================
// HomePage
// =====================================================
export class CustomerHomePage {
  constructor(private driver: WebdriverIO.Browser) {}

  get searchDestination() { return this.driver.$('~search-destination'); }
  get walletBalance() { return this.driver.$('~wallet-balance'); }
  get profileTab() { return this.driver.$('~tab-profile'); }
  get ridesTab() { return this.driver.$('~tab-rides'); }
  get paymentTab() { return this.driver.$('~tab-payment'); }
  get homeTab() { return this.driver.$('~tab-home'); }

  async tapSearchDestination() {
    await this.searchDestination.waitForDisplayed({ timeout: 15000 });
    await this.searchDestination.click();
  }

  async getWalletBalance(): Promise<string> {
    await this.walletBalance.waitForDisplayed({ timeout: 10000 });
    return await this.walletBalance.getText();
  }

  async navigateToProfile() { await this.profileTab.click(); }
  async navigateToRides() { await this.ridesTab.click(); }
  async navigateToPayment() { await this.paymentTab.click(); }
}

// =====================================================
// SelectVehiclePage
// =====================================================
export class CustomerSelectVehiclePage {
  constructor(private driver: WebdriverIO.Browser) {}

  get bikeCard() { return this.driver.$('~vehicle-bike'); }
  get tempoCard() { return this.driver.$('~vehicle-tempo'); }
  get sedanCard() { return this.driver.$('~vehicle-sedan'); }
  get truckCard() { return this.driver.$('~vehicle-truck'); }
  get fareDisplay() { return this.driver.$('~fare-display'); }
  get confirmButton() { return this.driver.$('~confirm-vehicle'); }

  async selectVehicle(type: 'bike' | 'tempo' | 'sedan' | 'truck') {
    const card = this.driver.$(`~vehicle-${type}`);
    await card.waitForDisplayed({ timeout: 10000 });
    await card.click();
  }

  async getFare(): Promise<string> {
    await this.fareDisplay.waitForDisplayed();
    return await this.fareDisplay.getText();
  }

  async confirm() {
    await this.confirmButton.waitForDisplayed();
    await this.confirmButton.click();
  }
}

// =====================================================
// WaitingForDriverPage
// =====================================================
export class CustomerWaitingPage {
  constructor(private driver: WebdriverIO.Browser) {}

  get timer() { return this.driver.$('~waiting-timer'); }
  get cancelButton() { return this.driver.$('~cancel-ride'); }
  get statusText() { return this.driver.$('~status-text'); }
  get retryButton() { return this.driver.$('~retry-button'); }

  async waitForDriverAccept(timeout: number = 30000) {
    await this.statusText.waitForDisplayed({ timeout });
    // Poll until status changes from "Searching..."
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      const text = await this.statusText.getText();
      if (text.toLowerCase().includes('accepted') || text.toLowerCase().includes('found')) {
        return true;
      }
      await this.driver.pause(2000);
    }
    return false;
  }

  async cancelRide() {
    await this.cancelButton.waitForDisplayed();
    await this.cancelButton.click();
    // Confirm cancel dialog
    const confirmBtn = await this.driver.$('~confirm-cancel');
    if (await confirmBtn.isDisplayed()) {
      await confirmBtn.click();
    }
  }

  async retryWithHigherFare() {
    await this.retryButton.waitForDisplayed();
    await this.retryButton.click();
  }
}

// =====================================================
// PayBookingPage
// =====================================================
export class CustomerPayBookingPage {
  constructor(private driver: WebdriverIO.Browser) {}

  get walletPayButton() { return this.driver.$('~pay-wallet'); }
  get cashfreePayButton() { return this.driver.$('~pay-cashfree'); }
  get paymentStatus() { return this.driver.$('~payment-status'); }
  get totalAmount() { return this.driver.$('~total-amount'); }

  async payWithWallet() {
    await this.walletPayButton.waitForDisplayed({ timeout: 10000 });
    await this.walletPayButton.click();
  }

  async getPaymentStatus(): Promise<string> {
    await this.paymentStatus.waitForDisplayed({ timeout: 15000 });
    return await this.paymentStatus.getText();
  }

  async getTotalAmount(): Promise<string> {
    await this.totalAmount.waitForDisplayed();
    return await this.totalAmount.getText();
  }
}
