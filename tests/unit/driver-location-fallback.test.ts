import { describe, expect, it, vi } from 'vitest';
import { getLocationWithFallback, isLocationUnavailableError } from '../../apps/driver/lib/locationFallback';

describe('driver location fallback', () => {
  it('treats the common Expo unavailable-location message as retryable', () => {
    expect(
      isLocationUnavailableError(new Error('Current location is unavailable. Make sure that location services are enabled'))
    ).toBe(true);
  });

  it('falls back to last known location when live GPS lookup fails', async () => {
    const fallbackLocation = { coords: { latitude: 12.97, longitude: 77.59 } };
    const getCurrent = vi.fn().mockRejectedValue(new Error('Current location is unavailable'));
    const getLastKnown = vi.fn().mockResolvedValue(fallbackLocation);

    const result = await getLocationWithFallback(getCurrent, getLastKnown);

    expect(result).toEqual(fallbackLocation);
    expect(getCurrent).toHaveBeenCalledTimes(1);
    expect(getLastKnown).toHaveBeenCalledTimes(1);
  });

  it('returns null when neither live nor cached location is available', async () => {
    const getCurrent = vi.fn().mockRejectedValue(new Error('Current location is unavailable'));
    const getLastKnown = vi.fn().mockResolvedValue(null);

    const result = await getLocationWithFallback(getCurrent, getLastKnown);

    expect(result).toBeNull();
  });
});
