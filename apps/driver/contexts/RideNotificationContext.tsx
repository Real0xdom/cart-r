// Ride Notification Context
// Global state for showing ride request notifications on any screen

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { acceptBooking, declineBooking, subscribeToAvailableBookings, getBookingById, Booking } from '@/lib/bookings';
import { RIDE_REQUESTS_CHANNEL } from '@/lib/notifications';
import { useAuth } from '@/contexts/AuthContext';
import { router } from 'expo-router';
import { Alert } from 'react-native';
import * as Notifications from 'expo-notifications';

// Configure notifications to show in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

interface RideNotificationContextType {
  currentNotification: Booking | null;
  showNotification: (booking: Booking) => void;
  hideNotification: () => void;
  acceptRide: () => Promise<void>;
  declineRide: () => Promise<void>;
}

const RideNotificationContext = createContext<RideNotificationContextType | undefined>(undefined);

export function RideNotificationProvider({ children }: { children: ReactNode }) {
  const { driverProfile } = useAuth();
  const [currentNotification, setCurrentNotification] = useState<Booking | null>(null);

  // Subscribe to new ride requests
  useEffect(() => {
    if (!driverProfile?.vehicle_type || !driverProfile?.is_online) {
      return;
    }

    console.log('[NOTIFICATION CONTEXT] Subscribing to ride requests for:', driverProfile.vehicle_type);

    const unsubscribe = subscribeToAvailableBookings(
      driverProfile.vehicle_type,
      (newBooking: Booking) => {
        console.log('[NOTIFICATION CONTEXT] New booking received:', newBooking.id);
        
        // Show in-app notification
        showNotification(newBooking);

        // Also send local notification
        Notifications.scheduleNotificationAsync({
          content: {
            title: '🚖 New Ride Request!',
            body: `₹${newBooking.driver_payout || newBooking.total_fare} • ${newBooking.origin_address.substring(0, 50)}...`,
            data: { bookingId: newBooking.id },
            sound: true,
            channelId: RIDE_REQUESTS_CHANNEL, // Ensure high priority channel
          },
          trigger: null, // Immediate
        });
      },
      (removedBookingId: string) => {
        console.log('[NOTIFICATION CONTEXT] Booking removed:', removedBookingId);
        // If current notification matches, hide it
        if (currentNotification?.id === removedBookingId) {
          setCurrentNotification(null);
        }
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

  const showNotification = (booking: Booking) => {
    setCurrentNotification(booking);
  };

  const hideNotification = () => {
    setCurrentNotification(null);
  };

  const acceptRide = async () => {
    if (!currentNotification || !driverProfile?.id) {
      Alert.alert('Error', 'Unable to accept ride');
      return;
    }

    console.log('[NOTIFICATION CONTEXT] Accepting ride:', currentNotification.id);
    
    const { success, error } = await acceptBooking(currentNotification.id, driverProfile.id);
    
    if (success) {
      console.log('[NOTIFICATION CONTEXT] Ride accepted successfully');
      hideNotification();
      
      // Navigate to ride screen
      router.push(`/ride/${currentNotification.id}`);
      
      Alert.alert('Success', 'Ride accepted! Navigate to pickup location.');
    } else {
      console.error('[NOTIFICATION CONTEXT] Failed to accept:', error);
      hideNotification();
      Alert.alert('Error', error || 'Failed to accept ride. It may have been taken by another driver.');
    }
  };

  const declineRide = async () => {
    if (!currentNotification) return;

    console.log('[NOTIFICATION CONTEXT] Declining ride:', currentNotification.id);
    
    // Hide notification immediately
    const bookingId = currentNotification.id;
    hideNotification();

    // Persist decline in background
    await declineBooking(bookingId);
    
    console.log('[NOTIFICATION CONTEXT] Ride declined');
  };

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
