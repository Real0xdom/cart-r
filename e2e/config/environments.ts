/**
 * Environment configuration for E2E tests
 * Supports dev, staging, and production environments
 */
import * as dotenv from 'dotenv';
dotenv.config();

export interface EnvironmentConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceKey: string;
  adminUrl: string;
  cashfreeEnv: 'sandbox' | 'production';
  testCustomerPhone: string;
  testDriverPhone: string;
  testOtp: string;
  adminEmail: string;
  adminPassword: string;
}

const environments: Record<string, EnvironmentConfig> = {
  dev: {
    supabaseUrl: process.env.SUPABASE_URL || '',
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
    supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    adminUrl: process.env.ADMIN_URL || 'http://localhost:3000',
    cashfreeEnv: (process.env.CASHFREE_ENV as 'sandbox' | 'production') || 'sandbox',
    testCustomerPhone: process.env.TEST_CUSTOMER_PHONE || '+919999900001',
    testDriverPhone: process.env.TEST_DRIVER_PHONE || '+919999900002',
    testOtp: process.env.TEST_OTP || '123456',
    adminEmail: process.env.ADMIN_EMAIL || 'admin@cartr.com',
    adminPassword: process.env.ADMIN_PASSWORD || '',
  },
  staging: {
    supabaseUrl: process.env.STAGING_SUPABASE_URL || '',
    supabaseAnonKey: process.env.STAGING_SUPABASE_ANON_KEY || '',
    supabaseServiceKey: process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY || '',
    adminUrl: process.env.STAGING_ADMIN_URL || '',
    cashfreeEnv: 'sandbox',
    testCustomerPhone: '+919999900001',
    testDriverPhone: '+919999900002',
    testOtp: '123456',
    adminEmail: process.env.STAGING_ADMIN_EMAIL || '',
    adminPassword: process.env.STAGING_ADMIN_PASSWORD || '',
  },
};

const currentEnv = process.env.TEST_ENV || 'dev';

export const env: EnvironmentConfig = environments[currentEnv] || environments.dev;
export default env;
