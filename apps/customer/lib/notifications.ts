// Customer App - Notification Setup
// Handles push notification registration, listeners, and local customer ride updates.

import { Platform, Alert, Linking } from 'react-native';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { supabase } from './supabase';

export const CUSTOMER_DRIVER_UPDATES_CHANNEL = 'customer_driver_updates';
export const CUSTOMER_TRIP_UPDATES_CHANNEL = 'customer_trip_updates';
export const CUSTOMER_PAYMENT_UPDATES_CHANNEL = 'customer_payment_updates';
export const CUSTOMER_MARKETING_CHANNEL = 'customer_marketing';

const getNotifications = () => {
  try {
    return require('expo-notifications');
  } catch (error) {
    console.warn('Expo Notifications not available:', error);
    return null;
  }
};

const CUSTOMER_PUSH_DEVICE_ID_KEY = 'customer_push_device_id';

async function getStableDeviceId(userId: string): Promise<string> {
  const fallbackId = `customer-device-${userId.slice(0, 8)}-${Date.now().toString(36)}`;

  try {
    const existingId = await SecureStore.getItemAsync(CUSTOMER_PUSH_DEVICE_ID_KEY);
    if (existingId) {
      return existingId;
    }

    const deviceId = `customer-device-${userId.slice(0, 8)}-${Math.random().toString(36).slice(2, 10)}`;
    await SecureStore.setItemAsync(CUSTOMER_PUSH_DEVICE_ID_KEY, deviceId);
    return deviceId;
  } catch (error) {
    console.warn('[registerPushToken] Could not read persisted customer device id:', error);
    return fallbackId;
  }
}

export async function initializeNotifications() {
  const Notifications = getNotifications();
  if (!Notifications) return;

  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });

    if (Platform.OS === 'android') {
      try {
        const driverUpdatesChannel = await Notifications.getNotificationChannelAsync(CUSTOMER_DRIVER_UPDATES_CHANNEL);
        if (!driverUpdatesChannel) {
          await Notifications.setNotificationChannelAsync(CUSTOMER_DRIVER_UPDATES_CHANNEL, {
            name: 'Driver Updates',
            importance: Notifications.AndroidImportance.HIGH,
            vibrationPattern: [0, 250, 250, 250],
            sound: 'default',
            enableVibrate: true,
            showBadge: true,
          });
        }

        const tripUpdatesChannel = await Notifications.getNotificationChannelAsync(CUSTOMER_TRIP_UPDATES_CHANNEL);
        if (!tripUpdatesChannel) {
          await Notifications.setNotificationChannelAsync(CUSTOMER_TRIP_UPDATES_CHANNEL, {
            name: 'Trip Updates',
            importance: Notifications.AndroidImportance.DEFAULT,
            sound: 'default',
            enableVibrate: true,
            showBadge: true,
          });
        }

        const paymentUpdatesChannel = await Notifications.getNotificationChannelAsync(CUSTOMER_PAYMENT_UPDATES_CHANNEL);
        if (!paymentUpdatesChannel) {
          await Notifications.setNotificationChannelAsync(CUSTOMER_PAYMENT_UPDATES_CHANNEL, {
            name: 'Payment Updates',
            importance: Notifications.AndroidImportance.DEFAULT,
            sound: 'default',
            enableVibrate: true,
            showBadge: true,
          });
        }

        const marketingChannel = await Notifications.getNotificationChannelAsync(CUSTOMER_MARKETING_CHANNEL);
        if (!marketingChannel) {
          await Notifications.setNotificationChannelAsync(CUSTOMER_MARKETING_CHANNEL, {
            name: 'Marketing',
            importance: Notifications.AndroidImportance.DEFAULT,
            sound: 'default',
            showBadge: true,
          });
        }

        console.log('Customer notification channels configured');
      } catch (error) {
        console.warn('Failed to setup notification channels:', error);
      }
    }
  } catch (error: any) {
    if (error?.message?.includes('Cannot find native module')) {
      console.warn('Expo Notifications native module missing. Please rebuild your development client.');
    } else {
      console.warn('Failed to initialize notifications:', error);
    }
  }
}

async function showLocalNotification(options: {
  title: string;
  body: string;
  channelId: string;
  data: Record<string, unknown>;
}) {
  const Notifications = getNotifications();
  if (!Notifications) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: options.title,
      body: options.body,
      sound: 'default',
      ...(Platform.OS === 'android' ? { channelId: options.channelId } : {}),
      data: options.data,
    },
    trigger: null,
  });
}

