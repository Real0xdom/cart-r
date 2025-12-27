// Push Notification Setup for Expo (Customer & Driver Apps)
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from './supabase';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Register for push notifications and get Expo push token
 */
export async function registerForPushNotifications(): Promise<string | null> {
  try {
    // Must use physical device
    if (!Device.isDevice) {
      console.log('Push notifications require a physical device');
      return null;
    }

    // Check existing permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // Request permissions if not granted
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Push notification permission not granted');
      return null;
    }

    // Get Expo push token
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: process.env.EXPO_PUBLIC_PROJECT_ID,
    });
    const pushToken = tokenData.data;

    console.log('Expo Push Token:', pushToken);

    // Save token to user's profile
    await savePushToken(pushToken);

    // Configure Android channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#22c55e',
      });

      await Notifications.setNotificationChannelAsync('rides', {
        name: 'Ride Updates',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#3b82f6',
        sound: 'default',
      });

      await Notifications.setNotificationChannelAsync('sos', {
        name: 'Emergency Alerts',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 500, 250, 500],
        lightColor: '#ef4444',
        sound: 'default',
      });
    }

    return pushToken;
  } catch (error) {
    console.error('Error registering for push notifications:', error);
    return null;
  }
}

/**
 * Save push token to user's profile
 */
async function savePushToken(token: string): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from('users')
      .update({ expo_push_token: token })
      .eq('id', user.id);

    console.log('Push token saved to profile');
  } catch (error) {
    console.error('Error saving push token:', error);
  }
}

/**
 * Add notification received listener
 */
export function addNotificationReceivedListener(
  callback: (notification: Notifications.Notification) => void
): Notifications.Subscription {
  return Notifications.addNotificationReceivedListener(callback);
}

/**
 * Add notification response listener (when user taps notification)
 */
export function addNotificationResponseListener(
  callback: (response: Notifications.NotificationResponse) => void
): Notifications.Subscription {
  return Notifications.addNotificationResponseReceivedListener(callback);
}

/**
 * Schedule a local notification
 */
export async function scheduleLocalNotification(
  title: string,
  body: string,
  data?: Record<string, any>,
  seconds: number = 1
): Promise<string> {
  const identifier = await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
      sound: true,
    },
    trigger: { seconds },
  });

  return identifier;
}

/**
 * Cancel a scheduled notification
 */
export async function cancelNotification(identifier: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(identifier);
}

/**
 * Get all pending notifications
 */
export async function getPendingNotifications(): Promise<Notifications.NotificationRequest[]> {
  return await Notifications.getAllScheduledNotificationsAsync();
}

/**
 * Clear all delivered notifications
 */
export async function clearAllNotifications(): Promise<void> {
  await Notifications.dismissAllNotificationsAsync();
}

/**
 * Get badge count
 */
export async function getBadgeCount(): Promise<number> {
  return await Notifications.getBadgeCountAsync();
}

/**
 * Set badge count
 */
export async function setBadgeCount(count: number): Promise<void> {
  await Notifications.setBadgeCountAsync(count);
}

/**
 * Handle notification data and navigate accordingly
 */
export function handleNotificationData(data: Record<string, any>, navigate: (route: string, params?: any) => void): void {
  const { type, booking_id, ticket_id, alert_id } = data;

  switch (type) {
    case 'ride_accepted':
    case 'driver_arrived':
    case 'trip_started':
    case 'trip_completed':
      if (booking_id) {
        navigate('/ride/tracking', { bookingId: booking_id });
      }
      break;
    case 'new_ride_request':
      if (booking_id) {
        navigate('/ride/request', { bookingId: booking_id });
      }
      break;
    case 'payment_success':
    case 'payment_failed':
      if (booking_id) {
        navigate('/ride/receipt', { bookingId: booking_id });
      }
      break;
    case 'ticket_update':
      if (ticket_id) {
        navigate('/support/ticket', { ticketId: ticket_id });
      }
      break;
    case 'sos_alert':
      if (alert_id) {
        navigate('/safety/alert', { alertId: alert_id });
      }
      break;
    case 'verification_approved':
    case 'verification_rejected':
      navigate('/onboarding/verification-pending');
      break;
    default:
      console.log('Unknown notification type:', type);
  }
}
