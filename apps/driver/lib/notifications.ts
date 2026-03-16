// Driver App - Notification Setup
// Configures Android notification channels (High Priority + Wake Lock)

import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform, Alert, Linking } from 'react-native';
import * as TaskManager from 'expo-task-manager';
import notifee, { AndroidImportance, AndroidVisibility, EventType, AndroidCategory } from '@notifee/react-native';
import * as SecureStore from 'expo-secure-store';

const BACKGROUND_NOTIFICATION_TASK = 'BACKGROUND-NOTIFICATION-TASK';

TaskManager.defineTask(BACKGROUND_NOTIFICATION_TASK, async ({ data, error }) => {
  if (error) {
    console.error('Background task error:', error);
    return;
  }
  if (data) {
    console.log('Received background push message:', data);
    const notification = (data as any).notification;
    const payload = notification?.request?.trigger?.remoteMessage?.data || notification?.data;
    
    if (payload?.is_data_only || payload?.type === 'new_booking') {
      try {
        // Make sure parse JSON if stringified
        const parsedPayload = typeof payload === 'string' ? JSON.parse(payload) : payload;
        await displayFullScreenRideRequest(parsedPayload);
      } catch (e) {
        console.error('Failed to display full screen notification:', e);
      }
    }
  }
});

notifee.onBackgroundEvent(async ({ type, detail }) => {
  console.log('Notifee Background Event:', type);
  const { notification, pressAction } = detail;

  if (type === EventType.ACTION_PRESS && pressAction?.id && notification?.data?.id) {
    const bookingId = String(notification.data.id);
    console.log('[BACKGROUND] Action pressed:', pressAction.id, bookingId);

    // Import Supabase inside handler to avoid initialization issues
    const { supabase } = require('./supabase');

    if (pressAction.id === 'accept_ride') {
      // Fetch driver ID from Supabase Auth
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: driverData } = await supabase
          .from('drivers')
          .select('id')
          .eq('user_id', user.id)
          .single();

        if (driverData?.id) {
          console.log('[BACKGROUND] Accepting ride via background RPC');
          const { error } = await supabase.rpc('accept_booking_atomic', {
            p_booking_id: bookingId,
            p_driver_id: driverData.id,
          });
          
          if (!error) {
            // Save to SecureStore so when the app UI spins up, it routes here
            await SecureStore.setItemAsync('pending_route_booking_id', bookingId);
          } else {
             console.error('[BACKGROUND] Error accepting ride:', error);
          }
        }
      }
    } else if (pressAction.id === 'decline_ride') {
      // Just dismiss — don't persist decline so other drivers can still see the booking
      console.log('[BACKGROUND] Decline pressed — dismissing notification only');
    }

    if (notification.id) {
      await notifee.cancelNotification(notification.id);
    }
  }
});

// Notification channel for ride requests (Android)
export const RIDE_REQUESTS_CHANNEL = 'ride-requests';

/**
 * Configure notification handling behavior
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Setup Android notification channels
 * Call this on app startup (in _layout.tsx or App.tsx)
 */
export async function setupNotificationChannels() {
  if (Platform.OS === 'android') {
    // High-priority channel for ride requests (will show as heads-up notification)
    await Notifications.setNotificationChannelAsync(RIDE_REQUESTS_CHANNEL, {
      name: 'Ride Requests',
      importance: Notifications.AndroidImportance.MAX, // MAX importance for overlay
      vibrationPattern: [0, 250, 250, 250], // Vibration pattern
      lightColor: '#FF231F7C',
      sound: 'default',
      bypassDnd: true, // Bypass Do Not Disturb
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      enableVibrate: true,
      enableLights: true,
      showBadge: true,
    });

    // Default channel for other notifications
    await Notifications.setNotificationChannelAsync('default', {
      name: 'General Notifications',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: 'default',
    });

    console.log('✅ Android notification channels configured');
  }

  // Register background task for push notifications (works on iOS & Android)
  try {
    await Notifications.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK);
    console.log('✅ Background push task registered');
  } catch (err) {
    console.error('❌ Failed to register background push task:', err);
  }
}

/**
 * Display a full screen ride request intent using Notifee
 */
