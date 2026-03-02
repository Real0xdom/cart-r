/**
 * Driver App Page Objects (Appium / WebdriverIO)
 * Skeleton page objects for mobile app E2E testing.
 * These require Appium server running + Android emulator with Driver APK installed.
 */

// =====================================================
// SignInPage
// =====================================================
export class DriverSignInPage {
  constructor(private driver: WebdriverIO.Browser) {}

  get phoneInput() { return this.driver.$('~phone-input'); }
  get sendOtpButton() { return this.driver.$('~send-otp-button'); }
  get otpInput() { return this.driver.$('~otp-input'); }
  get verifyButton() { return this.driver.$('~verify-button'); }

  async login(phone: string, otp: string) {
    await this.phoneInput.waitForDisplayed({ timeout: 10000 });
    await this.phoneInput.setValue(phone);
    await this.sendOtpButton.click();
    await this.otpInput.waitForDisplayed({ timeout: 10000 });
    await this.otpInput.setValue(otp);
    await this.verifyButton.click();
  }
}

// =====================================================
// HomePage (Driver Dashboard)
// =====================================================
export class DriverHomePage {
  constructor(private driver: WebdriverIO.Browser) {}

  get onlineToggle() { return this.driver.$('~online-toggle'); }
  get statusBadge() { return this.driver.$('~status-badge'); }
  get earningsCard() { return this.driver.$('~earnings-card'); }
  get activeRideBanner() { return this.driver.$('~active-ride-banner'); }
  get requestsTab() { return this.driver.$('~tab-requests'); }
  get earningsTab() { return this.driver.$('~tab-earnings'); }
  get profileTab() { return this.driver.$('~tab-profile'); }

  async goOnline() {
    await this.onlineToggle.waitForDisplayed({ timeout: 10000 });
    const text = await this.statusBadge.getText();
    if (text.toLowerCase().includes('offline')) {
      await this.onlineToggle.click();
    }
  }

  async goOffline() {
    await this.onlineToggle.waitForDisplayed();
    const text = await this.statusBadge.getText();
    if (text.toLowerCase().includes('online')) {
      await this.onlineToggle.click();
    }
  }

  async isOnline(): Promise<boolean> {
    const text = await this.statusBadge.getText();
    return text.toLowerCase().includes('online');
  }

  async hasActiveRide(): Promise<boolean> {
    return await this.activeRideBanner.isDisplayed();
  }
}

// =====================================================
// RideNotificationPage
// =====================================================
export class DriverRideNotificationPage {
  constructor(private driver: WebdriverIO.Browser) {}

  get notification() { return this.driver.$('~ride-notification'); }
  get acceptButton() { return this.driver.$('~accept-ride'); }
  get rejectButton() { return this.driver.$('~reject-ride'); }
  get pickupAddress() { return this.driver.$('~pickup-address'); }
  get fareAmount() { return this.driver.$('~fare-amount'); }
  get timer() { return this.driver.$('~notification-timer'); }

  async waitForNotification(timeout: number = 30000) {
    await this.notification.waitForDisplayed({ timeout });
  }

  async acceptRide() {
    await this.acceptButton.waitForDisplayed();
    await this.acceptButton.click();
  }

  async rejectRide() {
    await this.rejectButton.waitForDisplayed();
    await this.rejectButton.click();
  }

  async getPickupAddress(): Promise<string> {
    return await this.pickupAddress.getText();
  }
}

// =====================================================
// ActiveRidePage
// =====================================================
export class DriverActiveRidePage {
  constructor(private driver: WebdriverIO.Browser) {}

  get statusBadge() { return this.driver.$('~ride-status-badge'); }
  get actionButton() { return this.driver.$('~ride-action-button'); }
  get navigateButton() { return this.driver.$('~navigate-button'); }
  get callButton() { return this.driver.$('~call-customer'); }
  get cancelButton() { return this.driver.$('~cancel-ride'); }
  get otpInput() { return this.driver.$('~otp-input'); }
  get verifyOtpButton() { return this.driver.$('~verify-otp'); }

