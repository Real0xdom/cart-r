import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rpcMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
}));

vi.mock('../../apps/driver/lib/supabase', () => ({
  supabase: {
    rpc: rpcMock,
    from: vi.fn(),
  },
}));

import {
  DRIVER_WALLET_DEBT_THRESHOLD,
  checkDriverWalletEligibility,
  getDriverWalletRequiredRecharge,
  parseDriverWalletRestriction,
} from '../../apps/driver/lib/wallet';

describe('Driver Wallet Restrictions', () => {
  beforeEach(() => {
    rpcMock.mockReset();
  });

  it('computes the recommended recharge amount from a negative balance', () => {
    expect(getDriverWalletRequiredRecharge(-120)).toBe(220);
  });

  it('parses a wallet recharge restriction payload from accept_booking_atomic', () => {
    const result = parseDriverWalletRestriction({
      error: 'wallet_recharge_required',
      message: 'Please recharge your wallet to accept rides',
      current_balance: -120,
      required_recharge: 220,
    });

    expect(result).toEqual({
      errorCode: 'wallet_recharge_required',
      message: 'Please recharge your wallet to accept rides',
      currentBalance: -120,
      requiredRecharge: 220,
    });
  });

  it('falls back to the computed recharge amount when the RPC omits it', () => {
    const result = parseDriverWalletRestriction({
      error: 'wallet_recharge_required',
      current_balance: -150,
    });

    expect(result?.requiredRecharge).toBe(250);
  });

  it('blocks drivers whose wallet is below the debt threshold', async () => {
    rpcMock.mockResolvedValue({
      data: {
        wallet: {
          available_balance: -100.01,
          requires_recharge: false,
        },
      },
      error: null,
    });

    const result = await checkDriverWalletEligibility('driver-1');

    expect(result.canAcceptRides).toBe(false);
    expect(result.currentBalance).toBeCloseTo(-100.01, 2);
    expect(result.requiredRecharge).toBeCloseTo(200.01, 2);
  });

  it('allows drivers whose wallet is exactly at the threshold', async () => {
    rpcMock.mockResolvedValue({
      data: {
        wallet: {
          available_balance: DRIVER_WALLET_DEBT_THRESHOLD,
          requires_recharge: false,
        },
      },
      error: null,
    });

    const result = await checkDriverWalletEligibility('driver-1');

    expect(result).toEqual({
      canAcceptRides: true,
      currentBalance: DRIVER_WALLET_DEBT_THRESHOLD,
    });
  });
});
