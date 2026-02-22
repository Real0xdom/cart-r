import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import * as Location from 'expo-location';
import { Alert, Linking, Platform } from 'react-native';
import { useLocationStore } from '@/store';

interface LocationContextType {
  locationPermissionStatus: Location.PermissionStatus | null;
  isLoadingLocation: boolean;
  hasLocationPermission: boolean;
  requestLocationPermission: () => Promise<boolean>;
  getCurrentLocation: () => Promise<LocationData | null>;
  errorMessage: string | null;
}

interface LocationData {
  latitude: number;
  longitude: number;
  address: string;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

const GOOGLE_PLACES_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

export const LocationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [locationPermissionStatus, setLocationPermissionStatus] = useState<Location.PermissionStatus | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const { setUserLocation, userLatitude, userLongitude } = useLocationStore();

  // Check and request location permission on mount
  useEffect(() => {
    checkAndRequestLocation();
  }, []);

  const checkAndRequestLocation = async () => {
    setIsLoadingLocation(true);
    setErrorMessage(null);

    try {
      // First check current permission status
      const { status: existingStatus } = await Location.getForegroundPermissionsAsync();
      
      if (existingStatus === 'granted') {
        setLocationPermissionStatus(existingStatus);
        await fetchAndSetCurrentLocation();
      } else {
        // Request permission
        const { status } = await Location.requestForegroundPermissionsAsync();
        setLocationPermissionStatus(status);
        
        if (status === 'granted') {
          await fetchAndSetCurrentLocation();
        } else {
          setErrorMessage('Location permission denied. Please enable it in settings.');
          showPermissionDeniedAlert();
        }
      }
    } catch (error) {
      console.error('Error checking/requesting location permission:', error);
      setErrorMessage('Failed to access location services');
    } finally {
      setIsLoadingLocation(false);
    }
  };

  const showPermissionDeniedAlert = () => {
    Alert.alert(
      'Location Permission Required',
      'Carter needs access to your location to show nearby drivers and provide delivery services. Please enable location access in your device settings.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Open Settings', 
          onPress: () => {
            if (Platform.OS === 'ios') {
              Linking.openURL('app-settings:');
            } else {
              Linking.openSettings();
            }
          }
        }
      ]
    );
  };

  const fetchAndSetCurrentLocation = async () => {
    try {
      let location: Location.LocationObject | null = null;

      try {
        location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
      } catch (primaryError: any) {
        // GPS / location services may be off — try last known position as fallback
        console.warn('⚠️ getCurrentPositionAsync failed, trying last known position:', primaryError?.message);
        location = await Location.getLastKnownPositionAsync();
      }

      if (!location) {
        console.warn('⚠️ No location available — location services may be disabled on device');
        setErrorMessage('Location services are disabled. Please enable them in device settings for the best experience.');
        return;
      }

      const { latitude, longitude } = location.coords;
      
      // Reverse geocode to get address
      const address = await reverseGeocode(latitude, longitude);

      setUserLocation({
        latitude,
        longitude,
        address,
      });
    } catch (error) {
      console.error('Error fetching current location:', error);
      setErrorMessage('Unable to get your current location. Please enable location services.');
    }
  };

  const reverseGeocode = async (latitude: number, longitude: number): Promise<string> => {
    // Helper: try Expo's built-in reverse geocoding with a 3s timeout
    const expoReverseGeocode = async (): Promise<string | null> => {
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('reverseGeocodeAsync timed out')), 3000)
      );
      const geocode = Location.reverseGeocodeAsync({ latitude, longitude }).then(([result]) => {
        if (!result) return null;
        const parts = [];
        if (result.name) parts.push(result.name);
        if (result.street) parts.push(result.street);
        if (result.city) parts.push(result.city);
        if (result.region) parts.push(result.region);
        return parts.length > 0 ? parts.join(', ') : null;
      });
      return Promise.race([geocode, timeout]);
    };

    // Helper: fall back to Google Geocoding API
    const googleReverseGeocode = async (): Promise<string | null> => {
      if (!GOOGLE_PLACES_API_KEY) return null;
      try {
        const response = await fetch(
          `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${GOOGLE_PLACES_API_KEY}`
        );
        const data = await response.json();
        if (data.results && data.results.length > 0) {
          return data.results[0].formatted_address;
        }
      } catch (err) {
        console.warn('Google reverse geocode failed:', err);
      }
      return null;
    };

    try {
      const expoResult = await expoReverseGeocode();
      if (expoResult) return expoResult;
    } catch (err) {
      console.warn('⚠️ Expo reverseGeocodeAsync failed/timed out, trying Google API:', (err as Error).message);
    }

    try {
      const googleResult = await googleReverseGeocode();
      if (googleResult) return googleResult;
    } catch (err) {
      console.warn('Google reverse geocoding failed:', err);
    }

    return 'Current Location';
  };

  const requestLocationPermission = useCallback(async (): Promise<boolean> => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationPermissionStatus(status);
      
      if (status === 'granted') {
        await fetchAndSetCurrentLocation();
        return true;
      } else {
        showPermissionDeniedAlert();
        return false;
      }
    } catch (error) {
      console.error('Error requesting location permission:', error);
      return false;
    }
  }, []);

  const getCurrentLocation = useCallback(async (): Promise<LocationData | null> => {
    if (locationPermissionStatus !== 'granted') {
      const granted = await requestLocationPermission();
      if (!granted) return null;
    }

    try {
      setIsLoadingLocation(true);
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const { latitude, longitude } = location.coords;
      const address = await reverseGeocode(latitude, longitude);

      const locationData = { latitude, longitude, address };
      
      setUserLocation(locationData);
      
      return locationData;
    } catch (error) {
      console.error('Error getting current location:', error);
      return null;
    } finally {
      setIsLoadingLocation(false);
    }
  }, [locationPermissionStatus, setUserLocation]);

  const hasLocationPermission = locationPermissionStatus === 'granted';

  return (
    <LocationContext.Provider
      value={{
        locationPermissionStatus,
        isLoadingLocation,
        hasLocationPermission,
        requestLocationPermission,
        getCurrentLocation,
        errorMessage,
      }}
    >
      {children}
    </LocationContext.Provider>
  );
};

export const useLocation = (): LocationContextType => {
  const context = useContext(LocationContext);
  if (context === undefined) {
    throw new Error('useLocation must be used within a LocationProvider');
  }
  return context;
};

export default LocationContext;
