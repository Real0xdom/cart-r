import { remote, type Browser } from 'webdriverio';
import { loadEnv, env } from '../env';

export type AppUnderTest = 'customer' | 'driver';

export interface AndroidAppConfig {
  apkPath: string;
  appPackage?: string;
  appActivity?: string;
}

function parseServerUrl(url: string): { hostname: string; port: number; path: string; protocol: 'http' | 'https' } {
  const u = new URL(url);
  return {
    hostname: u.hostname,
    port: Number(u.port || (u.protocol === 'https:' ? 443 : 80)),
    path: u.pathname && u.pathname.length > 0 ? u.pathname : '/',
    protocol: u.protocol === 'https:' ? 'https' : 'http',
  };
}

export function buildAndroidCaps(app: AndroidAppConfig) {
  const caps: Record<string, any> = {
    platformName: 'Android',
    'appium:automationName': 'UiAutomator2',
    'appium:deviceName': env.androidDeviceName(),
    'appium:app': app.apkPath,
    'appium:noReset': false,
    'appium:newCommandTimeout': 300,
    'appium:autoGrantPermissions': true,
  };

  const udid = env.androidUdid();
  if (udid) caps['appium:udid'] = udid;

  if (app.appPackage) caps['appium:appPackage'] = app.appPackage;
  if (app.appActivity) caps['appium:appActivity'] = app.appActivity;

  return caps;
}

export async function startAndroidSession(appName: AppUnderTest): Promise<Browser<'async'>> {
  loadEnv();

  const appConfig: AndroidAppConfig =
    appName === 'customer'
      ? {
          apkPath: env.customerApkPath(),
          appPackage: env.customerAppPackage(),
          appActivity: env.customerAppActivity(),
        }
      : {
          apkPath: env.driverApkPath(),
          appPackage: env.driverAppPackage(),
          appActivity: env.driverAppActivity(),
        };

  const { hostname, port, path, protocol } = parseServerUrl(env.appiumServerUrl());
  return remote({
    protocol,
    hostname,
    port,
    path,
    logLevel: 'info',
    capabilities: buildAndroidCaps(appConfig),
  });
}

export async function stopSession(driver?: Browser<'async'>): Promise<void> {
  if (!driver) return;
  try {
    await driver.deleteSession();
  } catch {
    // ignore
  }
}