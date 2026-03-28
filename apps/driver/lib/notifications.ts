// Driver App - Notification Setup
// Configures Android notification channels and ride request heads-up flows.

import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Alert, Linking, Platform } from 'react-native';
import * as TaskManager from 'expo-task-manager';
import notifee, {
  AndroidCategory,
  AndroidFlags,
  AndroidImportance,
  AndroidStyle,
  AndroidVisibility,
  AuthorizationStatus,
  EventType,
  TriggerType,
  type Notification,
  type TimestampTrigger,
} from '@notifee/react-native';
import * as SecureStore from 'expo-secure-store';
import { declineBooking, getBookingById, type Booking } from './bookings';
import { getRideAlertSoundName } from './rideAlertSound';

const BACKGROUND_NOTIFICATION_TASK = 'BACKGROUND-NOTIFICATION-TASK';
const RIDE_REQUESTS_FULLSCREEN_CHANNEL = 'driver_ride_request_urgent';
const TRIP_STATUS_CHANNEL = 'driver_trip_status';
const DRIVER_MARKETING_CHANNEL = 'driver_marketing';
const RIDE_REQUEST_SOUND_NAME = getRideAlertSoundName();
const ANDROID_NOTIFICATION_SMALL_ICON = 'notification_icon';

export const RIDE_REQUESTS_CHANNEL = RIDE_REQUESTS_FULLSCREEN_CHANNEL;
export const RIDE_REQUEST_COUNTDOWN_SECONDS = 180;
export const RIDE_REQUEST_TIMEOUT_MS = 180_000;
export const RIDE_REQUEST_CLIENT_CANCEL_MS = 178_000;

const rideRequestUpdateTimers = new Map<string, ReturnType<typeof setInterval>>();
const rideRequestClientCancelTimers = new Map<string, ReturnType<typeof setTimeout>>();
const rideRequestServerTimeoutTimers = new Map<string, ReturnType<typeof setTimeout>>();
const latestRideRequestData = new Map<string, RideRequestNotificationInput>();

// ── Ride Stacking State ──────────────────────────────────────────────────────
// Tracks currently accepted/active rides to determine notification priority.
// Porter rule: up to 2 stacked rides get sticky fullscreen notifications;
// a 3rd incoming request while 2 rides are active gets a normal notification.
const activeRideIds = new Set<string>();
const MAX_STICKY_RIDES = 2;

export function addActiveRide(bookingId: string) {
  activeRideIds.add(bookingId);
  console.log('[RideStack] Active rides:', activeRideIds.size, [...activeRideIds]);
}

export function removeActiveRide(bookingId: string) {
  activeRideIds.delete(bookingId);
  console.log('[RideStack] Active rides:', activeRideIds.size, [...activeRideIds]);
}

export function getActiveRideCount(): number {
  return activeRideIds.size;
}

// Returns true if incoming ride should show as sticky fullscreen;
// false if it should be a normal (non-mandatory) notification.
export function shouldShowStickyRideRequest(): boolean {
  return activeRideIds.size < MAX_STICKY_RIDES;
}


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
    | 'booking_addons'
    | 'addon_charges'
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

async function dismissExpoNotificationByRequestId(requestId: unknown) {
  if (typeof requestId !== 'string' || requestId.trim().length === 0) {
    return;
  }

  try {
    await Notifications.dismissNotificationAsync(requestId);
    console.log('[RideRequest] Dismissed raw Expo notification:', requestId);
  } catch (error) {
    console.warn('[RideRequest] Failed to dismiss raw Expo notification:', requestId, error);
  }
}

export async function dismissRawRideRequestNotification(
  notificationLike:
    | Notifications.Notification
    | {
        request?: {
          identifier?: string;
        };
      }
    | null
    | undefined
) {
  const requestId = notificationLike?.request?.identifier;
  await dismissExpoNotificationByRequestId(requestId);
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
    // UPDATED: No countdown, available immediately
    availableAt: now,
    localCancelAt,
    rpcTimeoutAt,
  };
}

export function getRideRequestCountdownRemainingSeconds(data: RideRequestNotificationInput): number {
  const { availableAt } = resolveRideRequestTiming(data);
  return Math.max(0, Math.ceil((availableAt - Date.now()) / 1000));
}

