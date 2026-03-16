import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

export type TargetEnv = 'staging' | 'production';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function resolveFromProjectRoot(...parts: string[]): string {
  // configs/* lives under test-automation/, so project root is one level up.
  return path.resolve(__dirname, '..', ...parts);
}

export function loadEnv(): void {
  const targetEnv = (process.env.TARGET_ENV ?? 'staging') as TargetEnv;

  // Load env in increasing precedence order.
  dotenv.config({ path: resolveFromProjectRoot(`.env.${targetEnv}`) });
  dotenv.config({ path: resolveFromProjectRoot('.env.local') });
  dotenv.config();
}

function required(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required env var: ${name}`);
  return val;
}

function optional(name: string): string | undefined {
  const val = process.env[name];
  return val && val.length > 0 ? val : undefined;
}

function digitsOnly(phone: string): string {
  return phone.replace(/\D/g, '');
}

function normalizeCustomerPhone(input: string): string {
  const d = digitsOnly(input);
  return d.length > 10 ? d.slice(-10) : d;
}

function normalizeDriverPhone(input: string): string {
  const trimmed = input.trim();
  if (trimmed.startsWith('+')) return trimmed;
  const d = digitsOnly(trimmed);
  if (d.length === 10) return `+91${d}`;
  return trimmed;
}

export const env = {
  targetEnv(): TargetEnv {
    return (process.env.TARGET_ENV ?? 'staging') as TargetEnv;
  },

  appiumServerUrl(): string {
    return optional('APPIUM_SERVER_URL') ?? 'http://127.0.0.1:4723';
  },

  androidDeviceName(): string {
    return optional('ANDROID_DEVICE_NAME') ?? 'Android Emulator';
  },

  androidUdid(): string | undefined {
    return optional('ANDROID_UDID');
  },

  customerApkPath(): string {
    return required('CUSTOMER_APK_PATH');
  },

  driverApkPath(): string {
    return required('DRIVER_APK_PATH');
  },

  customerAppPackage(): string | undefined {
    return optional('CUSTOMER_APP_PACKAGE');
  },

  customerAppActivity(): string | undefined {
    return optional('CUSTOMER_APP_ACTIVITY');
  },

  driverAppPackage(): string | undefined {
    return optional('DRIVER_APP_PACKAGE');
  },

  driverAppActivity(): string | undefined {
    return optional('DRIVER_APP_ACTIVITY');
  },

  customerPhone(): string {
    return normalizeCustomerPhone(required('CUSTOMER_PHONE'));
  },

  customerOtp(): string {
    return required('CUSTOMER_OTP');
  },

  driverPhone(): string {
    return normalizeDriverPhone(required('DRIVER_PHONE'));
  },

  driverOtp(): string {
    return required('DRIVER_OTP');
  },

  testPickupQuery(): string {
    return optional('TEST_PICKUP_QUERY') ?? 'Pune Railway Station';
  },

  testDropQuery(): string {
    return optional('TEST_DROP_QUERY') ?? 'Pune Airport';
  },

  adminBaseUrl(): string {
    return required('ADMIN_BASE_URL');
  },

  adminEmail(): string {
    return required('ADMIN_EMAIL');
  },

  adminPassword(): string {
    return required('ADMIN_PASSWORD');
  },

  adminStartLocal(): boolean {
    return (optional('ADMIN_START_LOCAL') ?? '0') === '1';
  },

  adminPort(): number {
    return Number(optional('ADMIN_PORT') ?? '3000');
  },
};
