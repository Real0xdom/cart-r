import React, { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Alert, AppState } from 'react-native';
import * as Notifications from 'expo-notifications';
import notifee, { EventType } from '@notifee/react-native';
import * as SecureStore from 'expo-secure-store';
import { router, useRootNavigationState } from 'expo-router';
import * as Location from 'expo-location';
import NetInfo from '@react-native-community/netinfo';

import RideRequestModal from '@/components/RideRequestModal';
import {
  acceptBooking,
  declineBooking,
  getAvailableBookings,
  getBookingById,
  getDriverQueuedBooking,
  getDriverSearchRadius,
  type Booking,
  type AcceptBookingResult,
  subscribeToAvailableBookings,
} from '@/lib/bookings';
import {
  addActiveRide,
  cancelRideRequestNotification,
  dismissRawRideRequestNotification,
  displayRideRequestWithStackLogic,
  removeActiveRide,
} from '@/lib/notifications';
import { getCurrentLocation, refreshLocationTrackingNotification } from '@/lib/location';
import { updateDriverLocation as publishDriverLocation } from '@/lib/api';
import { playRideAlertSound, stopRideAlertSound } from '@/lib/rideAlertSound';
import { checkDriverWalletEligibility, getDriverWalletRechargeNavigationTarget } from '@/lib/wallet';
import { useAuth } from '@/contexts/AuthContext';

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = notification.request.content.data;
    if (data?.type === 'new_booking' || data?.is_data_only) {
      return {
        shouldShowAlert: false,
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: false,
        shouldShowList: false,
      };
    }

    return {
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    };
  },
});

interface RideNotificationContextType {
  currentNotification: Booking | null;
  showNotification: (booking: Booking) => void;
  hideNotification: (bookingId?: string) => void;
  acceptRide: (bookingId: string) => Promise<void>;
  declineRide: (bookingId: string) => Promise<void>;
}

const RideNotificationContext = createContext<RideNotificationContextType | undefined>(undefined);

