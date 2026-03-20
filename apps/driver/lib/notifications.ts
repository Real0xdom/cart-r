// Driver App - Notification Setup
// Configures Android notification channels and ride request heads-up flows.

import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Alert, Linking, Platform } from 'react-native';
import * as TaskManager from 'expo-task-manager';
import notifee, {
  AndroidCategory,
  AndroidImportance,
  AndroidStyle,
  AndroidVisibility,
  EventType,
  TriggerType,
  type Notification,
  type TimestampTrigger,
} from '@notifee/react-native';
import * as SecureStore from 'expo-secure-store';
import type { Booking } from './bookings';

const BACKGROUND_NOTIFICATION_TASK = 'BACKGROUND-NOTIFICATION-TASK';
const RIDE_REQUESTS_FULLSCREEN_CHANNEL = 'driver_ride_request_urgent';
const TRIP_STATUS_CHANNEL = 'driver_trip_status';
const DRIVER_MARKETING_CHANNEL = 'driver_marketing';

export const RIDE_REQUESTS_CHANNEL = RIDE_REQUESTS_FULLSCREEN_CHANNEL;
export const RIDE_REQUEST_COUNTDOWN_SECONDS = 10;
export const RIDE_REQUEST_TIMEOUT_MS = 30_000;
export const RIDE_REQUEST_CLIENT_CANCEL_MS = 28_000;

const rideRequestUpdateTimers = new Map<string, ReturnType<typeof setInterval>>();
const rideRequestClientCancelTimers = new Map<string, ReturnType<typeof setTimeout>>();
const rideRequestServerTimeoutTimers = new Map<string, ReturnType<typeof setTimeout>>();

type RideRequestNotificationInput = Partial<
  Pick<
    Booking,
    | 'id'
    | 'origin_address'
    | 'destination_address'
    | 'total_fare'
    | 'tip_amount'
    | 'estimated_distance'
    | 'estimated_duration'
    | 'payment_method'
  >
