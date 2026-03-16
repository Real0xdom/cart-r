import * as Location from 'expo-location';

const olaMapsApiKey = process.env.EXPO_PUBLIC_OLA_MAPS_API_KEY;

export const reverseGeocode = async (latitude: number, longitude: number): Promise<string> => {
  // Helper: try Expo's built-in reverse geocoding with a 3s timeout
  const expoReverseGeocode = async (): Promise<string | null> => {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('reverseGeocodeAsync timed out')), 3000)
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
    try {
      const response = await fetch(
        `https://api.olamaps.io/places/v1/reverse-geocode?latlng=${latitude},${longitude}&api_key=${olaMapsApiKey}`
      );
      const data = await response.json();
      if (data.results && data.results.length > 0) {
        return data.results[0].formatted_address;
      }
    } catch (err) {
      console.warn('Ola reverse geocode failed:', err);
    }
    return null;
  };

  try {
    const expoResult = await expoReverseGeocode();
    if (expoResult) return expoResult;
  } catch (err) {
    console.warn('⚠️ Expo reverseGeocodeAsync failed/timed out, trying Ola Maps API:', (err as Error).message);
  }

  try {
    const olaResult = await olaReverseGeocode();
    if (olaResult) return olaResult;
  } catch (err) {
    console.warn('Ola reverse geocoding failed:', err);
  }

  return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
};
