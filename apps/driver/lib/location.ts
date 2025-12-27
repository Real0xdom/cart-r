// Background Location Tracking Service for Driver App
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { supabase } from './supabase';

const LOCATION_TASK_NAME = 'cartr-driver-location';
const LOCATION_UPDATE_INTERVAL = 10000; // 10 seconds

// Define the background task
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error('Location task error:', error);
    return;
  }

  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] };
    const location = locations[0];

    if (location) {
      await updateDriverLocation(
        location.coords.latitude,
        location.coords.longitude,
        location.coords.heading || undefined,
        location.coords.speed || undefined
      );
    }
  }
});

// Update driver location in Supabase
async function updateDriverLocation(
  latitude: number,
  longitude: number,
  heading?: number,
  speed?: number
): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get driver ID
    const { data: driver } = await supabase
      .from('drivers')
      .select('id, is_online')
      .eq('user_id', user.id)
      .single();

    if (!driver || !driver.is_online) return;

    // Update current location in drivers table
    await supabase
      .from('drivers')
      .update({
        current_latitude: latitude,
        current_longitude: longitude,
        last_location_update: new Date().toISOString(),
      })
      .eq('id', driver.id);

    // Insert into location history for tracking during rides
    await supabase.from('driver_locations').insert({
      driver_id: driver.id,
      latitude,
      longitude,
      heading,
      speed,
    });

    console.log(`📍 Location updated: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
  } catch (error) {
    console.error('Failed to update location:', error);
  }
}

// Request location permissions
export async function requestLocationPermissions(): Promise<boolean> {
  try {
    // Request foreground permission first
    const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
    if (foregroundStatus !== 'granted') {
      console.log('Foreground location permission denied');
      return false;
    }

    // Then request background permission
    const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
    if (backgroundStatus !== 'granted') {
      console.log('Background location permission denied');
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error requesting permissions:', error);
    return false;
  }
}

// Start background location tracking
export async function startLocationTracking(): Promise<boolean> {
  try {
    const hasPermissions = await requestLocationPermissions();
    if (!hasPermissions) {
      console.log('Location permissions not granted');
      return false;
    }

    // Check if task is already running
    const isRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
    if (isRegistered) {
      console.log('Location tracking already running');
      return true;
    }

    // Start background location updates
    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: LOCATION_UPDATE_INTERVAL,
      distanceInterval: 50, // Update if moved 50 meters
      foregroundService: {
        notificationTitle: 'CARTR Driver',
        notificationBody: 'Tracking your location for ride requests',
        notificationColor: '#22c55e',
      },
      // Android specific
      showsBackgroundLocationIndicator: true,
      pausesUpdatesAutomatically: false,
    });

    console.log('✅ Location tracking started');
    return true;
  } catch (error) {
    console.error('Failed to start location tracking:', error);
    return false;
  }
}

// Stop background location tracking
export async function stopLocationTracking(): Promise<void> {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
    if (isRegistered) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
      console.log('🛑 Location tracking stopped');
    }
  } catch (error) {
    console.error('Failed to stop location tracking:', error);
  }
}

// Get current location once
export async function getCurrentLocation(): Promise<Location.LocationObject | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      return null;
    }

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });

    return location;
  } catch (error) {
    console.error('Failed to get current location:', error);
    return null;
  }
}

// Subscribe to driver location updates (for customer app)
export function subscribeToDriverLocation(
  driverId: string,
  onLocationUpdate: (location: { latitude: number; longitude: number; heading?: number }) => void
) {
  const subscription = supabase
    .channel(`driver-location-${driverId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'drivers',
        filter: `id=eq.${driverId}`,
      },
      (payload) => {
        const { current_latitude, current_longitude } = payload.new;
        if (current_latitude && current_longitude) {
          onLocationUpdate({
            latitude: parseFloat(current_latitude),
            longitude: parseFloat(current_longitude),
          });
        }
      }
    )
    .subscribe();

  return () => {
    subscription.unsubscribe();
  };
}

// Subscribe to driver location history (for trip tracking)
export function subscribeToLocationHistory(
  driverId: string,
  bookingId: string,
  onNewLocation: (location: { latitude: number; longitude: number; heading?: number; speed?: number }) => void
) {
  const subscription = supabase
    .channel(`location-history-${bookingId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'driver_locations',
        filter: `driver_id=eq.${driverId}`,
      },
      (payload) => {
        onNewLocation({
          latitude: parseFloat(payload.new.latitude),
          longitude: parseFloat(payload.new.longitude),
          heading: payload.new.heading ? parseFloat(payload.new.heading) : undefined,
          speed: payload.new.speed ? parseFloat(payload.new.speed) : undefined,
        });
      }
    )
    .subscribe();

  return () => {
    subscription.unsubscribe();
  };
}