> & {
  bookingId?: string;
  booking_id?: string;
  type?: string;
  available_at?: number | string;
  expires_at_ms?: number | string;
  local_cancel_at_ms?: number | string;
};

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function trimAddress(value: unknown, maxLength = 64): string {
  const text = typeof value === 'string' && value.trim().length > 0 ? value.trim() : 'Unknown location';
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}...` : text;
}

function formatCurrency(value: unknown): string {
  const amount = toNumber(value);
  return amount === null ? 'Fare pending' : `₹${Math.round(amount)}`;
}

function formatDistance(value: unknown): string {
  const distance = toNumber(value);
  return distance === null ? '-- km' : `${distance.toFixed(1)} km`;
}

function formatDuration(value: unknown): string {
  const duration = toNumber(value);
  return duration === null ? '-- min' : `~${Math.round(duration)} min`;
}

function getRideRequestBookingId(data: RideRequestNotificationInput): string {
  const rawId = data.id ?? data.bookingId ?? data.booking_id;
  return rawId ? String(rawId) : '';
}

export function getRideRequestNotificationId(bookingId: string): string {
  return `ride_request_${bookingId}`;
}

function clearRideRequestUpdateTimer(notificationId: string) {
  const timer = rideRequestUpdateTimers.get(notificationId);
  if (timer) {
    clearInterval(timer);
    rideRequestUpdateTimers.delete(notificationId);
  }
}

function clearRideRequestClientCancelTimer(notificationId: string) {
  const timer = rideRequestClientCancelTimers.get(notificationId);
  if (timer) {
    clearTimeout(timer);
    rideRequestClientCancelTimers.delete(notificationId);
  }
}

function clearRideRequestServerTimeoutTimer(notificationId: string) {
  const timer = rideRequestServerTimeoutTimers.get(notificationId);
  if (timer) {
    clearTimeout(timer);
    rideRequestServerTimeoutTimers.delete(notificationId);
  }
}

function resolveRideRequestTiming(data: RideRequestNotificationInput) {
  const now = Date.now();
  const rpcTimeoutAt = toNumber(data.expires_at_ms) ?? now + RIDE_REQUEST_TIMEOUT_MS;
  const localCancelAt = Math.min(
    toNumber(data.local_cancel_at_ms) ?? now + RIDE_REQUEST_CLIENT_CANCEL_MS,
    rpcTimeoutAt
  );

  return {
    availableAt: toNumber(data.available_at) ?? now + RIDE_REQUEST_COUNTDOWN_SECONDS * 1000,
    localCancelAt,
    rpcTimeoutAt,
  };
}

export function getRideRequestCountdownRemainingSeconds(data: RideRequestNotificationInput): number {
  const { availableAt } = resolveRideRequestTiming(data);
  return Math.max(0, Math.ceil((availableAt - Date.now()) / 1000));
}

export function isRideRequestResponseUnlocked(data: RideRequestNotificationInput): boolean {
  return getRideRequestCountdownRemainingSeconds(data) === 0;
}

function buildRideRequestNotification(
  data: RideRequestNotificationInput,
  options: {
    channelId: string;
      remainingSeconds: number;
      availableAt: number;
      localCancelAt: number;
      rpcTimeoutAt: number;
      fullScreen?: boolean;
  }
): Notification {
  const bookingId = getRideRequestBookingId(data);
  const pickup = trimAddress(data.origin_address);
  const dropoff = trimAddress(data.destination_address);
  const fare = formatCurrency(data.total_fare);
  const distance = formatDistance(data.estimated_distance);
  const duration = formatDuration(data.estimated_duration);
  const paymentMethod = typeof data.payment_method === 'string' ? data.payment_method.toUpperCase() : 'PAYMENT';
  const tipAmount = toNumber(data.tip_amount);
  const isUnlocked = options.remainingSeconds === 0;
  const countdownText = isUnlocked
    ? 'You can now respond.'
    : `Please wait ${options.remainingSeconds}s before responding.`;

  const body = [
    `Pickup: ${pickup}`,
    `Drop: ${dropoff}`,
    `${fare}${tipAmount && tipAmount > 0 ? ` (+₹${Math.round(tipAmount)} tip)` : ''} • ${distance} • ${duration}`,
    `${paymentMethod} • ${countdownText}`,
  ].join('\n');

  return {
    id: getRideRequestNotificationId(bookingId),
    title: 'NEW RIDE REQUEST',
    subtitle: `${fare} • ${distance} • ${duration}`,
    body,
    data: {
      id: bookingId,
      bookingId,
      type: String(data.type || 'new_booking'),
      available_at: String(options.availableAt),
      expires_at_ms: String(options.rpcTimeoutAt),
      local_cancel_at_ms: String(options.localCancelAt),
      origin_address: pickup,
      destination_address: dropoff,
    },
    android:
      Platform.OS === 'android'
        ? {
            channelId: options.channelId,
            importance: AndroidImportance.HIGH,
            visibility: AndroidVisibility.PUBLIC,
            category: AndroidCategory.CALL,
            color: '#10B981',
            pressAction: {
              id: 'default',
              launchActivity: 'default',
            },
            fullScreenAction: options.fullScreen
              ? {
                  id: 'default',
                  launchActivity: 'default',
                }
              : undefined,
            ongoing: true,
            autoCancel: false,
            onlyAlertOnce: true,
            showTimestamp: false,
            showChronometer: !isUnlocked,
            chronometerDirection: 'down',
            timestamp: options.availableAt,
            timeoutAfter: Math.max(0, options.localCancelAt - Date.now()),
            progress: {
              max: RIDE_REQUEST_COUNTDOWN_SECONDS,
              current: isUnlocked
                ? RIDE_REQUEST_COUNTDOWN_SECONDS
                : Math.max(0, RIDE_REQUEST_COUNTDOWN_SECONDS - options.remainingSeconds),
            },
            style: {
              type: AndroidStyle.BIGTEXT,
              text: body,
            },
            actions: isUnlocked
              ? [
                  {
                    title: 'Accept Ride',
                    pressAction: { id: 'accept_ride', launchActivity: 'default' },
                  },
                  {
                    title: 'Reject',
                    pressAction: { id: 'decline_ride', launchActivity: 'default' },
                  },
                ]
              : [],
          }
        : undefined,
  };
}

async function ensureRideRequestChannel(): Promise<string> {
  if (Platform.OS !== 'android') {
    return RIDE_REQUESTS_CHANNEL;
  }

  const existingChannel = await notifee.getChannel(RIDE_REQUESTS_FULLSCREEN_CHANNEL);
  if (existingChannel) {
    return existingChannel.id;
  }

  return notifee.createChannel({
    id: RIDE_REQUESTS_FULLSCREEN_CHANNEL,
    name: 'Ride Requests',
    importance: AndroidImportance.HIGH,
    sound: 'default',
    vibration: true,
    vibrationPattern: [300, 500, 300, 500],
    bypassDnd: true,
  });
}

async function ensureTripStatusChannel(): Promise<string> {
  if (Platform.OS !== 'android') {
    return 'default';
  }

  const existingChannel = await notifee.getChannel(TRIP_STATUS_CHANNEL);
  if (existingChannel) {
    return existingChannel.id;
  }

  return notifee.createChannel({
    id: TRIP_STATUS_CHANNEL,
    name: 'Trip Status',
    importance: AndroidImportance.HIGH,
    sound: 'default',
    vibration: true,
    vibrationPattern: [150, 120, 150, 120],
  });
}

async function ensureMarketingChannel(): Promise<string> {
  if (Platform.OS !== 'android') {
    return 'default';
  }

  const existingChannel = await notifee.getChannel(DRIVER_MARKETING_CHANNEL);
  if (existingChannel) {
    return existingChannel.id;
  }

  return notifee.createChannel({
    id: DRIVER_MARKETING_CHANNEL,
    name: 'Marketing',
    importance: AndroidImportance.DEFAULT,
    sound: 'default',
  });
}

async function scheduleRideRequestUnlockNotification(
  data: RideRequestNotificationInput,
  channelId: string,
  availableAt: number,
  localCancelAt: number,
  rpcTimeoutAt: number
) {
  if (Platform.OS !== 'android' || isRideRequestResponseUnlocked({ ...data, available_at: availableAt })) {
    return;
  }

  const trigger: TimestampTrigger = {
    type: TriggerType.TIMESTAMP,
    timestamp: availableAt,
  };

  await notifee.createTriggerNotification(
    buildRideRequestNotification(
      { ...data, available_at: availableAt, expires_at_ms: rpcTimeoutAt, local_cancel_at_ms: localCancelAt },
      {
        channelId,
        remainingSeconds: 0,
        availableAt,
        localCancelAt,
        rpcTimeoutAt,
      }
    ),
    trigger
  );
}

async function startRideRequestProgressUpdates(
  data: RideRequestNotificationInput,
  channelId: string,
  availableAt: number,
  localCancelAt: number,
  rpcTimeoutAt: number
) {
  if (Platform.OS !== 'android') {
    return;
  }

  const notificationId = getRideRequestNotificationId(getRideRequestBookingId(data));
  clearRideRequestUpdateTimer(notificationId);

  const updateNotification = async () => {
    const remainingSeconds = Math.max(0, Math.ceil((availableAt - Date.now()) / 1000));

    await notifee.displayNotification(
      buildRideRequestNotification(
        { ...data, available_at: availableAt, expires_at_ms: rpcTimeoutAt, local_cancel_at_ms: localCancelAt },
        {
          channelId,
          remainingSeconds,
          availableAt,
          localCancelAt,
          rpcTimeoutAt,
        }
      )
    );

    if (remainingSeconds === 0) {
      clearRideRequestUpdateTimer(notificationId);
    }
  };

  await updateNotification();

  if (Date.now() >= availableAt) {
    return;
  }

  const timer = setInterval(() => {
    void updateNotification();
  }, 1000);

  rideRequestUpdateTimers.set(notificationId, timer);
}

async function markRideRequestTimedOut(bookingId: string) {
  try {
    const { supabase } = require('./supabase');
    const { error } = await supabase.rpc('decline_booking' as any, {
      p_booking_id: bookingId,
    });

    if (error) {
      console.error('[TIMEOUT] Failed to mark ride request as timed out:', error);
    }
  } catch (timeoutError) {
    console.error('[TIMEOUT] Unexpected timeout handler error:', timeoutError);
  }
}

function scheduleRideRequestTimeouts(
  data: RideRequestNotificationInput,
  localCancelAt: number,
  rpcTimeoutAt: number
) {
  const bookingId = getRideRequestBookingId(data);
  const notificationId = getRideRequestNotificationId(bookingId);
  const localCancelDelay = Math.max(0, localCancelAt - Date.now());
  const rpcTimeoutDelay = Math.max(0, rpcTimeoutAt - Date.now());

  clearRideRequestClientCancelTimer(notificationId);
  clearRideRequestServerTimeoutTimer(notificationId);

  rideRequestClientCancelTimers.set(
    notificationId,
    setTimeout(() => {
      void cancelRideRequestNotification(bookingId, { clearServerTimeout: false });
    }, localCancelDelay)
  );

  rideRequestServerTimeoutTimers.set(
    notificationId,
    setTimeout(() => {
      void markRideRequestTimedOut(bookingId);
      clearRideRequestServerTimeoutTimer(notificationId);
    }, rpcTimeoutDelay)
  );
}

async function isCurrentDriverOnline(): Promise<boolean> {
  try {
    const { supabase } = require('./supabase');
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return false;
    }

    const { data: driver } = await supabase
      .from('drivers')
      .select('is_online')
      .eq('user_id', user.id)
      .maybeSingle();

    return !!driver?.is_online;
  } catch (error) {
    console.error('Failed to check current driver online state:', error);
    return false;
  }
}

TaskManager.defineTask(BACKGROUND_NOTIFICATION_TASK, async ({ data, error }) => {
  if (error) {
    console.error('Background task error:', error);
    return;
  }

  if (!data) {
    return;
  }

  console.log('Received background push message:', data);
  const notification = (data as any).notification;
  const payload = notification?.request?.trigger?.remoteMessage?.data || notification?.data;

  if (payload?.is_data_only || payload?.type === 'new_booking') {
    try {
      const parsedPayload = typeof payload === 'string' ? JSON.parse(payload) : payload;
      const isOnline = await isCurrentDriverOnline();
      if (!isOnline) {
        console.log('Skipping background ride request because driver is offline');
        return;
      }
      await displayFullScreenRideRequest(parsedPayload);
    } catch (taskError) {
      console.error('Failed to display full screen notification:', taskError);
    }
  }
});

notifee.onBackgroundEvent(async ({ type, detail }) => {
  console.log('Notifee Background Event:', type);
  const { notification, pressAction } = detail;

  if (type !== EventType.ACTION_PRESS || !pressAction?.id || !notification?.data?.id) {
    return;
  }

  const bookingId = String(notification.data.id);
  console.log('[BACKGROUND] Action pressed:', pressAction.id, bookingId);

  if ((pressAction.id === 'accept_ride' || pressAction.id === 'decline_ride') && !isRideRequestResponseUnlocked(notification.data as RideRequestNotificationInput)) {
    console.log('[BACKGROUND] Action pressed before countdown finished. Ignoring.');
    return;
  }

  if (pressAction.id === 'decline_ride') {
    console.log('[BACKGROUND] Decline pressed - dismissing notification only');
    await cancelRideRequestNotification(bookingId);
    return;
  }

  if (pressAction.id !== 'accept_ride') {
    return;
  }

  try {
    const { supabase } = require('./supabase');
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return;
    }

    const { data: driverData } = await supabase
      .from('drivers')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!driverData?.id) {
      return;
    }

    console.log('[BACKGROUND] Accepting ride via background RPC');
    const { data: acceptResult, error: acceptError } = await supabase.rpc('accept_booking_atomic', {
      p_booking_id: bookingId,
      p_driver_id: driverData.id,
    });

    if (acceptError) {
      console.error('[BACKGROUND] Error accepting ride:', acceptError);
      return;
    }

    if (!(acceptResult as any)?.success) {
      console.warn('[BACKGROUND] Ride acceptance was rejected by RPC:', acceptResult);
      return;
    }

    const assignmentMode = (acceptResult as any)?.assignment_mode;
    if (assignmentMode !== 'queued') {
      await SecureStore.setItemAsync('pending_route_booking_id', bookingId);
      await showTripAcceptedNotification({
        id: bookingId,
        origin_address: String(notification.data.origin_address || ''),
        destination_address: String(notification.data.destination_address || ''),
      });
    }

    try {
      const { refreshLocationTrackingNotification } = require('./location');
      await refreshLocationTrackingNotification();
    } catch (refreshError) {
      console.error('[BACKGROUND] Failed to refresh foreground service notification:', refreshError);
    }

    await cancelRideRequestNotification(bookingId);
  } catch (backgroundError) {
    console.error('[BACKGROUND] Failed handling ride request action:', backgroundError);
  }
});

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
    const existingRideRequestsChannel = await Notifications.getNotificationChannelAsync(RIDE_REQUESTS_CHANNEL);
    if (!existingRideRequestsChannel) {
      await Notifications.setNotificationChannelAsync(RIDE_REQUESTS_CHANNEL, {
        name: 'Ride Requests',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
        sound: 'default',
        bypassDnd: true,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        enableVibrate: true,
        enableLights: true,
        showBadge: true,
      });
    }

    const existingTripStatusChannel = await Notifications.getNotificationChannelAsync(TRIP_STATUS_CHANNEL);
    if (!existingTripStatusChannel) {
      await Notifications.setNotificationChannelAsync(TRIP_STATUS_CHANNEL, {
        name: 'Trip Status',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        sound: 'default',
        enableVibrate: true,
        showBadge: true,
      });
    }

    const existingMarketingChannel = await Notifications.getNotificationChannelAsync(DRIVER_MARKETING_CHANNEL);
    if (!existingMarketingChannel) {
      await Notifications.setNotificationChannelAsync(DRIVER_MARKETING_CHANNEL, {
        name: 'Marketing',
        importance: Notifications.AndroidImportance.DEFAULT,
        sound: 'default',
      });
    }

    try {
      await Promise.all([ensureRideRequestChannel(), ensureTripStatusChannel(), ensureMarketingChannel()]);
    } catch (channelError) {
      console.error('Failed to create Notifee channels:', channelError);
    }

    console.log('Android notification channels configured');
  }

  try {
    await Notifications.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK);
    console.log('Background push task registered');
  } catch (registerError) {
    console.error('Failed to register background push task:', registerError);
  }
}

/**
 * Display a ride request notification using Notifee.
 * On Android this is a large heads-up card with a 10 second gated unlock.
 */
export async function displayFullScreenRideRequest(data: RideRequestNotificationInput) {
  const bookingId = getRideRequestBookingId(data);
  if (!bookingId) {
    return;
  }

  const channelId = await ensureRideRequestChannel();
  const { availableAt, localCancelAt, rpcTimeoutAt } = resolveRideRequestTiming(data);
  const remainingSeconds = Math.max(0, Math.ceil((availableAt - Date.now()) / 1000));

  await notifee.displayNotification(
    buildRideRequestNotification(
      {
        ...data,
        id: bookingId,
        available_at: availableAt,
        expires_at_ms: rpcTimeoutAt,
        local_cancel_at_ms: localCancelAt,
      },
      {
        channelId,
        remainingSeconds,
        availableAt,
        localCancelAt,
        rpcTimeoutAt,
        fullScreen: Platform.OS === 'android',
      }
    )
  );

  scheduleRideRequestTimeouts(data, localCancelAt, rpcTimeoutAt);
  await scheduleRideRequestUnlockNotification(data, channelId, availableAt, localCancelAt, rpcTimeoutAt);
  await startRideRequestProgressUpdates(data, channelId, availableAt, localCancelAt, rpcTimeoutAt);
}

export async function cancelRideRequestNotification(
  bookingId: string,
  options: {
    clearServerTimeout?: boolean;
  } = {}
) {
  const notificationId = getRideRequestNotificationId(bookingId);
  clearRideRequestUpdateTimer(notificationId);
  clearRideRequestClientCancelTimer(notificationId);
  if (options.clearServerTimeout ?? true) {
    clearRideRequestServerTimeoutTimer(notificationId);
  }
  await notifee.cancelNotification(notificationId);
}

export async function showTripAcceptedNotification(
  data: Pick<RideRequestNotificationInput, 'id' | 'bookingId' | 'booking_id' | 'origin_address' | 'destination_address'>
) {
  const bookingId = getRideRequestBookingId(data);
  if (!bookingId) {
    return;
  }

  const channelId = await ensureTripStatusChannel();
  const pickup = trimAddress(data.origin_address);
  const dropoff = trimAddress(data.destination_address);

  await notifee.displayNotification({
    id: `trip_accepted_${bookingId}`,
    title: 'Trip Accepted',
    body: `Head to pickup: ${pickup}${dropoff ? `\nDrop: ${dropoff}` : ''}`,
    data: {
      id: bookingId,
      bookingId,
      type: 'trip_accepted',
    },
    android:
      Platform.OS === 'android'
        ? {
            channelId,
            importance: AndroidImportance.HIGH,
            visibility: AndroidVisibility.PUBLIC,
            color: '#10B981',
            pressAction: {
              id: 'default',
              launchActivity: 'default',
            },
            autoCancel: true,
            timeoutAfter: 5000,
          }
        : undefined,
  });
}

export async function showTripCancelledNotification(
  data: Pick<Booking, 'id' | 'origin_address' | 'destination_address' | 'cancellation_reason'>
) {
  const bookingId = data.id;
  if (!bookingId) {
    return;
  }

  const channelId = await ensureTripStatusChannel();
  const pickup = trimAddress(data.origin_address);
  const dropoff = trimAddress(data.destination_address);
  const reason = data.cancellation_reason?.trim() || 'Cancelled by customer';

  await notifee.displayNotification({
    id: `trip_cancelled_${bookingId}`,
    title: 'Trip Cancelled',
    body: `${reason}\nPickup: ${pickup}${dropoff ? `\nDrop: ${dropoff}` : ''}`,
    data: {
      id: bookingId,
      bookingId,
      type: 'trip_cancelled',
    },
    android:
      Platform.OS === 'android'
        ? {
            channelId,
            importance: AndroidImportance.HIGH,
            visibility: AndroidVisibility.PUBLIC,
            color: '#EF4444',
            pressAction: {
              id: 'default',
              launchActivity: 'default',
            },
            autoCancel: true,
            onlyAlertOnce: true,
            timeoutAfter: 10000,
          }
        : undefined,
  });
}

export async function showTripCompletedNotification(
  data: Pick<Booking, 'id' | 'origin_address' | 'destination_address'>
) {
  const bookingId = data.id;
  if (!bookingId) {
    return;
  }

  const channelId = await ensureTripStatusChannel();
  const pickup = trimAddress(data.origin_address);
  const dropoff = trimAddress(data.destination_address);

  await notifee.displayNotification({
    id: `trip_completed_${bookingId}`,
    title: 'Trip Completed',
    body: `Completed successfully\nPickup: ${pickup}${dropoff ? `\nDrop: ${dropoff}` : ''}`,
    data: {
      id: bookingId,
      bookingId,
      type: 'trip_completed',
    },
    android:
      Platform.OS === 'android'
        ? {
            channelId,
            importance: AndroidImportance.HIGH,
            visibility: AndroidVisibility.PUBLIC,
            color: '#10B981',
            pressAction: {
              id: 'default',
              launchActivity: 'default',
            },
            autoCancel: true,
            timeoutAfter: 10000,
          }
        : undefined,
  });
}

export async function showMarketingNotification(title: string, body: string, data: Record<string, string> = {}) {
  const channelId = await ensureMarketingChannel();

  await notifee.displayNotification({
    title,
    body,
    data,
    android:
      Platform.OS === 'android'
        ? {
            channelId,
            importance: AndroidImportance.DEFAULT,
            pressAction: {
              id: 'default',
              launchActivity: 'default',
            },
            autoCancel: true,
          }
        : undefined,
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
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ]
        );
      }
      return false;
    }

    if (Platform.OS === 'android') {
      try {
        const isRideChannelBlocked = await notifee.isChannelBlocked(RIDE_REQUESTS_FULLSCREEN_CHANNEL);
        if (isRideChannelBlocked) {
          console.warn('Ride request notification channel is blocked');

          if (openSettingsIfDenied) {
            Alert.alert(
              'Enable Ride Request Popups',
              'Ride request notifications are blocked for this app. Enable pop-up/full-screen notifications in settings so requests can appear over other apps.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Open Settings',
                  onPress: () => {
                    void notifee.openNotificationSettings(RIDE_REQUESTS_FULLSCREEN_CHANNEL);
                  },
                },
              ]
            );
          }
        }
      } catch (settingsError) {
        console.error('Failed to inspect ride request notification channel:', settingsError);
      }
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
    if (!hasPermission) {
      return null;
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

    if (!projectId) {
      console.error('Missing EAS projectId in Expo config');
      return null;
    }

    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const tokenData = await Notifications.getExpoPushTokenAsync({
          projectId,
        });

        console.log('Got push token:', tokenData.data);
        return tokenData.data;
      } catch (error) {
        lastError = error;
        console.warn(`Attempt ${attempt + 1}/3 to get push token failed, retrying...`, error);
        await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
      }
    }

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
    console.log('[Driver] registerPushToken Starting token registration for user:', userId);

    const token = await getExpoPushToken();
    if (!token) {
      console.warn('[Driver] No push token obtained - permission denied or module issue');
      return false;
    }

    console.log('[Driver] Got token:', token.substring(0, 30) + '...');

    const { error } = await supabase.from('users').update({ expo_push_token: token }).eq('id', userId);

    if (error) {
      console.error('[Driver] Supabase users table update error:', error);
    }

    try {
      let deviceId = 'unknown';

      try {
        const expoConstants = require('expo-constants').default;
        deviceId = expoConstants.installationId || expoConstants.sessionId || `device-${userId.substring(0, 8)}`;
      } catch {
        deviceId = `driver-device-${userId.substring(0, 8)}`;
      }

      const { error: pushTokenError } = await supabase.from('push_tokens').upsert(
        {
          user_id: userId,
          token,
          device_id: deviceId,
          platform: Platform.OS,
          is_active: true,
        },
        { onConflict: 'user_id,device_id' }
      );

      if (pushTokenError) {
        console.warn('[Driver] push_tokens upsert failed (non-critical):', pushTokenError);
      } else {
        console.log('[Driver] Token saved to push_tokens table');
      }
    } catch (upsertError) {
      console.warn('[Driver] Error upserting to push_tokens:', upsertError);
    }

    console.log('[Driver] Push token registration finished');
    return true;
  } catch (error) {
    console.error('[Driver] Error registering push token:', error);
    return false;
  }
}

/**
 * Add listener for incoming notifications
 */
export function addNotificationReceivedListener(callback: (notification: Notifications.Notification) => void) {
  return Notifications.addNotificationReceivedListener(callback);
}

/**
 * Add listener for notification taps
 */
export function addNotificationResponseListener(callback: (response: Notifications.NotificationResponse) => void) {
  return Notifications.addNotificationResponseReceivedListener(callback);
}
