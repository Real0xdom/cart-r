import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rpcMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: rpcMock,
  },
}));

import { getEffectiveCommission } from '../../apps/driver/lib/commission';

describe('Driver Wallet Commission', () => {
  beforeEach(() => {
    rpcMock.mockReset();
  });

  it('uses the vehicle override when a vehicle-specific rate exists', async () => {
    rpcMock.mockResolvedValue({
      data: {
        default_rate: 18,
        by_vehicle_type: {
          bike: 10,
        },
      },
      error: null,
    });

    const result = await getEffectiveCommission(500, 'bike');

    expect(result).toEqual({
      rate: 10,
      platformFee: 50,
      driverShare: 450,
      source: 'vehicle_specific',
    });
  });

  it('falls back to the default commission rate when no vehicle override exists', async () => {
    rpcMock.mockResolvedValue({
      data: {
        default_rate: '18',
        by_vehicle_type: {
          bike: '10',
        },
      },
      error: null,
    });

    const result = await getEffectiveCommission(800, 'sedan');

    expect(result).toEqual({
      rate: 18,
      platformFee: 144,
      driverShare: 656,
      source: 'default',
    });
  });

  it('uses the backend default when commission settings fetch fails', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: new Error('network'),
    });

    const result = await getEffectiveCommission(1000, 'truck');

    expect(result).toEqual({
      rate: 15,
      platformFee: 150,
      driverShare: 850,
      source: 'default',
    });
  });
});
