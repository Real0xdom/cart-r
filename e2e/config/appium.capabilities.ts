/**
 * Appium device capabilities for Customer and Driver apps
 */

export const customerAppCapabilities = {
  platformName: 'Android',
  'appium:deviceName': process.env.CUSTOMER_DEVICE || 'emulator-5554',
  'appium:app': process.env.CUSTOMER_APK_PATH || '../apps/customer/android/app/build/outputs/apk/debug/app-debug.apk',
  'appium:automationName': 'UiAutomator2',
  'appium:appPackage': 'com.carter.customer',
  'appium:appActivity': '.MainActivity',
  'appium:noReset': false,
  'appium:fullReset': false,
  'appium:newCommandTimeout': 300,
  'appium:autoGrantPermissions': true,
  'appium:disableWindowAnimation': true,
};

export const driverAppCapabilities = {
  platformName: 'Android',
  'appium:deviceName': process.env.DRIVER_DEVICE || 'emulator-5556',
  'appium:app': process.env.DRIVER_APK_PATH || '../apps/driver/android/app/build/outputs/apk/debug/app-debug.apk',
  'appium:automationName': 'UiAutomator2',
  'appium:appPackage': 'com.carter.driver',
  'appium:appActivity': '.MainActivity',
  'appium:noReset': false,
  'appium:fullReset': false,
  'appium:newCommandTimeout': 300,
  'appium:autoGrantPermissions': true,
  'appium:disableWindowAnimation': true,
};

/**
 * BrowserStack capabilities (optional — for cloud device farm)
 */
export const browserStackCapabilities = {
  'bstack:options': {
    userName: process.env.BROWSERSTACK_USERNAME || '',
    accessKey: process.env.BROWSERSTACK_ACCESS_KEY || '',
    projectName: 'CARTR',
    buildName: `E2E-${new Date().toISOString().slice(0, 10)}`,
    sessionName: 'Automated Test',
    debug: true,
    networkLogs: true,
    deviceLogs: true,
  },
};
