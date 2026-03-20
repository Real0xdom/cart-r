import { beforeEach, describe, expect, it, vi } from 'vitest';

const maybeSingle = vi.fn();
const select = vi.fn(() => ({ maybeSingle }));
const inFilter = vi.fn(() => ({ select }));
const eq = vi.fn(() => ({ in: inFilter, select }));
const update = vi.fn(() => ({ eq }));
const from = vi.fn(() => ({ update }));

vi.mock('../../apps/driver/lib/supabase', () => ({
  supabase: { from },
}));

vi.mock('../../apps/driver/lib/wallet', () => ({
  parseDriverWalletRestriction: vi.fn(),
}));

import { updateBookingStatus } from '../../apps/driver/lib/bookings';

describe('driver booking status guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    from.mockReturnValue({ update });
    update.mockReturnValue({ eq });
    eq.mockReturnValue({ in: inFilter, select });
    inFilter.mockReturnValue({ select });
    select.mockReturnValue({ maybeSingle });
  });

  it('only allows starting a trip from driver_arrived', async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });

    const result = await updateBookingStatus('booking-1', 'in_progress');

    expect(inFilter).toHaveBeenCalledWith('status', ['driver_arrived']);
    expect(result).toEqual({
      success: false,
      error: 'Ride was already cancelled or moved to another state.',
    });
  });

  it('only allows marking arrived from accepted', async () => {
    maybeSingle.mockResolvedValue({
      data: { id: 'booking-1', status: 'driver_arrived', cancellation_reason: null },
      error: null,
    });

    const result = await updateBookingStatus('booking-1', 'driver_arrived');

    expect(inFilter).toHaveBeenCalledWith('status', ['accepted']);
    expect(result).toEqual({ success: true, error: null });
  });

  it('does not apply a transition guard when cancelling', async () => {
    maybeSingle.mockResolvedValue({
      data: { id: 'booking-1', status: 'cancelled', cancellation_reason: 'Cancelled by customer' },
      error: null,
    });

    const result = await updateBookingStatus('booking-1', 'cancelled');

    expect(inFilter).not.toHaveBeenCalled();
    expect(result).toEqual({ success: true, error: null });
  });
});