export function isRideRequestResponseUnlocked(data: RideRequestNotificationInput): boolean {
  return true; // No longer gated
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
  const isUnlocked = true;
  const countdownText = 'New ride available for acceptance.';

  // Build addon summary line (if any addons exist)
  const addons = Array.isArray(data.booking_addons) ? data.booking_addons : [];
  const addonTotalCharge = toNumber(data.addon_charges);
  let addonLine = '';
  if (addons.length > 0) {
    const addonNames = addons
      .map((a: any) => {
        const name = a?.addon_services?.name || 'Add-on';
        const qty = a?.quantity && a.quantity > 1 ? ` x${a.quantity}` : '';
        const price = toNumber(a?.total_price ?? (a?.unit_price * a?.quantity));
        return `${name}${qty}${price !== null ? ` (₹${Math.round(price)})` : ''}`;
      })
      .join(', ');
    const totalStr = addonTotalCharge !== null ? ` — ₹${Math.round(addonTotalCharge)} extra` : '';
    addonLine = `\n🟡 ADDONS: ${addonNames}${totalStr}`;
  }

  const summaryBody = `${fare} Ride • ${distance} • ${pickup} → ${dropoff}`;
  const detailsBody = [
    `Pickup: ${pickup}`,
    `Drop: ${dropoff}`,
    `${fare}${tipAmount && tipAmount > 0 ? ` (+₹${Math.round(tipAmount)} tip)` : ''} • ${distance} • ${duration}`,
    `${paymentMethod} • ${countdownText}`,
  ].join('\n') + addonLine;

  return {
    id: getRideRequestNotificationId(bookingId),
    title: '🚨 NEW RIDE REQUEST', // Added icon to title for visibility
    subtitle: `${fare} • ${distance}`,
    body: summaryBody,
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
            smallIcon: ANDROID_NOTIFICATION_SMALL_ICON,
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
            lightUpScreen: true,
            flags: [AndroidFlags.FLAG_NO_CLEAR],
            showTimestamp: false,
            showChronometer: false,
            // chronometerDirection: 'down',
            timestamp: options.availableAt,
            // NOTE: No timeoutAfter — the ride request stays until the driver
            // taps Accept/Reject or the client-cancel timer dismisses it.
            style: {
              type: AndroidStyle.BIGTEXT,
              text: detailsBody,
            },
            // Always show Accept/Reject — driver can accept early if they want
            actions: [
                  {
                    title: '✅ Accept Ride',
                    pressAction: { id: 'accept_ride', launchActivity: 'default' },
                  },
                  {
                    title: '❌ Reject',
                    pressAction: { id: 'decline_ride' },
                  },
                ],
          }
        : undefined,
  };
}

