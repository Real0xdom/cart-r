import { describe, expect, it, beforeAll, afterAll } from '@playwright/test';

import { callCreatePaymentOrder } from '../../helpers/api-client';
import * as db from '../../helpers/supabase-admin';
import { TEST_LOCATIONS } from '../../config/constants';

const TEST_RUN_ID = `driver_wallet_gate_${Date.now()}`;

function toNumber(value: unknown): number {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    return Number(value);
  }

  return Number.NaN;
}

describe('Driver Wallet Release Gate - staging integration', () => {
  let customerId: string;
  let driverId: string;
  let driverUserId: string;
  let originalCommissionSetting: any;

  beforeAll(async () => {
    await db.seedFareConfig();
    originalCommissionSetting = await db.getPlatformSetting('commission');

    const customer = await db.createTestCustomer({
      phone: '+919810010001',
      name: 'Wallet Gate Customer',
      email: 'wallet_gate_customer@cartr.test',
      testRunId: TEST_RUN_ID,
    });
    customerId = customer.userId;

    const driver = await db.createTestDriver({
      phone: '+919810010002',
      name: 'Wallet Gate Driver',
      vehicleType: 'sedan',
      verificationStatus: 'approved',
      isOnline: true,
      latitude: TEST_LOCATIONS.MUMBAI_ANDHERI.latitude,
      longitude: TEST_LOCATIONS.MUMBAI_ANDHERI.longitude,
      testRunId: TEST_RUN_ID,
    });
    driverId = driver.driverId;
    driverUserId = driver.userId;

    await db.setPlatformSetting('commission', {
      default_rate: 15,
      by_vehicle_type: {},
    }, originalCommissionSetting?.description || 'Wallet release gate commission setting');

    await db.setDriverWalletState(driverId, {
      availableBalance: 0,
      pendingBalance: 0,
      totalEarned: 0,
      totalWithdrawn: 0,
      totalCommissionOwed: 0,
    });
  });

  afterAll(async () => {
    if (originalCommissionSetting) {
      await db.setPlatformSetting(
        'commission',
        originalCommissionSetting.value,
        originalCommissionSetting.description
      );
    }

    await db.cleanupTestData(TEST_RUN_ID);
  });

  it('creates a driver wallet top-up order and persists the pending transaction', async () => {
    const response = await callCreatePaymentOrder({
      customer_id: driverUserId,
      customer_name: 'Wallet Gate Driver',
      customer_phone: '9810010002',
      customer_email: 'wallet_gate_driver@cartr.test',
      amount: 300,
      topup_target: 'driver_wallet',
    });

    expect(response.ok).toBe(true);
    expect(response.data.order_id).toMatch(/^DRIVERWALLET_/);

    const client = db.getSupabaseAdmin();
    const { data: transaction, error } = await client
      .from('wallet_transactions')
      .select('*')
      .eq('payment_order_id', response.data.order_id)
      .single();

    expect(error).toBeNull();
    expect(transaction).toBeTruthy();
    expect(transaction?.description).toBe('Driver wallet top-up');
    expect(transaction?.status).toBe('pending');
    expect(toNumber(transaction?.amount)).toBe(300);
  });

  it('credits a driver wallet top-up atomically exactly once and reduces commission debt', async () => {
    const client = db.getSupabaseAdmin();
    const orderId = `DRIVERWALLET_MANUAL_${Date.now()}`;

    await db.setDriverWalletState(driverId, {
      availableBalance: -200,
      pendingBalance: 0,
      totalEarned: 0,
      totalWithdrawn: 0,
      totalCommissionOwed: 200,
    });
    await db.createPendingWalletTopupTransaction(driverUserId, 300, orderId);

    const firstAttempt = await client.rpc('atomic_credit_driver_wallet_topup_idempotent', {
      p_user_id: driverUserId,
      p_amount: 300,
      p_order_id: orderId,
    });
    const secondAttempt = await client.rpc('atomic_credit_driver_wallet_topup_idempotent', {
      p_user_id: driverUserId,
      p_amount: 300,
      p_order_id: orderId,
    });

    expect(firstAttempt.error).toBeNull();
    expect(firstAttempt.data).toBe(true);
    expect(secondAttempt.error).toBeNull();
    expect(secondAttempt.data).toBe(false);

    const wallet = await db.getDriverWalletRecord(driverId);
    expect(toNumber(wallet.available_balance)).toBe(100);
    expect(toNumber((wallet as any).total_commission_owed)).toBe(0);

    const ledgerEntries = await db.getDriverWalletTransactions(driverId, {
      referenceId: orderId,
      type: 'adjustment',
    });

    expect(ledgerEntries).toHaveLength(1);
    expect(ledgerEntries[0].metadata?.source).toBe('driver_wallet_topup');
  });

  it('allows drivers at -99.99 and -100.00, but blocks them at -100.01', async () => {
    const client = db.getSupabaseAdmin();

    await db.setDriverWalletState(driverId, {
      availableBalance: -99.99,
      totalCommissionOwed: 99.99,
    });
    const bookingAboveThreshold = await db.createTestBooking({
      customerId,
      status: 'pending',
      vehicleType: 'sedan',
      origin: TEST_LOCATIONS.MUMBAI_ANDHERI,
      destination: TEST_LOCATIONS.MUMBAI_BANDRA,
      totalFare: 250,
    });
    const aboveThresholdResult = await client.rpc('accept_booking_atomic', {
      p_booking_id: bookingAboveThreshold.bookingId,
      p_driver_id: driverId,
    });

    expect(aboveThresholdResult.error).toBeNull();
    expect(aboveThresholdResult.data?.success).toBe(true);
    await db.deleteBooking(bookingAboveThreshold.bookingId);

    await db.setDriverWalletState(driverId, {
      availableBalance: -100,
      totalCommissionOwed: 100,
    });
    const exactThresholdBooking = await db.createTestBooking({
      customerId,
      status: 'pending',
      vehicleType: 'sedan',
      origin: TEST_LOCATIONS.MUMBAI_ANDHERI,
      destination: TEST_LOCATIONS.MUMBAI_BANDRA,
      totalFare: 250,
    });
    const exactThresholdResult = await client.rpc('accept_booking_atomic', {
      p_booking_id: exactThresholdBooking.bookingId,
      p_driver_id: driverId,
    });

    expect(exactThresholdResult.error).toBeNull();
    expect(exactThresholdResult.data?.success).toBe(true);
    await db.deleteBooking(exactThresholdBooking.bookingId);

    await db.setDriverWalletState(driverId, {
      availableBalance: -100.01,
      totalCommissionOwed: 100.01,
    });
    const blockedBooking = await db.createTestBooking({
      customerId,
      status: 'pending',
      vehicleType: 'sedan',
      origin: TEST_LOCATIONS.MUMBAI_ANDHERI,
      destination: TEST_LOCATIONS.MUMBAI_BANDRA,
      totalFare: 250,
    });
    const blockedResult = await client.rpc('accept_booking_atomic', {
      p_booking_id: blockedBooking.bookingId,
      p_driver_id: driverId,
    });

    expect(blockedResult.error).toBeNull();
    expect(blockedResult.data?.success).toBe(false);
    expect(blockedResult.data?.error).toBe('wallet_recharge_required');
    expect(toNumber(blockedResult.data?.current_balance)).toBeCloseTo(-100.01, 2);
    expect(toNumber(blockedResult.data?.required_recharge)).toBeCloseTo(200.01, 2);

    const walletInfo = await db.getDriverWalletInfoRpc(driverId);
    expect(walletInfo.wallet.requires_recharge).toBe(true);
    expect(walletInfo.wallet.has_negative_balance).toBe(true);

    await db.deleteBooking(blockedBooking.bookingId);
  });

  it('deducts cash commission into negative balance and tracks commission debt in the wallet ledger', async () => {
    const client = db.getSupabaseAdmin();

    await db.setPlatformSetting('commission', {
      default_rate: 15,
      by_vehicle_type: {},
    }, originalCommissionSetting?.description || null);
    await db.setDriverWalletState(driverId, {
      availableBalance: 50,
      totalCommissionOwed: 0,
      totalEarned: 0,
      totalWithdrawn: 0,
    });

    const booking = await db.createTestBooking({
      customerId,
      driverId,
      status: 'completed',
      vehicleType: 'sedan',
      totalFare: 800,
      paymentMethod: 'cash',
      paymentStatus: 'pending',
      origin: TEST_LOCATIONS.MUMBAI_ANDHERI,
      destination: TEST_LOCATIONS.MUMBAI_BANDRA,
    });

    const creditResult = await client.rpc('credit_driver_earning', {
      p_driver_id: driverId,
      p_booking_id: booking.bookingId,
      p_total_fare: 800,
      p_is_cash: true,
    });

    expect(creditResult.error).toBeNull();
    expect(creditResult.data?.success).toBe(true);
    expect(toNumber(creditResult.data?.platform_fee)).toBe(120);
    expect(toNumber(creditResult.data?.driver_share)).toBe(680);

    const wallet = await db.getDriverWalletRecord(driverId);
    expect(toNumber(wallet.available_balance)).toBe(-70);
    expect(toNumber((wallet as any).total_commission_owed)).toBe(70);

    const transactions = await db.getDriverWalletTransactions(driverId, {
      bookingId: booking.bookingId,
    });

    const platformFeeTransaction = transactions.find((txn) => txn.type === 'platform_fee');
    const earningTransaction = transactions.find((txn) => txn.type === 'earning');

    expect(toNumber(platformFeeTransaction?.amount)).toBe(120);
    expect(toNumber(earningTransaction?.amount)).toBe(680);

    const walletInfo = await db.getDriverWalletInfoRpc(driverId);
    expect(walletInfo.wallet.has_negative_balance).toBe(true);
    expect(walletInfo.wallet.requires_recharge).toBe(false);
    expect(Array.isArray(walletInfo.recent_transactions)).toBe(true);
    expect(walletInfo.recent_transactions.some((txn: any) => txn.booking_id === booking.bookingId)).toBe(true);
  });

  it('uses vehicle-specific commission overrides in backend wallet settlement', async () => {
    const client = db.getSupabaseAdmin();

    await db.setPlatformSetting('commission', {
      default_rate: 18,
      by_vehicle_type: {
        bike: 10,
      },
    }, originalCommissionSetting?.description || null);
    await db.setDriverWalletState(driverId, {
      availableBalance: 1000,
      totalCommissionOwed: 0,
      totalEarned: 0,
      totalWithdrawn: 0,
    });

    const booking = await db.createTestBooking({
      customerId,
      driverId,
      status: 'completed',
      vehicleType: 'bike',
      totalFare: 500,
      paymentMethod: 'cash',
      paymentStatus: 'pending',
      origin: TEST_LOCATIONS.MUMBAI_ANDHERI,
      destination: TEST_LOCATIONS.MUMBAI_BANDRA,
    });

    const creditResult = await client.rpc('credit_driver_earning', {
      p_driver_id: driverId,
      p_booking_id: booking.bookingId,
      p_total_fare: 500,
      p_is_cash: true,
    });

    expect(creditResult.error).toBeNull();
    expect(toNumber(creditResult.data?.platform_fee)).toBe(50);
    expect(toNumber(creditResult.data?.commission_rate)).toBe(10);

    const platformFeeTransactions = await db.getDriverWalletTransactions(driverId, {
      bookingId: booking.bookingId,
      type: 'platform_fee',
    });

    expect(platformFeeTransactions).toHaveLength(1);
    expect(toNumber(platformFeeTransactions[0].amount)).toBe(50);

    const updatedBooking = await db.getBooking(booking.bookingId);
    expect(toNumber(updatedBooking.driver_payout)).toBe(450);
  });

  it('documents the current release blocker: commission is recalculated from live settings at completion time', async () => {
    const client = db.getSupabaseAdmin();

    await db.setPlatformSetting('commission', {
      default_rate: 15,
      by_vehicle_type: {},
    }, originalCommissionSetting?.description || null);

    const booking = await db.createTestBooking({
      customerId,
      driverId,
      status: 'in_progress',
      vehicleType: 'sedan',
      totalFare: 1000,
      paymentMethod: 'cash',
      paymentStatus: 'pending',
      origin: TEST_LOCATIONS.MUMBAI_ANDHERI,
      destination: TEST_LOCATIONS.MUMBAI_BANDRA,
    });

    await db.setPlatformSetting('commission', {
      default_rate: 18,
      by_vehicle_type: {},
    }, originalCommissionSetting?.description || null);
    await db.setDriverWalletState(driverId, {
      availableBalance: 1000,
      totalCommissionOwed: 0,
      totalEarned: 0,
      totalWithdrawn: 0,
    });

    const creditResult = await client.rpc('credit_driver_earning', {
      p_driver_id: driverId,
      p_booking_id: booking.bookingId,
      p_total_fare: 1000,
      p_is_cash: true,
    });

    expect(creditResult.error).toBeNull();
    expect(toNumber(creditResult.data?.platform_fee)).toBe(180);
    expect(toNumber(creditResult.data?.platform_fee)).not.toBe(150);
  });
});