  async getStatus(): Promise<string> {
    await this.statusBadge.waitForDisplayed({ timeout: 10000 });
    return await this.statusBadge.getText();
  }

  async markArrived() {
    await this.actionButton.waitForDisplayed();
    await this.actionButton.click(); // "I've Arrived" button
  }

  async verifyOtpAndStartTrip(otp: string) {
    await this.otpInput.waitForDisplayed({ timeout: 10000 });
    await this.otpInput.setValue(otp);
    await this.verifyOtpButton.click();
  }

  async completeTrip() {
    await this.actionButton.waitForDisplayed();
    await this.actionButton.click(); // "Complete Trip" button
  }

  async cancelRide(reason: string = 'Test cancellation') {
    await this.cancelButton.waitForDisplayed();
    await this.cancelButton.click();
    // Fill reason in dialog
    const reasonInput = await this.driver.$('~cancel-reason-input');
    if (await reasonInput.isDisplayed()) {
      await reasonInput.setValue(reason);
    }
    const confirmBtn = await this.driver.$('~confirm-cancel');
    await confirmBtn.click();
  }

  async openNavigation() {
    await this.navigateButton.waitForDisplayed();
    await this.navigateButton.click();
  }

  async callCustomer() {
    await this.callButton.waitForDisplayed();
    await this.callButton.click();
  }
}

// =====================================================
// CollectPaymentPage
// =====================================================
export class DriverCollectPaymentPage {
  constructor(private driver: WebdriverIO.Browser) {}

  get cashButton() { return this.driver.$('~pay-cash'); }
  get onlineButton() { return this.driver.$('~pay-online'); }
  get qrButton() { return this.driver.$('~show-qr'); }
  get completeButton() { return this.driver.$('~complete-trip'); }
  get totalAmount() { return this.driver.$('~total-amount'); }
  get deliveryOtpInput() { return this.driver.$('~delivery-otp-input'); }
  get verifyDeliveryOtp() { return this.driver.$('~verify-delivery-otp'); }

  async collectCash() {
    await this.cashButton.waitForDisplayed();
    await this.cashButton.click();
  }

  async showQrCode() {
    await this.qrButton.waitForDisplayed();
    await this.qrButton.click();
  }

  async requestOnlinePayment() {
    await this.onlineButton.waitForDisplayed();
    await this.onlineButton.click();
  }

  async verifyDeliveryOtpAndComplete(otp: string) {
    await this.deliveryOtpInput.waitForDisplayed();
    await this.deliveryOtpInput.setValue(otp);
    await this.verifyDeliveryOtp.click();
  }

  async completeTrip() {
    await this.completeButton.waitForDisplayed();
    await this.completeButton.click();
    // Confirm dialog if any
    const confirmBtn = await this.driver.$('~confirm-complete');
    if (await confirmBtn.isDisplayed()) {
      await confirmBtn.click();
    }
  }
}

// =====================================================
// EarningsPage
// =====================================================
export class DriverEarningsPage {
  constructor(private driver: WebdriverIO.Browser) {}

  get pendingBalance() { return this.driver.$('~pending-balance'); }
  get availableBalance() { return this.driver.$('~available-balance'); }
  get withdrawButton() { return this.driver.$('~withdraw-button'); }
  get transactionList() { return this.driver.$('~transaction-list'); }
  get withdrawAmountInput() { return this.driver.$('~withdraw-amount'); }
  get submitWithdrawButton() { return this.driver.$('~submit-withdraw'); }

  async getAvailableBalance(): Promise<string> {
    await this.availableBalance.waitForDisplayed({ timeout: 10000 });
    return await this.availableBalance.getText();
  }

  async getPendingBalance(): Promise<string> {
    await this.pendingBalance.waitForDisplayed();
    return await this.pendingBalance.getText();
  }

  async requestWithdrawal(amount: number) {
    await this.withdrawButton.waitForDisplayed();
    await this.withdrawButton.click();
    await this.withdrawAmountInput.waitForDisplayed();
    await this.withdrawAmountInput.setValue(String(amount));
    await this.submitWithdrawButton.click();
  }
}