export async function showDriverAssignedNotification(bookingId: string) {
  await showLocalNotification({
    title: 'Driver Assigned',
    body: 'Your driver is on the way to pick up your goods.',
    channelId: CUSTOMER_DRIVER_UPDATES_CHANNEL,
    data: {
      type: 'driver_assigned',
      booking_id: bookingId,
      status: 'accepted',
      channel_id: CUSTOMER_DRIVER_UPDATES_CHANNEL,
    },
  });
}

export async function showDriverArrivedNotification(bookingId: string) {
  await showLocalNotification({
    title: 'Driver Arrived',
    body: 'Your driver has arrived at the pickup location.',
    channelId: CUSTOMER_DRIVER_UPDATES_CHANNEL,
    data: {
      type: 'driver_arrived',
      booking_id: bookingId,
      status: 'driver_arrived',
      channel_id: CUSTOMER_DRIVER_UPDATES_CHANNEL,
    },
  });
}

export async function showTripStartedNotification(bookingId: string) {
  await showLocalNotification({
    title: 'Trip Started',
    body: 'Your goods are now on the way.',
    channelId: CUSTOMER_TRIP_UPDATES_CHANNEL,
    data: {
      type: 'trip_started',
      booking_id: bookingId,
      status: 'in_progress',
      channel_id: CUSTOMER_TRIP_UPDATES_CHANNEL,
    },
  });
}

export async function showTripCompletedCustomerNotification(bookingId: string) {
  await showLocalNotification({
    title: 'Trip Completed',
    body: 'Your delivery has been completed successfully.',
    channelId: CUSTOMER_TRIP_UPDATES_CHANNEL,
    data: {
      type: 'trip_completed_customer',
      booking_id: bookingId,
      status: 'completed',
      channel_id: CUSTOMER_TRIP_UPDATES_CHANNEL,
    },
  });
}

export async function showPaymentSuccessNotification(bookingId: string) {
  await showLocalNotification({
    title: 'Payment Successful',
    body: 'Your payment has been captured successfully.',
    channelId: CUSTOMER_PAYMENT_UPDATES_CHANNEL,
    data: {
      type: 'payment_success',
      booking_id: bookingId,
      channel_id: CUSTOMER_PAYMENT_UPDATES_CHANNEL,
    },
  });
}

export async function showMarketingNotification(title: string, body: string) {
  await showLocalNotification({
    title,
    body,
    channelId: CUSTOMER_MARKETING_CHANNEL,
    data: {
      type: 'marketing',
      channel_id: CUSTOMER_MARKETING_CHANNEL,
    },
  });
}

export async function requestNotificationPermissions(): Promise<boolean> {
  const Notifications = getNotifications();
  if (!Notifications) return false;

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('Notification permissions not granted');
      return false;
    }

    return true;
  } catch (error: any) {
    if (error?.message?.includes('Cannot find native module')) {
      console.warn('Expo Notifications native module missing. Please rebuild your development client.');
    } else {
      console.error('Error requesting notification permissions:', error);
    }
    return false;
  }
}

export function showNotificationDeniedAlert() {
  Alert.alert(
    'Notifications Disabled',
    'You may miss important ride updates like driver assignment, arrival, and delivery completion. Enable notifications for the best experience.',
    [
      { text: 'Maybe Later', style: 'cancel' },
      {
        text: 'Open Settings',
        onPress: () => {
          if (Platform.OS === 'ios') {
            Linking.openURL('app-settings:');
          } else {
            Linking.openSettings();
          }
        },
      },
    ]
  );
}

