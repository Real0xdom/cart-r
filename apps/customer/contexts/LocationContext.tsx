import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import * as Location from 'expo-location';
import { Alert, Linking, Platform, AppState, AppStateStatus } from 'react-native';
import { useLocationStore } from '@/store';
import { reverseGeocode } from '@/lib/location';

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

const MIN_ACCURACY_THRESHOLD = 50; // Accept fixes up to 50m during sampling, pick the best one
const GOOD_ACCURACY_THRESHOLD = 15; // A fix ≤15m is considered "good enough" — stop sampling early
const MOVEMENT_THRESHOLD = 5; // Skip moves less than 5m to prevent drift
const LAST_KNOWN_MAX_AGE_MS = 30_000; // Reject lastKnown positions older than 30 seconds
const GPS_SAMPLE_COUNT = 3; // Number of rapid GPS samples to take
const GPS_SAMPLE_TIMEOUT_MS = 5_000; // Max time per single GPS sample

const isLocationUnavailableError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error ?? '');
  const normalizedMessage = message.toLowerCase();

  return (
    normalizedMessage.includes('current location is unavailable') ||
    normalizedMessage.includes('location services') ||
    normalizedMessage.includes('gps')
  );
};

/**
 * Take multiple rapid GPS samples and return the one with the best (lowest) accuracy value.
 */
const getBestGPSFix = async (sampleCount = GPS_SAMPLE_COUNT): Promise<Location.LocationObject | null> => {
  const samples: Location.LocationObject[] = [];

  for (let i = 0; i < sampleCount; i++) {
    try {
      const fix = await Promise.race([
        Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Highest, // Uses GPS hardware
          mayShowUserSettingsDialog: true,      // Prompt user to enable GPS if off
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('GPS sample timeout')), GPS_SAMPLE_TIMEOUT_MS)
        ),
      ]) as Location.LocationObject;

      if (fix?.coords) {
        samples.push(fix);
        console.log(
          `[Location] GPS sample ${i + 1}/${sampleCount}: ` +
          `accuracy=${fix.coords.accuracy?.toFixed(1)}m, ` +
          `lat=${fix.coords.latitude.toFixed(6)}, lng=${fix.coords.longitude.toFixed(6)}`
        );

        if (fix.coords.accuracy && fix.coords.accuracy <= GOOD_ACCURACY_THRESHOLD) {
          console.log(`[Location] Good fix obtained (${fix.coords.accuracy.toFixed(1)}m), stopping early`);
          break;
        }
      }
    } catch (err) {
      console.log(`[Location] GPS sample ${i + 1} failed:`, (err as Error).message);
    }
  }

  if (samples.length === 0) return null;

  const best = samples.reduce((a, b) => {
    const accA = a.coords.accuracy ?? Infinity;
    const accB = b.coords.accuracy ?? Infinity;
    return accA <= accB ? a : b;
  });

  return best;
};

/**
 * Get last known position only if it's recent enough (not stale).
 */
const getRecentLastKnown = async (): Promise<Location.LocationObject | null> => {
  const lastKnown = await Location.getLastKnownPositionAsync();
  if (!lastKnown) return null;

  const ageMs = Date.now() - lastKnown.timestamp;
  if (ageMs > LAST_KNOWN_MAX_AGE_MS) {
    return null;
  }

  return lastKnown;
};

export const LocationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [locationPermissionStatus, setLocationPermissionStatus] = useState<Location.PermissionStatus | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const { setUserLocation } = useLocationStore();
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    checkAndRequestLocation();
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        checkAndRequestLocation();
      }
      appStateRef.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const checkAndRequestLocation = async () => {
    setIsLoadingLocation(true);
    setErrorMessage(null);

    try {
      const { status: existingStatus } = await Location.getForegroundPermissionsAsync();
      
      if (existingStatus === 'granted') {
        setLocationPermissionStatus(existingStatus);
        await fetchAndSetCurrentLocation();
      } else {
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

  const showGPSDisabledAlert = () => {
    Alert.alert(
      'Location Services Disabled',
      'GPS is turned off. Please enable location services in your device settings for the best delivery experience.',
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
        location = await getBestGPSFix();
        if (!location) {
          location = await getRecentLastKnown();
        }
      } catch (primaryError: any) {
        location = await getRecentLastKnown();
      }

      if (!location) {
        setErrorMessage('Location services are disabled.');
        showGPSDisabledAlert();
        return;
      }

      const { latitude, longitude } = location.coords;
      const address = await reverseGeocode(latitude, longitude);

      setUserLocation({
        latitude,
        longitude,
        address,
      });
    } catch (error) {
      console.error('Error fetching current location:', error);
    }
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
      let location: Location.LocationObject | null = await getBestGPSFix();

      if (!location) {
        location = await getRecentLastKnown();
      }

      if (!location) {
        showGPSDisabledAlert();
        return null;
      }

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
  }, [locationPermissionStatus, setUserLocation, requestLocationPermission]);

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
