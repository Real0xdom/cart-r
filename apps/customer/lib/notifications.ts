// Customer App - Notification Setup
// Handles push notification registration and listeners

import { Platform, Alert, Linking } from 'react-native';
import { supabase } from './supabase';

// Helper to safely load the module
const getNotifications = () => {
  try {
    return require('expo-notifications');
  } catch (error) {
    console.warn('Expo Notifications not available:', error);
    return null;
  }
};

/**
 * Initialize all notification configuration
 */
export async function initializeNotifications() {
  const Notifications = getNotifications();
  if (!Notifications) return;

  try {
    // 1. Set handler
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });

    // 2. Setup channels (Android)
    if (Platform.OS === 'android') {
      try {
        await Notifications.setNotificationChannelAsync('booking-updates', {
          name: 'Booking Updates',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          sound: 'default',
          enableVibrate: true,
          showBadge: true,
        });

        await Notifications.setNotificationChannelAsync('default', {
          name: 'General',
          importance: Notifications.AndroidImportance.DEFAULT,
          sound: 'default',
        });

        console.log('✅ Customer notification channels configured');
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

/**
 * Request notification permissions
 */
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
      console.warn('⚠️ Notification permissions not granted');
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

/**
 * [G2] Show alert when notification permission is denied
 * Warns user they may miss ride updates and offers settings link
 */
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
        }
      }
    ]
  );
}

/**
 * Get the Expo Push Token
 */
export async function getExpoPushToken(): Promise<string | null> {
  const Notifications = getNotifications();
  if (!Notifications) {
    console.warn('❌ Notifications module not available');
    return null;
  }

  try {
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) {
      console.warn('❌ No notification permissions');
      return null;
    }

    console.log('🔄 Getting Expo push token...');
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: undefined,
    });

    if (!tokenData?.data) {
      console.warn('❌ No push token received');
      return null;
    }

    console.log('✅ Push token obtained');
    return tokenData.data;
  } catch (error: any) {
    if (error?.message?.includes('Cannot find native module')) {
      console.warn('Expo Notifications native module missing. Please rebuild your development client.');
    } else if (error?.message?.includes('FirebaseApp is not initialized')) {
      // Expected in dev (Expo Go) - no google-services.json
      // Keep this quiet to avoid log spam on every app reload
      console.warn('⚠️ Firebase not configured — push notifications disabled (expected in dev).');
      throw new Error('FIREBASE_NOT_CONFIGURED');
    } else {
      console.error('Error getting push token:', error);
    }
    return null;
  }
}

/**
 * Register push token with Supabase user record
 * [G5] Now also upserts into push_tokens table for multi-device support
 */
export async function registerPushToken(userId: string): Promise<boolean> {
  try {
    const token = await getExpoPushToken();
    if (!token) {
      return false;
    }

    console.log('🔑 [registerPushToken] Got token:', token.substring(0, 30) + '...');

    // Backward compatibility: update users table
    const { error } = await supabase
      .from('users')
      .update({ expo_push_token: token })
      .eq('id', userId);

    if (error) {
      console.error('❌ [registerPushToken] Supabase update error:', error);
      return false;
    }

    // [G5] Also upsert into push_tokens table for multi-device support
    try {
      let deviceId = 'unknown';
      try {
        const Constants = require('expo-constants').default;
        deviceId = Constants.installationId || Constants.sessionId || 'default-device';
      } catch {
        // expo-constants not available
        deviceId = `device-${Date.now()}`;
      }

      await supabase
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

      console.log('✅ [registerPushToken] Token saved to push_tokens table');
    } catch (pushTokenError) {
      // Non-critical — legacy path still works
      console.warn('⚠️ [registerPushToken] push_tokens upsert failed (non-critical):', pushTokenError);
    }

    console.log('✅ [registerPushToken] Token saved to database successfully');
    return true;
  } catch (error: any) {
    // Re-throw Firebase config errors so retry loop can bail
    if (error?.message === 'FIREBASE_NOT_CONFIGURED') {
      throw error;
    }
    console.error('❌ [registerPushToken] Exception occurred:', error);
    return false;
  }
}

/**
 * Add listener for incoming notifications
 */
export function addNotificationReceivedListener(
  callback: (notification: any) => void
) {
  const Notifications = getNotifications();
  if (!Notifications) return { remove: () => {} };

  try {
    return Notifications.addNotificationReceivedListener(callback);
  } catch (error) {
    console.warn('Failed to add notification received listener:', error);
    return { remove: () => {} };
  }
}

/**
 * Add listener for notification taps (when user taps on notification)
 */
export function addNotificationResponseListener(
  callback: (response: any) => void
) {
  const Notifications = getNotifications();
  if (!Notifications) return { remove: () => {} };

  try {
    return Notifications.addNotificationResponseReceivedListener(callback);
  } catch (error) {
    console.warn('Failed to add notification response listener:', error);
    return { remove: () => {} };
  }
}

/**
 * Parse notification data to handle navigation
 */
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
