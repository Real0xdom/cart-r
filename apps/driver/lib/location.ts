// Background Location Tracking Service for Driver App
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { supabase } from './supabase';
import { getLocationWithFallback, isLocationUnavailableError } from './locationFallback';

async function getForegroundServiceBody(): Promise<string> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return 'Tracking your location while you are online';
    }

    const { data: driver } = await supabase
      .from('drivers')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!driver?.id) {
      return 'Tracking your location while you are online';
    }

    const { data: activeRide } = await supabase
      .from('bookings')
      .select('id')
      .eq('driver_id', driver.id)
      .in('status', ['accepted', 'driver_arrived', 'in_progress'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (activeRide) {
      return 'Trip in progress - Tap to open Cartr';
    }

    const { data: queuedRide } = await supabase
      .from('bookings')
      .select('id')
      .eq('driver_id', driver.id)
      .eq('status', 'queued')
      .order('queued_at', { ascending: true, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    if (queuedRide) {
      return 'You are online with a queued next ride';
    }

    return 'You are online and ready for new ride requests';
  } catch (error) {
    console.error('Failed to build foreground service body:', error);
    return 'Tracking your location while you are online';
  }
}

async function getLocationTaskOptions() {
  return {
    accuracy: Location.Accuracy.Highest,
    timeInterval: LOCATION_UPDATE_INTERVAL,
    distanceInterval: 10,
    foregroundService: {
      notificationTitle: 'CARTR Driver',
      notificationBody: await getForegroundServiceBody(),
      notificationColor: '#22c55e',
    },
    showsBackgroundLocationIndicator: true,
    pausesUpdatesAutomatically: false,
  };
}

const LOCATION_TASK_NAME = 'cartr-driver-location';
const LOCATION_UPDATE_INTERVAL = 10000; // 10 seconds
const MIN_ACCURACY_THRESHOLD = 50; // meters — skip positions less accurate than this

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
        location.coords.speed || undefined,
        location.coords.accuracy || undefined
      );
    }
  }
});

// Update driver location in Supabase
async function updateDriverLocation(
  latitude: number,
  longitude: number,
  heading?: number,
  speed?: number,
  accuracy?: number
): Promise<void> {
  try {
    // Skip low-accuracy positions to prevent misleading ETA/location data
    if (accuracy !== undefined && accuracy > MIN_ACCURACY_THRESHOLD) {
      console.log(`⚠️ Skipping low-accuracy position: ${accuracy.toFixed(0)}m (threshold: ${MIN_ACCURACY_THRESHOLD}m)`);
      return;
    }

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

    const { data: activeBooking } = await supabase
      .from('bookings')
      .select('id')
      .eq('driver_id', driver.id)
      .eq('status', 'in_progress')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Insert into location history for tracking during rides
    await supabase.from('driver_locations').insert({
      driver_id: driver.id,
      booking_id: activeBooking?.id ?? null,
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
    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, await getLocationTaskOptions());

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

export async function refreshLocationTrackingNotification(): Promise<void> {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
    if (!isRegistered) {
      return;
    }

    await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, await getLocationTaskOptions());
    console.log('Foreground service notification refreshed');
  } catch (error) {
    console.error('Failed to refresh foreground service notification:', error);
  }
}

// Check if location services are enabled
export async function checkLocationServices(): Promise<boolean> {
  try {
    return await Location.hasServicesEnabledAsync();
  } catch (error) {
    console.error('Error checking location services:', error);
    return false;
  }
}

// Get current location once
export async function getCurrentLocation(): Promise<Location.LocationObject | null> {
  try {
    const { status: existingStatus } = await Location.getForegroundPermissionsAsync();
    if (existingStatus !== 'granted') {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        return null;
      }
    }

    return await getLocationWithFallback(
      async () => Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      }),
      async () => Location.getLastKnownPositionAsync()
    );
  } catch (error) {
    const logMethod = isLocationUnavailableError(error) ? console.log : console.error;
    logMethod('Failed to get current location:', error);
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