async function ensureRideRequestChannel(): Promise<string> {
  if (Platform.OS !== 'android') {
    return RIDE_REQUESTS_CHANNEL;
  }

  // Always delete and recreate to ensure channel settings (bypassDnd, lockscreen visibility)
  // are applied — Android caches channel settings and ignores updates to existing channels.
  try {
    await notifee.deleteChannel(RIDE_REQUESTS_FULLSCREEN_CHANNEL);
  } catch (_) { /* ignore if not exists */ }

  return notifee.createChannel({
    id: RIDE_REQUESTS_FULLSCREEN_CHANNEL,
    name: 'Ride Requests (Urgent)',
    importance: AndroidImportance.HIGH,
    sound: RIDE_REQUEST_SOUND_NAME,
    vibration: true,
    vibrationPattern: [300, 500, 300, 500],
    bypassDnd: true,
    visibility: AndroidVisibility.PUBLIC,
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

// Countdown-based notification functions removed as ride requests are now immediate.

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

  if (!payload) return;

  try {
    const parsedPayload = typeof payload === 'string' ? JSON.parse(payload) : payload;
    const bookingId = getRideRequestBookingId(parsedPayload);
    
    if (!bookingId) return;

    if (parsedPayload.type === 'new_booking' || parsedPayload.type === 'cancel_booking' || parsedPayload.is_data_only) {
      await dismissRawRideRequestNotification(notification);
    }

    // Handle cancellation
    if (parsedPayload.type === 'cancel_booking') {
      console.log('[Background] Cancelling notification for booking:', bookingId);
      await cancelRideRequestNotification(bookingId);
      return;
    }

    // Handle new booking
    if (parsedPayload.type === 'new_booking' || parsedPayload.is_data_only) {
      const isOnline = await isCurrentDriverOnline();
      if (!isOnline) {
        console.log('Skipping background ride request because driver is offline');
        return;
      }

      // Fetch full booking details (best-effort)
      let displayData = parsedPayload;
      try {
        const { data: fullBooking } = await getBookingById(bookingId);
        if (fullBooking) {
          displayData = { ...parsedPayload, ...fullBooking };
        }
      } catch (e) {
        console.warn('[Background] Could not fetch full booking, using payload fallback');
      }
      
      await displayRideRequestWithStackLogic(displayData);
    }
  } catch (taskError) {
    console.error('Failed to handle background notification:', taskError);
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

  // Accept/Reject actions are always available now (no countdown gate)

  if (pressAction.id === 'decline_ride') {
    console.log('[BACKGROUND] Decline pressed - updating backend and dismissing...');
    try {
      await declineBooking(bookingId);
    } catch (declineError) {
      console.error('[BACKGROUND] Failed to persist decline to backend:', declineError);
    }
    await cancelRideRequestNotification(bookingId);
    return;
  }

  if (pressAction.id === 'dismiss_notification') {
    console.log('[BACKGROUND] Dismiss pressed - cancelling notification locally');
    await notifee.cancelNotification(notification.id!);
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
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    };
  },
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
        sound: RIDE_REQUEST_SOUND_NAME,
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

  // ── Proactive permission check ──
  // If the channel is blocked or full-screen intent isn't granted, warn the driver now —
  // this is the most impactful moment since a real ride request just arrived.
  if (Platform.OS === 'android') {
    try {
      const [isBlocked, settings] = await Promise.all([
        notifee.isChannelBlocked(channelId),
        notifee.getNotificationSettings(),
      ]);
      const fullScreenStatus = (settings as any)?.android?.fullScreenIntentPermission;
      // fullScreenIntentPermission: 1=AUTHORIZED, 0=DENIED, -1=NOT_SUPPORTED
      const fullScreenDenied = fullScreenStatus === 0;

      if (isBlocked) {
        Alert.alert(
          '⚠️ Ride Requests Blocked',
          'Your notification channel is blocked. Tap "Fix Now" to enable ride request pop-ups so you don\'t miss rides.',
          [
            { text: 'Later', style: 'cancel' },
            { text: 'Fix Now', onPress: () => void notifee.openNotificationSettings(channelId) },
          ]
        );
      } else if (fullScreenDenied) {
        Alert.alert(
          '⚠️ Full-Screen Rides Disabled',
          'Allow "Display over other apps" so ride requests pop up as full-screen alerts.',
          [
            { text: 'Later', style: 'cancel' },
            { text: 'Allow', onPress: () => void notifee.openNotificationSettings() },
          ]
        );
      }
    } catch (_) { /* non-critical — proceed with notification anyway */ }
  }

  const { availableAt, localCancelAt, rpcTimeoutAt } = resolveRideRequestTiming(data);
  const remainingSeconds = Math.max(0, Math.ceil((availableAt - Date.now()) / 1000));

  // Store data globally so the 1s interval progress updates use the latest even if it updates mid-countdown
  latestRideRequestData.set(bookingId, data);

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
        remainingSeconds: 0,
        availableAt,
        localCancelAt,
        rpcTimeoutAt,
        fullScreen: Platform.OS === 'android',
      }
    )
  );

  scheduleRideRequestTimeouts(data, localCancelAt, rpcTimeoutAt);
  // REMOVED countdown-based intervals as they are no longer needed
}

/**
 * Display a NORMAL (non-sticky, swipeable) ride request notification.
 * Used when 2 rides are already active (stacked) — the driver can still see
 * the request but it won't lock their screen or override other apps.
 */
