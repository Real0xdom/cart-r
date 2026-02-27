// Ride Notification Context
// Global state for showing ride request notifications on any screen

import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { acceptBooking, declineBooking, subscribeToAvailableBookings, getBookingById, Booking } from '@/lib/bookings';
import { RIDE_REQUESTS_CHANNEL, displayFullScreenRideRequest } from '@/lib/notifications';
import { useAuth } from '@/contexts/AuthContext';
import { router } from 'expo-router';
import { Alert } from 'react-native';
import * as Notifications from 'expo-notifications';
import notifee, { EventType } from '@notifee/react-native';
import * as SecureStore from 'expo-secure-store';

// Configure notifications to show in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

interface RideNotificationContextType {
  currentNotification: null;
  showNotification: (booking: Booking) => void;
  hideNotification: () => void;
  acceptRide: (bookingId: string) => Promise<void>;
  declineRide: (bookingId: string) => Promise<void>;
}

const RideNotificationContext = createContext<RideNotificationContextType | undefined>(undefined);

export function RideNotificationProvider({ children }: { children: ReactNode }) {
  const { driverProfile } = useAuth();
  const [currentNotification, setCurrentNotification] = useState<Booking | null>(null);
  const hasHandledInitial = useRef(false);

  // Subscribe to new ride requests
  useEffect(() => {
    if (!driverProfile?.vehicle_type || !driverProfile?.is_online) {
      return;
    }

    console.log('[NOTIFICATION CONTEXT] Subscribing to ride requests for:', driverProfile.vehicle_type);

    const unsubscribe = subscribeToAvailableBookings(
      driverProfile.vehicle_type,
      async (newBooking: Booking) => {
        console.log('[NOTIFICATION CONTEXT] New booking received:', newBooking.id);
        // Fetch full booking so we have addons and correct total for display
        const { data: fullBooking } = await getBookingById(newBooking.id);
        const bookingToShow = fullBooking || newBooking;
        // Display full screen ride request via Notifee
        try {
          // Prepare the payload (add bookingId for background actions)
          const payload = { ...bookingToShow, type: 'new_booking' };
          await displayFullScreenRideRequest(payload);
        } catch (e) {
          console.error('[NOTIFICATION CONTEXT] Failed to show Notifee intent', e);
        }
      },
      (removedBookingId: string) => {
        console.log('[NOTIFICATION CONTEXT] Booking removed:', removedBookingId);
        // If current notification matches, hide it
        if (currentNotification?.id === removedBookingId) {
          setCurrentNotification(null);
        }
        
        // Also cancel it from Notifee explicitly if it was on screen
        notifee.cancelNotification(removedBookingId).catch(() => {});
      }
    );

    return () => {
      console.log('[NOTIFICATION CONTEXT] Unsubscribing from ride requests');
      unsubscribe();
    };
  }, [driverProfile?.vehicle_type, driverProfile?.is_online]);

  // Handle notification taps
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(async (response) => {
      const data = response.notification.request.content.data;
      const bookingId = data?.bookingId;
      
      console.log('[NOTIFICATION CONTEXT] Notification tapped:', bookingId);
      
      if (bookingId) {
        // If we already have this notification showing, just bring app to foreground (default behavior)
        if (currentNotification?.id === bookingId) {
          return;
        }

        // Fetch booking details
        try {
          const { data: booking, error } = await getBookingById(bookingId);
          
          if (booking && !error) {
            console.log('[NOTIFICATION CONTEXT] Opening booking from notification');
            showNotification(booking);
          } else {
            console.error('[NOTIFICATION CONTEXT] Failed to fetch booking from notification:', error);
          }
        } catch (err) {
          console.error('[NOTIFICATION CONTEXT] Error handling notification tap:', err);
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, [currentNotification]);

  // Listen for Notifee actionable notification presses
  useEffect(() => {
    const unsubscribe = notifee.onForegroundEvent(async ({ type, detail }) => {
      const { notification, pressAction } = detail;

      if (type === EventType.ACTION_PRESS && pressAction?.id) {
        console.log('[NOTIFICATION CONTEXT] Notifee action pressed:', pressAction.id);
        const bookingId = notification?.data?.id;

        if (bookingId && typeof bookingId === 'string') {
          if (pressAction.id === 'accept_ride') {
             // First let's check if it's already accepted by this driver (via background task)
             const { data: booking } = await getBookingById(bookingId);
             if (booking?.driver_id === driverProfile.id && booking?.status === 'accepted') {
                console.log('[NOTIFICATION CONTEXT] Ride already accepted in background. Routing to ride screen.');
                router.push(`/ride/${bookingId}`);
             } else {
                await acceptRide(bookingId);
             }
          } else if (pressAction.id === 'decline_ride') {
            await declineRide(bookingId);
          }
        }
        
        // Remove the notification after taking action
        if (notification?.id) {
          await notifee.cancelNotification(notification.id);
        }
      }
    });

    return () => unsubscribe();
  }, [driverProfile?.id]);

  // Check for background accepted ride routes that bypassed Notifee launch intents
  useEffect(() => {
    async function checkPendingRoutes() {
      if (!driverProfile?.id) return;
      
      try {
        const pendingBookingId = await SecureStore.getItemAsync('pending_route_booking_id');
        if (pendingBookingId) {
          console.log('[NOTIFICATION CONTEXT] Found pending route booking from background:', pendingBookingId);
          await SecureStore.deleteItemAsync('pending_route_booking_id');
          router.push(`/ride/${pendingBookingId}`);
        }
      } catch (e) {
        console.error('Error checking pending routes', e);
      }
    }
    checkPendingRoutes();
  }, [driverProfile?.id]);

  // Handle killed state launch from Notifee actionable notification
  useEffect(() => {
    async function checkInitialNotification() {
      if (!driverProfile?.id || hasHandledInitial.current) return;

      const initialNotification = await notifee.getInitialNotification();

      if (initialNotification) {
        const { notification, pressAction } = initialNotification;
        if (pressAction?.id) {
          console.log('[NOTIFICATION CONTEXT] App opened from Notifee action (Initial):', pressAction.id);
          const bookingId = notification?.data?.id;

          if (bookingId && typeof bookingId === 'string') {
            hasHandledInitial.current = true; // Mark as handled

            if (pressAction.id === 'accept_ride') {
               // First let's check if it's already accepted by this driver (via background task)
               const { data: booking } = await getBookingById(bookingId);
               if (booking?.driver_id === driverProfile.id && booking?.status === 'accepted') {
                  console.log('[NOTIFICATION CONTEXT] Ride already accepted in background. Routing to ride screen.');
                  router.push(`/ride/${bookingId}`);
               } else {
                  await acceptRide(bookingId);
               }
            } else if (pressAction.id === 'decline_ride') {
              // If declined in background, we might not need to do anything, but calling it is safe
              await declineRide(bookingId);
            }
          }
          
          if (notification?.id) {
            await notifee.cancelNotification(notification.id);
          }
        }
      }
    }

    checkInitialNotification();
  }, [driverProfile?.id]);

  const showNotification = (booking: Booking) => {
    setCurrentNotification(booking);
  };

  const hideNotification = () => {
    setCurrentNotification(null);
  };

  const acceptRide = async (bookingId: string) => {
    if (!bookingId || !driverProfile?.id) {
      Alert.alert('Error', 'Unable to accept ride');
      return;
    }

    console.log('[NOTIFICATION CONTEXT] Accepting ride:', bookingId);
    
    const { success, error } = await acceptBooking(bookingId, driverProfile.id);
    
    if (success) {
      console.log('[NOTIFICATION CONTEXT] Ride accepted successfully');
      hideNotification();
      
      // Navigate to ride screen
      router.push(`/ride/${bookingId}`);
      
      Alert.alert('Success', 'Ride accepted! Navigate to pickup location.');
    } else {
      console.error('[NOTIFICATION CONTEXT] Failed to accept:', error);
      hideNotification();
      Alert.alert('Error', error || 'Failed to accept ride. It may have been taken by another driver.');
    }
  };

  const declineRide = async (bookingId: string) => {
    if (!bookingId) return;

    console.log('[NOTIFICATION CONTEXT] Declining ride:', bookingId);
    
    // Hide notification immediately
    hideNotification();

    // Persist decline in background
    await declineBooking(bookingId);
    
    console.log('[NOTIFICATION CONTEXT] Ride declined');
  };

  return (
    <RideNotificationContext.Provider
      value={{
        currentNotification: null,
        showNotification,
        hideNotification,
        acceptRide,
        declineRide,
      }}
    >
      {children}
    </RideNotificationContext.Provider>
  );
}

export function useRideNotification() {
  const context = useContext(RideNotificationContext);
  if (context === undefined) {
    throw new Error('useRideNotification must be used within RideNotificationProvider');
  }
  return context;
}