// Haversine distance formula — returns distance in km between two lat/lon points
function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function RideNotificationProvider({ children }: { children: ReactNode }) {
  const { driverProfile } = useAuth();
  const navigationState = useRootNavigationState();
  const [currentNotification, setCurrentNotification] = useState<Booking | null>(null);
  const [queuedNotifications, setQueuedNotifications] = useState<Booking[]>([]);
  const [pendingRoute, setPendingRoute] = useState<string | null>(null);
  const hasHandledInitial = useRef(false);
  const currentNotificationRef = useRef<Booking | null>(null);
  const appStateRef = useRef(AppState.currentState);
  const surfacedBookingIdsRef = useRef(new Set<string>());
  // Keep a live ref to the driver's current coordinates so the NetInfo callback has fresh values
  const driverCoordsRef = useRef<{ lat: number; lon: number } | null>(null);
  // Keep a ref to the fetch-and-surface function so the NetInfo callback can call it
  const fetchAndSurfaceRef = useRef<(() => Promise<void>) | null>(null);
  // Centralized admin-configured search radius — shared across ALL notification paths
  const searchRadiusRef = useRef<number>(20); // safe default until loaded

  /**
   * CENTRALIZED DISTANCE GATEKEEPER
   * Every code path that wants to show a ride notification MUST call this first.
   * Returns true only if the booking's pickup is within the admin-configured search radius.
   */
  const isBookingWithinSearchRadius = (booking: Booking): boolean => {
    const coords = driverCoordsRef.current;
    if (!coords) {
      console.log(`[GATEKEEPER] BLOCKED booking ${booking.id} — driver location unknown`);
      return false;
    }

    const originLat = Number(booking.origin_latitude);
    const originLon = Number(booking.origin_longitude);
    if (!Number.isFinite(originLat) || !Number.isFinite(originLon)) {
      console.log(`[GATEKEEPER] ALLOWED booking ${booking.id} — booking has no valid origin coords, cannot filter`);
      return true;
    }

    const radiusKm = searchRadiusRef.current;
    const dist = haversineDistanceKm(coords.lat, coords.lon, originLat, originLon);
    const allowed = dist <= radiusKm;

    console.log(`[GATEKEEPER] ${allowed ? 'ALLOWED' : 'BLOCKED'} booking ${booking.id} — distance: ${dist.toFixed(2)} km, radius: ${radiusKm} km`);
    return allowed;
  };

  useEffect(() => {
    currentNotificationRef.current = currentNotification;
  }, [currentNotification]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      appStateRef.current = nextState;
    });

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (pendingRoute && navigationState?.key) {
      router.push(pendingRoute as any);
      setPendingRoute(null);
    }
  }, [navigationState?.key, pendingRoute]);

  useEffect(() => {
    if (!currentNotification && queuedNotifications.length > 0) {
      const [nextNotification, ...rest] = queuedNotifications;
      setQueuedNotifications(rest);
      setCurrentNotification(nextNotification);
    }
  }, [currentNotification, queuedNotifications]);

  useEffect(() => {
    if (!currentNotification) {
      void stopRideAlertSound();
      return;
    }

    void playRideAlertSound();

    return () => {
      void stopRideAlertSound();
    };
  }, [currentNotification?.id]);

  useEffect(() => {
    if (!currentNotification?.id || !currentNotification.expires_at) {
      return;
    }

    const expiresAtMs = new Date(currentNotification.expires_at).getTime();
    if (Number.isNaN(expiresAtMs)) {
      return;
    }

    const delayMs = expiresAtMs - Date.now();
    if (delayMs <= 0) {
      console.log('[RIDE NOTIFICATION] Hiding expired booking immediately:', currentNotification.id);
      hideNotification(currentNotification.id);
      void cancelRideRequestNotification(currentNotification.id).catch(() => {});
      return;
    }

    const timeoutId = setTimeout(() => {
      console.log('[RIDE NOTIFICATION] Hiding booking after expiry timeout:', currentNotification.id);
      hideNotification(currentNotification.id);
      void cancelRideRequestNotification(currentNotification.id).catch(() => {});
    }, delayMs);

    return () => clearTimeout(timeoutId);
  }, [currentNotification?.expires_at, currentNotification?.id]);

  const navigateTo = (path: string) => {
    if (navigationState?.key) {
      router.push(path as any);
    } else {
      setPendingRoute(path);
    }
  };

  const removeQueuedNotification = (bookingId: string) => {
    setQueuedNotifications((previous) => previous.filter((item) => item.id !== bookingId));
  };

  const showNotification = (booking: Booking) => {
    console.log('[RIDE NOTIFICATION] showNotification called for booking:', booking.id);
    surfacedBookingIdsRef.current.add(booking.id);
    setCurrentNotification((current) => {
      if (!current) {
        return booking;
      }

      if (current.id === booking.id) {
        return { ...current, ...booking };
      }

      setQueuedNotifications((previous) => {
        const withoutBooking = previous.filter((item) => item.id !== booking.id);
        return [...withoutBooking, booking];
      });

      return current;
    });
  };

  const hideNotification = (bookingId?: string) => {
    const activeId = currentNotificationRef.current?.id;
    if (bookingId) {
      surfacedBookingIdsRef.current.delete(bookingId);
    }

    if (!bookingId || bookingId === activeId) {
      setCurrentNotification(null);
    }

    if (bookingId) {
      removeQueuedNotification(bookingId);
    }
  };

  const openRechargeFlow = useMemo(
    () => () => {
      const route = getDriverWalletRechargeNavigationTarget();
      navigateTo(`${route.pathname}?openRecharge=${route.params.openRecharge}`);
    },
    [navigationState?.key]
  );

  const acceptRide = async (bookingId: string) => {
    if (!bookingId || !driverProfile?.id) {
      Alert.alert('Error', 'Unable to accept ride.');
      return;
    }

    try {
      const eligibility = await checkDriverWalletEligibility(driverProfile.id);

      if (!eligibility.canAcceptRides) {
        hideNotification(bookingId);
        Alert.alert(
          'Cannot Accept Ride',
          `Your wallet balance is Rs ${eligibility.currentBalance.toFixed(2)}.\n\nRecharge Rs ${(eligibility.requiredRecharge || 0).toFixed(0)} to accept new ride requests again.`,
          [
            { text: 'Later', style: 'cancel' },
            { text: 'Recharge Now', onPress: openRechargeFlow },
          ]
        );
        return;
      }

      const result: AcceptBookingResult = await acceptBooking(bookingId, driverProfile.id);

      if (!result.success) {
        hideNotification(bookingId);

        if (result.errorCode === 'wallet_recharge_required') {
          Alert.alert(
            'Wallet Recharge Required',
            `Your wallet balance is Rs ${(result.currentBalance || 0).toFixed(2)}.\n\nRecharge Rs ${(result.requiredRecharge || 0).toFixed(0)} to continue accepting rides.`,
            [
              { text: 'Later', style: 'cancel' },
              { text: 'Recharge Now', onPress: openRechargeFlow },
            ]
          );
          return;
        }

        Alert.alert('Error', result.error || 'Failed to accept ride. It may have been taken by another driver.');
        return;
      }

      addActiveRide(bookingId);
      hideNotification(bookingId);
      await cancelRideRequestNotification(bookingId).catch(() => {});
      void refreshLocationTrackingNotification();

      if (result.assignmentMode === 'queued') {
        Alert.alert('Ride queued', 'Next ride queued successfully. Finish your current trip to start it.');
        return;
      }

      const currentLocation = await getCurrentLocation();
      if (currentLocation) {
        void publishDriverLocation(
          currentLocation.coords.latitude,
          currentLocation.coords.longitude,
          currentLocation.coords.heading || undefined,
          currentLocation.coords.speed || undefined,
          currentLocation.coords.accuracy || undefined
        );
      }

      navigateTo(`/ride/${bookingId}`);
    } catch (error) {
      console.error('[RIDE NOTIFICATION] Failed to accept ride:', error);
      hideNotification(bookingId);
      Alert.alert('Error', 'Failed to verify wallet status. Please try again.');
    }
  };

  const declineRide = async (bookingId: string) => {
    if (!bookingId) {
      return;
    }

    hideNotification(bookingId);
    removeActiveRide(bookingId);

    try {
      await declineBooking(bookingId);
    } catch (error) {
      console.error('[RIDE NOTIFICATION] Failed to decline ride:', error);
    } finally {
      await cancelRideRequestNotification(bookingId).catch(() => {});
    }
  };

  useEffect(() => {
    if (!driverProfile?.vehicle_type || !driverProfile?.is_online) {
      console.log('[RIDE NOTIFICATION] Subscription disabled:', {
        driverId: driverProfile?.id,
        isOnline: driverProfile?.is_online,
        vehicleType: driverProfile?.vehicle_type,
      });
      fetchAndSurfaceRef.current = null;
      return;
    }

    console.log('[RIDE NOTIFICATION] Subscription enabled:', {
      driverId: driverProfile.id,
      isOnline: driverProfile.is_online,
      vehicleType: driverProfile.vehicle_type,
      currentLatitude: (driverProfile as any).current_latitude,
      currentLongitude: (driverProfile as any).current_longitude,
    });

    const surfaceBooking = async (booking: Booking) => {
      console.log('[RIDE NOTIFICATION] surfaceBooking triggered:', booking.id, 'appState=', appStateRef.current);
      const { data: fullBooking } = await getBookingById(booking.id);
      const bookingToShow = fullBooking || booking;

      // ── CENTRALIZED GATEKEEPER — every surfaceBooking call is distance-checked ──
      if (!isBookingWithinSearchRadius(bookingToShow)) {
        return;
      }

      if (appStateRef.current === 'active') {
        await displayRideRequestWithStackLogic({ ...bookingToShow, type: 'new_booking' });
        showNotification(bookingToShow);
        return;
      }

      await displayRideRequestWithStackLogic({ ...bookingToShow, type: 'new_booking' });
    };

    const fetchAndSurfaceAvailableBookings = async () => {
      try {
        let latitude: number | undefined;
        let longitude: number | undefined;
        
        // Always try to get the freshest location possible without firing up the GPS intensely
        try {
          // Attempt to get last known position which is updated by the background tracker
          const recentLoc = await Location.getLastKnownPositionAsync();
          if (recentLoc) {
            latitude = recentLoc.coords.latitude;
            longitude = recentLoc.coords.longitude;
          } else {
             // Fallback to active fetch if last known is somehow null
             const currentLoc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
             if (currentLoc) {
               latitude = currentLoc.coords.latitude;
               longitude = currentLoc.coords.longitude;
             }
          }
        } catch (locErr) {
          console.warn('[RIDE NOTIFICATION] Failed to get local position, falling back to driverProfile:', locErr);
          latitude = Number((driverProfile as any).current_latitude);
          longitude = Number((driverProfile as any).current_longitude);
        }

        if (latitude === undefined || longitude === undefined || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
           console.error('[RIDE NOTIFICATION] Completely failed to get valid moving location.');
           return;
        }

        // Update live coords ref so the Gatekeeper and NetInfo reconnect handler ALWAYS have the moving coordinates
        driverCoordsRef.current = { lat: latitude, lon: longitude };

        // Eagerly load the admin search radius and persist into the shared ref
        const searchRadiusKm = await getDriverSearchRadius(driverProfile.vehicle_type);
        searchRadiusRef.current = searchRadiusKm;
        console.log('[RIDE NOTIFICATION] Admin search radius loaded:', searchRadiusKm, 'km for', driverProfile.vehicle_type);

        const { data, error } = await getAvailableBookings(
          latitude,
          longitude,
          driverProfile.vehicle_type,
          searchRadiusKm
        );

        if (error) {
          console.error('[RIDE NOTIFICATION] Fallback fetch failed:', error);
          return;
        }

        console.log('[RIDE NOTIFICATION] Fallback fetch found bookings:', data.map((booking) => booking.id));

        const fetchedBookingIds = new Set(data.map((b: any) => b.id));

        // Clean up surfaced bookings that are no longer in the pending list
        const currentSurfacedIds = Array.from(surfacedBookingIdsRef.current);
        for (const surfacedId of currentSurfacedIds) {
          if (!fetchedBookingIds.has(surfacedId)) {
            console.log('[RIDE NOTIFICATION] Polling detected booking no longer available, removing:', surfacedId);
            hideNotification(surfacedId);
            void cancelRideRequestNotification(surfacedId).catch(() => {});
          }
        }

        for (const booking of data) {
          if (surfacedBookingIdsRef.current.has(booking.id)) {
            continue;
          }

          await surfaceBooking(booking);
        }
      } catch (error) {
        console.error('[RIDE NOTIFICATION] Fallback fetch exception:', error);
      }
    };

    // Store reference so the NetInfo reconnect handler can trigger a fresh fetch
    fetchAndSurfaceRef.current = fetchAndSurfaceAvailableBookings;

    void fetchAndSurfaceAvailableBookings();
    const pollingInterval = setInterval(() => {
      void fetchAndSurfaceAvailableBookings();
    }, 15000);

    const unsubscribe = subscribeToAvailableBookings(
      driverProfile.vehicle_type,
      async (newBooking) => {
        // Distance gatekeeper is inside surfaceBooking — no need to duplicate here
        if (driverProfile?.id) {
          const { data: queuedRide } = await getDriverQueuedBooking(driverProfile.id);
          if (queuedRide) {
            console.log('[RIDE NOTIFICATION] Driver already has a queued ride:', queuedRide.id);
          }
        }

        await surfaceBooking(newBooking);
      },
      (removedBookingId) => {
        console.log('[RIDE NOTIFICATION] Booking removed:', removedBookingId);
        surfacedBookingIdsRef.current.delete(removedBookingId);
        if (currentNotificationRef.current?.id === removedBookingId) {
          setCurrentNotification(null);
        }

        removeQueuedNotification(removedBookingId);
        void cancelRideRequestNotification(removedBookingId).catch(() => {});
      },
      async (updatedBooking) => {
        // Distance gatekeeper is inside surfaceBooking — no need to duplicate here
        console.log('[RIDE NOTIFICATION] Booking updated from realtime:', updatedBooking.id);
        await surfaceBooking(updatedBooking);
      }
    );

    return () => {
      clearInterval(pollingInterval);
      fetchAndSurfaceRef.current = null;
      unsubscribe();
    };
  }, [driverProfile?.id, driverProfile?.is_online, driverProfile?.vehicle_type]);

  // ── Bug Fix: Auto-sync GPS when network reconnects after being offline ────────
  useEffect(() => {
    let wasConnected: boolean | null = null;

    const unsubscribeNetInfo = NetInfo.addEventListener(async (state) => {
      const isNowConnected = state.isConnected ?? false;

      // Detect false → true transition (came back online)
      if (wasConnected === false && isNowConnected) {
        console.log('[RIDE NOTIFICATION] Network reconnected — pushing fresh GPS to DB.');

        try {
          // Only sync if driver is online
          if (!driverProfile?.is_online) {
            wasConnected = isNowConnected;
            return;
          }

          // Get fresh GPS position
          const permission = await Location.getForegroundPermissionsAsync();
          if (permission.status !== 'granted') {
            wasConnected = isNowConnected;
            return;
          }

          const freshLocation = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          const { latitude, longitude } = freshLocation.coords;

          console.log('[RIDE NOTIFICATION] Pushing reconnect location to DB:', latitude, longitude);

          // Update live coords ref immediately
          driverCoordsRef.current = { lat: latitude, lon: longitude };

          // Push to Supabase drivers table
          const { supabase } = await import('@/lib/supabase');
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            await supabase
              .from('drivers')
              .update({
                current_latitude: latitude,
                current_longitude: longitude,
                last_location_update: new Date().toISOString(),
              })
              .eq('user_id', user.id);
            console.log('[RIDE NOTIFICATION] Driver location synced after reconnect ✅');
          }

          // Re-run the booking fetch with fresh coordinates
          if (fetchAndSurfaceRef.current) {
            void fetchAndSurfaceRef.current();
          }
        } catch (err) {
          console.error('[RIDE NOTIFICATION] Failed to sync location on reconnect:', err);
        }
      }

      wasConnected = isNowConnected;
    });

    return () => unsubscribeNetInfo();
  }, [driverProfile?.id, driverProfile?.is_online]);

  useEffect(() => {
    const foregroundSubscription = Notifications.addNotificationReceivedListener(async (notification) => {
      const data = notification.request.content.data;
      console.log('[RIDE NOTIFICATION] Foreground push received:', data);
      if (data?.type === 'new_booking' && data?.booking_id) {
        await dismissRawRideRequestNotification(notification);
        const { data: booking } = await getBookingById(String(data.booking_id));
        if (booking) {
          // ── CENTRALIZED GATEKEEPER — push notifications are distance-checked too ──
          if (!isBookingWithinSearchRadius(booking)) {
            console.log('[RIDE NOTIFICATION] Foreground push BLOCKED by distance gatekeeper:', booking.id);
            return;
          }
          showNotification(booking);
        }
      }
    });

    const tapSubscription = Notifications.addNotificationResponseReceivedListener(async (response) => {
      const data = response.notification.request.content.data;
      console.log('[RIDE NOTIFICATION] Notification response received:', data);
      const bookingId = data?.bookingId || data?.booking_id;

      if (!bookingId) {
        return;
      }

      if (data?.type === 'new_booking' || data?.is_data_only) {
        await dismissRawRideRequestNotification(response.notification);
      }

      const { data: booking } = await getBookingById(String(bookingId));
      if (booking) {
        // ── CENTRALIZED GATEKEEPER — tapped notifications are distance-checked too ──
        if (!isBookingWithinSearchRadius(booking)) {
          console.log('[RIDE NOTIFICATION] Notification tap BLOCKED by distance gatekeeper:', booking.id);
          return;
        }
        showNotification(booking);
      }
    });

    return () => {
      foregroundSubscription.remove();
      tapSubscription.remove();
    };
  }, []);

  useEffect(() => {
    const unsubscribe = notifee.onForegroundEvent(async ({ type, detail }) => {
      const { notification, pressAction } = detail;
      if (type !== EventType.ACTION_PRESS || !pressAction?.id) {
        return;
      }

      const bookingId = notification?.data?.id;
      if (!bookingId || typeof bookingId !== 'string') {
        return;
      }

      if (pressAction.id === 'accept_ride') {
        const { data: booking } = await getBookingById(bookingId);
        if (driverProfile?.id && booking?.driver_id === driverProfile.id && booking?.status === 'accepted') {
          navigateTo(`/ride/${bookingId}`);
        } else {
          await acceptRide(bookingId);
        }
      } else if (pressAction.id === 'decline_ride') {
        await declineRide(bookingId);
      } else if (pressAction.id === 'dismiss_notification') {
        await cancelRideRequestNotification(bookingId);
      } else if (pressAction.id === 'default') {
        const { data: booking } = await getBookingById(bookingId);
        if (driverProfile?.id && booking?.driver_id === driverProfile.id && ['accepted', 'driver_arrived', 'in_progress'].includes(booking?.status || '')) {
          navigateTo(`/ride/${bookingId}`);
        } else {
          navigateTo('/(tabs)/requests');
        }
      }
    });

    return () => unsubscribe();
  }, [driverProfile?.id, navigationState?.key]);

  useEffect(() => {
    async function checkPendingRoute() {
      if (!driverProfile?.id) {
        return;
      }

      const pendingBookingId = await SecureStore.getItemAsync('pending_route_booking_id');
      if (!pendingBookingId) {
        return;
      }

      await SecureStore.deleteItemAsync('pending_route_booking_id');
      navigateTo(`/ride/${pendingBookingId}`);
    }

    void checkPendingRoute();
  }, [driverProfile?.id, navigationState?.key]);

  useEffect(() => {
    async function checkInitialNotification() {
      if (!driverProfile?.id || hasHandledInitial.current) {
        return;
      }

      const initialNotification = await notifee.getInitialNotification();
      if (!initialNotification?.pressAction?.id) {
        return;
      }

      const bookingId = initialNotification.notification?.data?.id;
      if (!bookingId || typeof bookingId !== 'string') {
        return;
      }

      hasHandledInitial.current = true;

      if (initialNotification.pressAction.id === 'accept_ride') {
        const { data: booking } = await getBookingById(bookingId);
        if (driverProfile?.id && booking?.driver_id === driverProfile.id && booking?.status === 'accepted') {
          navigateTo(`/ride/${bookingId}`);
        } else {
          await acceptRide(bookingId);
        }
      } else if (initialNotification.pressAction.id === 'decline_ride') {
        await declineRide(bookingId);
      } else if (initialNotification.pressAction.id === 'default') {
        navigateTo('/(tabs)/requests');
      }

      await cancelRideRequestNotification(bookingId).catch(() => {});
    }

    void checkInitialNotification();
  }, [driverProfile?.id, navigationState?.key]);

  return (
    <RideNotificationContext.Provider
      value={{
        currentNotification,
        showNotification,
        hideNotification,
        acceptRide,
        declineRide,
      }}
    >
      {children}
      <RideRequestModal
        visible={!!currentNotification}
        bookingId={currentNotification?.id || ''}
        request={currentNotification || ({} as Booking)}
        driverId={driverProfile?.id}
        onAccept={() => {
          if (currentNotification?.id) {
            void acceptRide(currentNotification.id);
          }
        }}
        onReject={() => {
          if (currentNotification?.id) {
            void declineRide(currentNotification.id);
          }
        }}
      />
    </RideNotificationContext.Provider>
  );
}

export function useRideNotification() {
  const context = useContext(RideNotificationContext);
  if (!context) {
    throw new Error('useRideNotification must be used within RideNotificationProvider');
  }
  return context;
}