export async function displayNormalRideRequest(data: RideRequestNotificationInput) {
  const bookingId = getRideRequestBookingId(data);
  if (!bookingId) {
    return;
  }

  // Store data globally so other notification logic can pull the freshest addon/tip data
  latestRideRequestData.set(bookingId, data);

  const channelId = await ensureTripStatusChannel();
  const pickup = trimAddress(data.origin_address);
  const dropoff = trimAddress(data.destination_address);
  const fare = formatCurrency(data.total_fare);
  const distance = formatDistance(data.estimated_distance);
  const { rpcTimeoutAt, localCancelAt } = resolveRideRequestTiming(data);
  const tipAmount = toNumber(data.tip_amount);
  
  // Build addon summary line (if any addons exist)
  const addons = Array.isArray(data.booking_addons) ? data.booking_addons : [];
  let addonLine = '';
  if (addons.length > 0) {
    const addonNames = addons
      .map((a: any) => {
        const name = a?.addon_services?.name || 'Add-on';
        const qty = a?.quantity && a.quantity > 1 ? ` x${a.quantity}` : '';
        return `${name}${qty}`;
      })
      .join(', ');
    addonLine = `\n🟡 ADDONS: ${addonNames}`;
  }

  const baseBody = `${fare} • ${distance}\nPickup: ${pickup}\nDrop: ${dropoff}${tipAmount && tipAmount > 0 ? ` (+₹${Math.round(tipAmount)} tip)` : ''}`;
  const warningText = '\n⚠️ You already have 2 active rides.';

  await notifee.displayNotification({
    id: getRideRequestNotificationId(bookingId),
    title: '🚗 New Ride Request (Queue Full)',
    body: baseBody + addonLine + warningText,
    data: {
      id: bookingId,
      bookingId,
      type: String(data.type || 'new_booking'),
      expires_at_ms: String(rpcTimeoutAt),
      origin_address: pickup,
      destination_address: dropoff,
    },
    android: Platform.OS === 'android'
      ? {
          channelId,
          smallIcon: ANDROID_NOTIFICATION_SMALL_ICON,
          importance: AndroidImportance.HIGH,
          visibility: AndroidVisibility.PUBLIC,
          color: '#F59E0B',
          pressAction: { id: 'default', launchActivity: 'default' },
          // NOT ongoing — driver can dismiss this one
          ongoing: false,
          autoCancel: true,
          onlyAlertOnce: true,
          timeoutAfter: Math.max(0, localCancelAt - Date.now()),
          style: {
            type: AndroidStyle.BIGTEXT,
            text: baseBody + addonLine + '\n\n⚠️ Accept from the app — you have 2 active rides.',
          },
          actions: [
            {
              title: 'Open App',
              pressAction: { id: 'default', launchActivity: 'default' },
            },
            {
              title: 'Dismiss',
              pressAction: { id: 'dismiss_notification' },
            },
          ],
        }
      : undefined,
  });

  // Still schedule server timeout so it gets cleaned up
  scheduleRideRequestTimeouts(data, localCancelAt, rpcTimeoutAt);
}

/**
 * Smart ride request display — routes to sticky fullscreen or normal notification
 * based on current active ride count (Porter-style stacking logic).
 *
 * - 0 active rides → sticky fullscreen with Accept/Reject (can't dismiss)
 * - 1 active ride  → sticky fullscreen with Accept/Reject (can't dismiss)
 * - 2 active rides → normal dismissible notification (queue full warning)
 */
export async function displayRideRequestWithStackLogic(data: RideRequestNotificationInput) {
  const isSticky = shouldShowStickyRideRequest();
  const activeCount = getActiveRideCount();
  console.log(`[RideStack] Incoming ride request. Active rides: ${activeCount}. Sticky: ${isSticky}`);

  if (isSticky) {
    await displayFullScreenRideRequest(data);
  } else {
    await displayNormalRideRequest(data);
  }
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
  latestRideRequestData.delete(bookingId);
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
            smallIcon: ANDROID_NOTIFICATION_SMALL_ICON,
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
            smallIcon: ANDROID_NOTIFICATION_SMALL_ICON,
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
            smallIcon: ANDROID_NOTIFICATION_SMALL_ICON,
            importance: AndroidImportance.HIGH,
            visibility: AndroidVisibility.PUBLIC,
            color: '#10B981',
            pressAction: {
              id: 'default',
              launchActivity: 'default',
            },
            autoCancel: true,
            timeoutAfter: 5000,
            actions: [
              {
                title: 'Dismiss',
                pressAction: { id: 'dismiss_notification' },
              },
            ],
          }
        : undefined,
  });
}

/**
 * Show a notification when the driver arrives at the pickup location.
 */
