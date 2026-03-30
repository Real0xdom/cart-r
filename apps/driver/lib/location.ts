// Background Location Tracking Service for Driver App
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { supabase } from './supabase';
import { getLocationWithFallback, isLocationUnavailableError } from './locationFallback';
import * as SecureStore from 'expo-secure-store';
import { PublishedLocationState, shouldPublishLocation } from './locationQuality';

// Cache for background task
let cachedDriverId: string | null = null;
let cachedIsOnline: boolean = false;
let cachedActiveBookingId: string | null = null;
let lastCacheRefreshAt = 0;

export const ACTIVE_TRACKING_STATUSES = ['accepted', 'driver_arrived', 'in_progress'] as const;
const DRIVER_STATUS_CACHE_TTL_MS = 15000;

type ActiveTrackingStatus = (typeof ACTIVE_TRACKING_STATUSES)[number];

type TrackingBookingCandidate = {
  id: string;
  status: ActiveTrackingStatus;
  accepted_at?: string | null;
  driver_arrived_at?: string | null;
  started_at?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
};

function getTrackingBookingPriority(status: ActiveTrackingStatus): number {
  switch (status) {
    case 'in_progress':
      return 0;
    case 'driver_arrived':
      return 1;
    case 'accepted':
    default:
      return 2;
  }
}

function getTrackingBookingSortTimestamp(booking: TrackingBookingCandidate): number {
  const rawTimestamp =
    booking.started_at ||
    booking.driver_arrived_at ||
    booking.accepted_at ||
    booking.updated_at ||
    booking.created_at;

  const parsed = rawTimestamp ? new Date(rawTimestamp).getTime() : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

function selectTrackedBooking(bookings: TrackingBookingCandidate[] | null | undefined): TrackingBookingCandidate | null {
  if (!bookings?.length) {
    return null;
  }

  const sorted = [...bookings].sort((left, right) => {
    const priorityDelta = getTrackingBookingPriority(left.status) - getTrackingBookingPriority(right.status);
    if (priorityDelta !== 0) {
      return priorityDelta;
    }

    return getTrackingBookingSortTimestamp(right) - getTrackingBookingSortTimestamp(left);
  });

  return sorted[0] ?? null;
}

async function resolveTrackedBookingId(driverId: string): Promise<string | null> {
  const { data: activeBookings, error } = await supabase
    .from('bookings')
    .select('id, status, accepted_at, driver_arrived_at, started_at, updated_at, created_at')
    .eq('driver_id', driverId)
    .in('status', [...ACTIVE_TRACKING_STATUSES])
    .limit(10);

  if (error) {
    console.warn('[LOCATION-CACHE] Failed to resolve tracked booking:', error.message);
    return null;
  }

  return selectTrackedBooking(activeBookings as TrackingBookingCandidate[] | null)?.id ?? null;
}

export function invalidateLocationTrackingCache(): void {
  cachedDriverId = null;
  cachedIsOnline = false;
  cachedActiveBookingId = null;
  lastCacheRefreshAt = 0;
}

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

    const activeRideId = await resolveTrackedBookingId(driver.id);

    if (activeRideId) {
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
const LOCATION_UPDATE_INTERVAL = 3000; // 3 seconds (was 10s)
let lastPublishedBackgroundLocation: PublishedLocationState | null = null;
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

/**
 * Pre-cache driver status to make background tracking lightweight
 */
export async function cacheDriverStatus(): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: driver } = await supabase
      .from('drivers')
      .select('id, is_online')
      .eq('user_id', user.id)
      .single();

    if (driver) {
      cachedDriverId = driver.id;
      cachedIsOnline = !!driver.is_online;
      
      cachedActiveBookingId = await resolveTrackedBookingId(driver.id);
      lastCacheRefreshAt = Date.now();
      console.log(`[LOCATION-CACHE] Cached Driver: ${cachedDriverId}, Online: ${cachedIsOnline}, Booking: ${cachedActiveBookingId}`);
    }
  } catch (error) {
    console.warn('[LOCATION-CACHE] Failed to cache driver status:', error);
  }
}

// Update driver location in Supabase
async function updateDriverLocation(
  latitude: number,
  longitude: number,
  heading?: number,
  speed?: number,
  accuracy?: number
): Promise<void> {
  try {
    // Skip low-accuracy positions
    if (accuracy !== undefined && accuracy > MIN_ACCURACY_THRESHOLD) {
      return;
    }

    const timestamp = Date.now();
    const nextLocation = { latitude, longitude, heading, speed, accuracy, timestamp };
    if (!shouldPublishLocation(lastPublishedBackgroundLocation, nextLocation)) {
      return;
    }

    // Use cached values if available to avoid database roundtrips
    if (!cachedDriverId || (Date.now() - lastCacheRefreshAt) > DRIVER_STATUS_CACHE_TTL_MS) {
      await cacheDriverStatus();
    }

    if (!cachedDriverId || !cachedIsOnline) {
      console.log('[LOCATION-UPDATE] Driver offline or not found, skipping update');
      return;
    }

    const isoTimestamp = new Date(timestamp).toISOString();

    // 1. Update current location in drivers table (Fire and forget, but tracked)
    const driverUpdate = supabase
      .from('drivers')
      .update({
        current_latitude: latitude,
        current_longitude: longitude,
        current_heading: heading,
        last_location_update: isoTimestamp,
      })
      .eq('id', cachedDriverId);

    // 2. Insert into location history
    const historyInsert = supabase.from('driver_locations').insert({
      driver_id: cachedDriverId,
      booking_id: cachedActiveBookingId,
      latitude,
      longitude,
      heading,
      speed,
      accuracy,
    });

    // Run both in parallel to ensure speed in background
    const [updateResult, insertResult] = await Promise.all([driverUpdate, historyInsert]);

    if (updateResult.error) {
      console.error('[LOCATION-UPDATE] Drivers table update failed:', updateResult.error.message);
      // Force cache refresh on next run
      invalidateLocationTrackingCache();
    }

    if (insertResult.error) {
      console.error('[LOCATION-UPDATE] History insert failed:', insertResult.error.message);
    }

    if (!updateResult.error && !insertResult.error) {
      lastPublishedBackgroundLocation = nextLocation;
    }

    console.log(`📍 Location updated: ${latitude.toFixed(4)}, ${longitude.toFixed(4)} (Booking: ${cachedActiveBookingId || 'None'})`);
  } catch (error) {
    console.error('CRITICAL: Background location update error:', error);
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
    invalidateLocationTrackingCache();
  } catch (error) {
    console.error('Failed to stop location tracking:', error);
  }
}

export async function refreshLocationTrackingNotification(): Promise<void> {
  try {
    invalidateLocationTrackingCache();
    await cacheDriverStatus();
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