export async function getExpoPushToken(): Promise<string | null> {
  const Notifications = getNotifications();
  if (!Notifications) {
    console.warn('Notifications module not available');
    return null;
  }

  try {
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) {
      console.warn('No notification permissions');
      return null;
    }

    console.log('Getting Expo push token...');
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

    if (!projectId) {
      console.warn('Missing EAS projectId in Expo config');
      return null;
    }

    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const tokenData = await Notifications.getExpoPushTokenAsync({
          projectId,
        });

        if (!tokenData?.data) {
          console.warn('No push token received');
          return null;
        }

        console.log('Push token obtained');
        return tokenData.data;
      } catch (error: any) {
        lastError = error;
        const errorMessage = String(error?.message || error);

        if (
          errorMessage.includes('FirebaseApp is not initialized') ||
          errorMessage.includes('Default FirebaseApp')
        ) {
          console.warn(
            '[PushToken] Firebase is not initialized in this Android build. ' +
            'Notification permission can still be ON, but Expo cannot mint a push token until the app is rebuilt with Firebase/google-services wired in.'
          );
          throw new Error('FIREBASE_NOT_CONFIGURED');
        }

        if (errorMessage.includes('Cannot find native module')) {
          console.warn('Expo Notifications native module missing. Please rebuild your development client.');
          return null;
        }

        console.warn(`Attempt ${attempt + 1}/3 to get push token failed.`, error);
        if (attempt < 2) {
          await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
        }
      }
    }

    console.error('Failed to get Expo push token after retries:', lastError);
  } catch (error: any) {
    if (error?.message === 'FIREBASE_NOT_CONFIGURED') {
      throw new Error('FIREBASE_NOT_CONFIGURED');
    } else {
      console.error('Error getting push token:', error);
    }
  }

  return null;
}

export async function registerPushToken(userId: string): Promise<boolean> {
  try {
    const token = await getExpoPushToken();
    if (!token) {
      return false;
    }

    console.log('[registerPushToken] Got token:', token.substring(0, 30) + '...');

    const deviceId = await getStableDeviceId(userId);

    let legacyUserTokenSaved = false;
    let multiDeviceTokenSaved = false;

    const { error: legacyUserError } = await supabase
      .from('users')
      .update({ expo_push_token: token })
      .eq('id', userId);

    if (legacyUserError) {
      console.warn('[registerPushToken] Failed to update users.expo_push_token fallback:', legacyUserError);
    } else {
      legacyUserTokenSaved = true;
      console.log('[registerPushToken] Token saved to users.expo_push_token fallback');
    }

    try {
      const { error: pushTokenError } = await supabase
        .from('push_tokens')
        .upsert(
          {
            user_id: userId,
            token,
            device_id: deviceId,
            app_type: 'customer',
            platform: Platform.OS,
            is_active: true,
          },
          { onConflict: 'user_id,device_id,app_type' }
        );

      if (pushTokenError) {
        const isMissingAppType =
          pushTokenError.message?.includes('app_type') ||
          pushTokenError.message?.includes('schema cache');

        if (isMissingAppType) {
          const { error: legacyPushTokenError } = await supabase
            .from('push_tokens')
            .upsert(
              {
                user_id: userId,
                token,
                device_id: deviceId,
                platform: Platform.OS,
                is_active: true,
              },
              { onConflict: 'user_id,device_id' }
            );

          if (legacyPushTokenError) {
            throw legacyPushTokenError;
          }

          multiDeviceTokenSaved = true;
          console.log('[registerPushToken] Token saved to legacy push_tokens schema');
        } else {
          throw pushTokenError;
        }
      } else {
        multiDeviceTokenSaved = true;
        console.log('[registerPushToken] Token saved to push_tokens table');
      }
    } catch (pushTokenError) {
      console.warn('[registerPushToken] push_tokens upsert failed:', pushTokenError);
    }

    if (!legacyUserTokenSaved && !multiDeviceTokenSaved) {
      console.error('[registerPushToken] Token was obtained but could not be saved anywhere.');
      return false;
    }

    console.log('[registerPushToken] Token saved successfully');
    return true;
  } catch (error: any) {
    if (error?.message === 'FIREBASE_NOT_CONFIGURED') {
      throw error;
    }
    console.error('[registerPushToken] Exception occurred:', error);
    return false;
  }
}

export function addNotificationReceivedListener(callback: (notification: any) => void) {
  const Notifications = getNotifications();
  if (!Notifications) return { remove: () => {} };

  try {
    return Notifications.addNotificationReceivedListener(callback);
  } catch (error) {
    console.warn('Failed to add notification received listener:', error);
    return { remove: () => {} };
  }
}

export function addNotificationResponseListener(callback: (response: any) => void) {
  const Notifications = getNotifications();
  if (!Notifications) return { remove: () => {} };

  try {
    return Notifications.addNotificationResponseReceivedListener(callback);
  } catch (error) {
    console.warn('Failed to add notification response listener:', error);
    return { remove: () => {} };
  }
}

export function parseNotificationData(notification: any): {
  type: string;
  bookingId?: string;
  status?: string;
} | null {
  try {
    const data = notification.request.content.data;
    if (!data) return null;

    return {
      type: data.type as string,
      bookingId: data.booking_id as string | undefined,
      status: data.status as string | undefined,
    };
  } catch {
    return null;
  }
}