export async function showDriverArrivedNotification(bookingId: string) {
  const channelId = await ensureTripStatusChannel();
  await notifee.displayNotification({
    id: `driver_arrived_${bookingId}`,
    title: 'Arrived at Pickup',
    body: 'Notification sent to customer. Wait for them to load the goods.',
    data: { id: bookingId, type: 'driver_arrived' },
    android: {
      channelId,
      smallIcon: ANDROID_NOTIFICATION_SMALL_ICON,
      importance: AndroidImportance.HIGH,
      visibility: AndroidVisibility.PUBLIC,
      color: '#EAB308',
      pressAction: { id: 'default', launchActivity: 'default' },
      autoCancel: true,
      actions: [{ title: 'Dismiss', pressAction: { id: 'dismiss_notification' } }],
    },
  });
}

/**
 * Show a notification when an online payment is confirmed.
 */
export async function showPaymentSuccessNotification(bookingId: string, payout: number, grossFare?: number) {
  const channelId = await ensureTripStatusChannel();
  const body = grossFare && grossFare > payout
    ? `Your earnings: \u20b9${Math.round(payout)} (after commission from \u20b9${Math.round(grossFare)})`
    : `Your earnings: \u20b9${Math.round(payout)} credited to wallet.`;
  await notifee.displayNotification({
    id: `payment_success_${bookingId}`,
    title: 'Payment Confirmed! 💰',
    body,
    data: { id: bookingId, type: 'payment_success' },
    android: {
      channelId,
      smallIcon: ANDROID_NOTIFICATION_SMALL_ICON,
      importance: AndroidImportance.HIGH,
      visibility: AndroidVisibility.PUBLIC,
      color: '#10B981',
      pressAction: { id: 'default', launchActivity: 'default' },
      autoCancel: true,
      actions: [{ title: 'Dismiss', pressAction: { id: 'dismiss_notification' } }],
    },
  });
}

// =====================================================
// NotificationManager Wrapper
// =====================================================

export const NotificationManager = {
  // Setup
  setup: setupNotificationChannels,

  // Types \u2014 use displayRideRequestWithStackLogic as the default rideRequest handler
  rideRequest: displayRideRequestWithStackLogic,
  rideRequestSticky: displayFullScreenRideRequest,
  rideRequestNormal: displayNormalRideRequest,
  tripAccepted: showTripAcceptedNotification,
  tripCancelled: showTripCancelledNotification,
  tripCompleted: showTripCompletedNotification,
  driverArrived: showDriverArrivedNotification,
  paymentSuccess: showPaymentSuccessNotification,

  // Utils
  cancel: notifee.cancelNotification.bind(notifee),
  cancelRideRequest: cancelRideRequestNotification,

  // Ride stacking state management \u2014 call these when a ride is accepted/completed
  addActiveRide,
  removeActiveRide,
  getActiveRideCount,
  shouldShowStickyRideRequest,
  
  // Custom wrappers for specific Porter requirements
  sticky: async (id: string, title: string, body: string) => {
    const channelId = await ensureTripStatusChannel();
    return notifee.displayNotification({
      id,
      title,
      body,
      android: {
        channelId,
        smallIcon: ANDROID_NOTIFICATION_SMALL_ICON,
        ongoing: true,
        autoCancel: false,
        importance: AndroidImportance.LOW,
      },
    });
  },
  
  headsUp: async (id: string, title: string, body: string, data?: any) => {
    const channelId = await ensureRideRequestChannel();
    return notifee.displayNotification({
      id,
      title,
      body,
      data,
      android: {
        channelId,
        smallIcon: ANDROID_NOTIFICATION_SMALL_ICON,
        importance: AndroidImportance.HIGH,
        fullScreenAction: { id: 'default', launchActivity: 'default' },
      },
    });
  },

  dismissible: async (id: string, title: string, body: string, color = '#10B981') => {
    const channelId = await ensureTripStatusChannel();
    return notifee.displayNotification({
      id,
      title,
      body,
      android: {
        channelId,
        smallIcon: ANDROID_NOTIFICATION_SMALL_ICON,
        autoCancel: true,
        color,
        actions: [{ title: 'Dismiss', pressAction: { id: 'dismiss_notification' } }],
      },
    });
  }
};

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
            smallIcon: ANDROID_NOTIFICATION_SMALL_ICON,
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
 * Uses Notifee's native API (doesn't require Firebase) as the primary mechanism.
 * @param openSettingsIfDenied If true, prompt user to open settings if permission is denied
 */
