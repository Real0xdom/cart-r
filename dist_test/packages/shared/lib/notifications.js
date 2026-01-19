"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerForPushNotifications = registerForPushNotifications;
exports.addNotificationReceivedListener = addNotificationReceivedListener;
exports.addNotificationResponseListener = addNotificationResponseListener;
exports.scheduleLocalNotification = scheduleLocalNotification;
exports.cancelNotification = cancelNotification;
exports.getPendingNotifications = getPendingNotifications;
exports.clearAllNotifications = clearAllNotifications;
exports.getBadgeCount = getBadgeCount;
exports.setBadgeCount = setBadgeCount;
exports.handleNotificationData = handleNotificationData;
// Push Notification Setup for Expo (Customer & Driver Apps)
const Notifications = __importStar(require("expo-notifications"));
const Device = __importStar(require("expo-device"));
const react_native_1 = require("react-native");
const supabase_1 = require("./supabase");
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
async function registerForPushNotifications() {
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
        if (react_native_1.Platform.OS === 'android') {
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
    }
    catch (error) {
        console.error('Error registering for push notifications:', error);
        return null;
    }
}
/**
 * Save push token to user's profile
 */
async function savePushToken(token) {
    try {
        const { data: { user } } = await supabase_1.supabase.auth.getUser();
        if (!user)
            return;
        await supabase_1.supabase
            .from('users')
            .update({ expo_push_token: token })
            .eq('id', user.id);
        console.log('Push token saved to profile');
    }
    catch (error) {
        console.error('Error saving push token:', error);
    }
}
/**
 * Add notification received listener
 */
function addNotificationReceivedListener(callback) {
    return Notifications.addNotificationReceivedListener(callback);
}
/**
 * Add notification response listener (when user taps notification)
 */
function addNotificationResponseListener(callback) {
    return Notifications.addNotificationResponseReceivedListener(callback);
}
/**
 * Schedule a local notification
 */
async function scheduleLocalNotification(title, body, data, seconds = 1) {
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
async function cancelNotification(identifier) {
    await Notifications.cancelScheduledNotificationAsync(identifier);
}
/**
 * Get all pending notifications
 */
async function getPendingNotifications() {
    return await Notifications.getAllScheduledNotificationsAsync();
}
/**
 * Clear all delivered notifications
 */
async function clearAllNotifications() {
    await Notifications.dismissAllNotificationsAsync();
}
/**
 * Get badge count
 */
async function getBadgeCount() {
    return await Notifications.getBadgeCountAsync();
}
/**
 * Set badge count
 */
async function setBadgeCount(count) {
    await Notifications.setBadgeCountAsync(count);
}
/**
 * Handle notification data and navigate accordingly
 */
function handleNotificationData(data, navigate) {
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
