import * as Location from 'expo-location';

const olaMapsApiKey = process.env.EXPO_PUBLIC_OLA_MAPS_API_KEY;

export const reverseGeocode = async (latitude: number, longitude: number): Promise<string> => {
  // Helper: try Expo's built-in reverse geocoding with a 1.5s timeout (reduced from 3s)
  const expoReverseGeocode = async (): Promise<string | null> => {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('reverseGeocodeAsync timed out')), 1500)
    );
    const geocode = Location.reverseGeocodeAsync({ latitude, longitude }).then(([result]) => {
      if (!result) return null;
      const parts = [];
      if (result.name && !result.name.includes('+')) parts.push(result.name); // Ignore plus codes if possible
      if (result.street && result.street !== result.name) parts.push(result.street);
      if (result.district) parts.push(result.district);
      if (result.city) parts.push(result.city);
      if (result.region) parts.push(result.region);
      return parts.length > 0 ? parts.join(', ') : null;
    });
    return Promise.race([geocode, timeout]);
  };

  // Helper: fall back to Ola Maps Reverse Geocoding API
  const olaReverseGeocode = async (): Promise<string | null> => {
    if (!olaMapsApiKey) return null;

    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = setTimeout(() => controller?.abort(), 1500);

    try {
      const response = await fetch(
        `https://api.olamaps.io/places/v1/reverse-geocode?latlng=${latitude},${longitude}&api_key=${olaMapsApiKey}`,
        controller ? { signal: controller.signal } : undefined
      );
      const data = await response.json();
      if (data.results && data.results.length > 0) {
        return data.results[0].formatted_address;
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.warn('Ola reverse geocode failed:', err);
      }
    } finally {
      clearTimeout(timeoutId);
    }
    return null;
  };

  // Run both geocoding methods in parallel and return the first non-empty result.
  // This avoids the timeout delay when one provider is slow but the other succeeds quickly.
  try {
    return await Promise.any(
      [expoReverseGeocode(), olaReverseGeocode()].map(async (lookup) => {
        const address = await lookup;
        if (!address) {
          throw new Error('Reverse geocode returned no address');
        }
        return address;
      })
    );
  } catch (err) {
    console.warn('All geocoding methods failed:', (err as Error).message);
  }

  return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
};