export async function requestNotificationPermissions(openSettingsIfDenied = false): Promise<boolean> {
  try {
    if (Platform.OS !== 'android') {
      // iOS: use expo-notifications
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        if (status !== 'granted') {
          console.log('Notification permissions not granted (iOS)');
          return false;
        }
      }
      return true;
    }

    // ── Android: Use Notifee for all permission flows (no Firebase dependency) ──

    // Step 1: POST_NOTIFICATIONS permission (Android 13+ / API 33+)
    // notifee.requestPermission() triggers the system permission dialog
    const permissionSettings = await notifee.requestPermission();
    const authStatus = permissionSettings.authorizationStatus;

    // 0 = DENIED, 1 = AUTHORIZED, 2 = PROVISIONAL
    console.log('[Permissions] Notifee authorization status:', authStatus);

    if (authStatus === AuthorizationStatus.DENIED) {
      console.warn('[Permissions] Notifications denied by user');
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

    // Also try expo-notifications as a best-effort (non-blocking)
    try {
      const { status: expoStatus } = await Notifications.getPermissionsAsync();
      if (expoStatus !== 'granted') {
        await Notifications.requestPermissionsAsync();
      }
    } catch (_expoError) {
      // Firebase not initialized — expected, Notifee handles it
      console.log('[Permissions] expo-notifications permission request skipped (Firebase not ready)');
    }

    // Step 2: Check Notifee channel blocked
    try {
      const isRideChannelBlocked = await notifee.isChannelBlocked(RIDE_REQUESTS_FULLSCREEN_CHANNEL);
      if (isRideChannelBlocked) {
        console.warn('Ride request notification channel is blocked');
        if (openSettingsIfDenied) {
          Alert.alert(
            'Enable Ride Request Popups',
            'Ride request notifications are blocked. Enable pop-up/full-screen notifications in settings so requests can appear over other apps.',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Open Settings',
                onPress: () => void notifee.openNotificationSettings(RIDE_REQUESTS_FULLSCREEN_CHANNEL),
              },
            ]
          );
        }
      }
    } catch (settingsError) {
      console.error('Failed to inspect ride request notification channel:', settingsError);
    }

    // Step 3: USE_FULL_SCREEN_INTENT (Android 14+ / API 34+)
    try {
      const notifSettings = await notifee.getNotificationSettings();
      const fullScreenGranted = (notifSettings as any)?.android?.fullScreenIntentPermission;
      // 1 = AUTHORIZED, 0 = DENIED, -1 = NOT_SUPPORTED
      if (fullScreenGranted === 0) {
        console.warn('[Permissions] USE_FULL_SCREEN_INTENT not granted');
        if (openSettingsIfDenied) {
          Alert.alert(
            'Allow Full-Screen Notifications',
            'To see ride requests as full-screen pop-ups (even when the screen is locked), grant \"Display over other apps\" access to Cartr Driver.',
            [
              { text: 'Later', style: 'cancel' },
              {
                text: 'Grant Permission',
                onPress: () => void notifee.openNotificationSettings(),
              },
            ]
          );
        }
      }
    } catch (fsiError) {
      console.warn('[Permissions] Could not check full-screen intent permission:', fsiError);
    }

    // Step 4: SYSTEM_ALERT_WINDOW — "Display over other apps"
    try {
      const canDrawOverApps = await notifee.getNotificationSettings();
      const alertWindowGranted = (canDrawOverApps as any)?.android?.alarm;
      if (alertWindowGranted === 0 && openSettingsIfDenied) {
        Alert.alert(
          'Allow "Display Over Other Apps"',
          'For ride request pop-ups to appear while using another app, grant "Display over other apps" permission.',
          [
            { text: 'Later', style: 'cancel' },
            {
              text: 'Grant Permission',
              onPress: () => void notifee.openAlarmPermissionSettings(),
            },
          ]
        );
      }
    } catch (drawOverError) {
      console.warn('[Permissions] Could not check SYSTEM_ALERT_WINDOW:', drawOverError);
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
        const errorMessage = String(error);

        // Firebase not initialized = APK needs rebuild with google-services.json.
        // Retrying won't help — fail immediately without spamming logs.
        if (errorMessage.includes('FirebaseApp is not initialized') || errorMessage.includes('Default FirebaseApp')) {
          console.warn(
            '[PushToken] Firebase not initialized. This requires a new APK build with google-services.json.\n' +
            'Ride requests still work via Supabase Realtime — push tokens are optional.\n' +
            'Rebuild the APK after fixing the Firebase config to resolve this.'
          );
          return null;
        }

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
