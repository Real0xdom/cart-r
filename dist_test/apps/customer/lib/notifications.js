"use strict";
// Customer App - Notification Setup
// Handles push notification registration and listeners
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
exports.setupNotificationChannels = setupNotificationChannels;
exports.requestNotificationPermissions = requestNotificationPermissions;
exports.getExpoPushToken = getExpoPushToken;
exports.registerPushToken = registerPushToken;
exports.addNotificationReceivedListener = addNotificationReceivedListener;
exports.addNotificationResponseListener = addNotificationResponseListener;
exports.parseNotificationData = parseNotificationData;
const Notifications = __importStar(require("expo-notifications"));
const react_native_1 = require("react-native");
const supabase_1 = require("./supabase");
// Configure notification handling behavior
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
 */
async function setupNotificationChannels() {
    if (react_native_1.Platform.OS === 'android') {
        // Default channel for booking updates
        await Notifications.setNotificationChannelAsync('booking-updates', {
            name: 'Booking Updates',
            importance: Notifications.AndroidImportance.HIGH,
            vibrationPattern: [0, 250, 250, 250],
            sound: 'default',
            enableVibrate: true,
            showBadge: true,
        });
        // Default channel for general notifications
        await Notifications.setNotificationChannelAsync('default', {
            name: 'General',
            importance: Notifications.AndroidImportance.DEFAULT,
            sound: 'default',
        });
        console.log('✅ Customer notification channels configured');
    }
}
/**
 * Request notification permissions
 */
async function requestNotificationPermissions() {
    try {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }
        if (finalStatus !== 'granted') {
            console.log('Notification permissions not granted');
            return false;
        }
        return true;
    }
    catch (error) {
        console.error('Error requesting notification permissions:', error);
        return false;
    }
}
/**
 * Get the Expo Push Token
 */
async function getExpoPushToken() {
    try {
        const hasPermission = await requestNotificationPermissions();
        if (!hasPermission)
            return null;
        const tokenData = await Notifications.getExpoPushTokenAsync({
            projectId: undefined, // Uses project ID from app.json
        });
        return tokenData.data;
    }
    catch (error) {
        console.error('Error getting push token:', error);
        return null;
    }
}
/**
 * Register push token with Supabase user record
 */
async function registerPushToken(userId) {
    try {
        const token = await getExpoPushToken();
        if (!token)
            return false;
        const { error } = await supabase_1.supabase
            .from('users')
            .update({ expo_push_token: token })
            .eq('id', userId);
        if (error) {
            console.error('Error saving push token:', error);
            return false;
        }
        console.log('✅ Customer push token registered');
        return true;
    }
    catch (error) {
        console.error('Error registering push token:', error);
        return false;
    }
}
/**
 * Add listener for incoming notifications
 */
function addNotificationReceivedListener(callback) {
    return Notifications.addNotificationReceivedListener(callback);
}
/**
 * Add listener for notification taps (when user taps on notification)
 */
function addNotificationResponseListener(callback) {
    return Notifications.addNotificationResponseReceivedListener(callback);
}
/**
 * Parse notification data to handle navigation
 */
function parseNotificationData(notification) {
    try {
        const data = notification.request.content.data;
        if (!data)
            return null;
        return {
            type: data.type,
            bookingId: data.booking_id,
            status: data.status,
        };
    }
    catch (_a) {
        return null;
    }
}
