// Driver App - Notification Setup
// Configures Android notification channels (High Priority + Wake Lock)

import * as Notifications from 'expo-notifications';
import { Platform, Alert, Linking } from 'react-native';

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

    // Add delay for Firebase initialization if needed
    // This helps in cases where Firebase hasn't been initialized yet
    let lastError: any;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        // Get push token - must provide projectId for dev builds
        const tokenData = await Notifications.getExpoPushTokenAsync({
          projectId: '81d0a3a8-050d-4190-a31c-78e75e869b4d', // EAS projectId from app.json
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
      console.error('❌ [Driver] Supabase update error:', error);
      return false;
    }

    console.log('✅ [Driver] Push token registered successfully');
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