export async function displayFullScreenRideRequest(data: any) {
  if (Platform.OS !== 'android') return; // Full screen intents are Android only

  const channelId = await notifee.createChannel({
    id: 'ride_requests_fullscreen',
    name: 'Ride Requests (Full Screen)',
    importance: AndroidImportance.HIGH,
    vibration: true,
    vibrationPattern: [300, 500, 300, 500],
    bypassDnd: true,
  });

  const dataPayload: Record<string, string> = {
    id: String(data?.id || data?.bookingId || data?.booking_id || ''),
    type: String(data?.type || 'new_booking'),
  };

  const fare = data?.total_fare || 'N/A';
  const tipInfo = data?.tip_amount && Number(data.tip_amount) > 0 ? ` (+₹${data.tip_amount} tip)` : '';
  const pickup = data?.origin_address ? String(data.origin_address).substring(0, 50) + '...' : 'Unknown Location';

  await notifee.displayNotification({
    title: '🚨 New Ride Request!',
    body: `₹${fare}${tipInfo} • ${pickup}\nTap to accept or decline.`,
    data: dataPayload,
    android: {
      channelId,
      importance: AndroidImportance.HIGH,
      visibility: AndroidVisibility.PUBLIC,
      category: AndroidCategory.CALL, // Tricks Android into allowing full screen more reliably
      timeoutAfter: 30000, // 30 seconds before auto-dismissing
      fullScreenAction: {
        id: 'default',
      },
      pressAction: {
        id: 'default',
        launchActivity: 'default',
      },
      actions: [
        {
          title: 'Accept Ride',
          pressAction: { id: 'accept_ride', launchActivity: 'default' },
        },
        {
          title: 'Decline',
          pressAction: { id: 'decline_ride', launchActivity: 'default' },
        },
      ],
    },
  });
}

/**
 * Request notification permissions
 * @param openSettingsIfDenied If true, prompt user to open settings if permission is denied
 */
export async function requestNotificationPermissions(openSettingsIfDenied = false): Promise<boolean> {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Notification permissions not granted');
      
      if (openSettingsIfDenied) {
          Alert.alert(
              'Notifications Required',
              'To receive ride requests, please enable notifications in your phone settings.',
              [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Open Settings', onPress: () => Linking.openSettings() }
              ]
          );
      }
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error requesting notification permissions:', error);
    return false;
  }
}

/**
 * Get the Expo Push Token for push notifications
 */
export async function getExpoPushToken(): Promise<string | null> {
  try {
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) return null;

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;

    if (!projectId) {
      console.error('Missing EAS projectId in Expo config');
      return null;
    }

    // Add delay for Firebase initialization if needed
    // This helps in cases where Firebase hasn't been initialized yet
    let lastError: any;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        // Get push token - must provide projectId for dev builds
        const tokenData = await Notifications.getExpoPushTokenAsync({
          projectId,
        });

        console.log('📱 Got push token:', tokenData.data);
        return tokenData.data;
      } catch (error) {
        lastError = error;
        console.warn(`Attempt ${attempt + 1}/3 to get push token failed, retrying...`, error);
        // Wait before retrying (exponential backoff: 500ms, 1000ms, etc)
        await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
      }
    }
    
    // All attempts failed
    console.error('Failed to get push token after 3 attempts:', lastError);
    return null;
  } catch (error) {
    console.error('Error getting push token:', error);
    return null;
  }
}

/**
 * Register push token with Supabase user record
 */
export async function registerPushToken(supabase: any, userId: string): Promise<boolean> {
  try {
    console.log('🔄 [Driver] registerPushToken Starting token registration for user:', userId);
    
    const token = await getExpoPushToken();
    if (!token) {
      console.warn('❌ [Driver] No push token obtained - permission denied or module issue');
      return false;
    }

    console.log('🔑 [Driver] Got token:', token.substring(0, 30) + '...');

    const { error } = await supabase
      .from('users')
      .update({ expo_push_token: token })
      .eq('id', userId);

    if (error) {
      console.error('❌ [Driver] Supabase users table update error:', error);
      // Continue to push_tokens table even if users update fails
    }

    // [G5] Also upsert into push_tokens table for multi-device support
    try {
      let deviceId = 'unknown';
      try {
        // Use expo-constants to get a reliable device ID if possible
        const Constants = require('expo-constants').default;
        deviceId = Constants.installationId || Constants.sessionId || `device-${userId.substring(0, 8)}`;
      } catch {
        deviceId = `driver-device-${userId.substring(0, 8)}`;
      }

      const { error: pushTokenError } = await supabase
        .from('push_tokens')
        .upsert(
          {
            user_id: userId,
            token: token,
            device_id: deviceId,
            platform: Platform.OS,
            is_active: true,
          },
          { onConflict: 'user_id,device_id' }
        );

      if (pushTokenError) {
        console.warn('⚠️ [Driver] push_tokens upsert failed (non-critical):', pushTokenError);
      } else {
        console.log('✅ [Driver] Token saved to push_tokens table');
      }
    } catch (err) {
      console.warn('⚠️ [Driver] Error upserting to push_tokens:', err);
    }

    console.log('✅ [Driver] Push token registration finished');
    return true;
  } catch (error) {
    console.error('❌ [Driver] Error registering push token:', error);
    return false;
  }
}

/**
 * Add listener for incoming notifications
 */
export function addNotificationReceivedListener(
  callback: (notification: Notifications.Notification) => void
) {
  return Notifications.addNotificationReceivedListener(callback);
}

/**
 * Add listener for notification taps
 */
export function addNotificationResponseListener(
  callback: (response: Notifications.NotificationResponse) => void
) {
  return Notifications.addNotificationResponseReceivedListener(callback);
}

