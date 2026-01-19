"use strict";
// Driver App - Notification Setup
// Configures Android notification channels for high-priority ride requests
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
exports.RIDE_REQUESTS_CHANNEL = void 0;
exports.setupNotificationChannels = setupNotificationChannels;
exports.requestNotificationPermissions = requestNotificationPermissions;
exports.getExpoPushToken = getExpoPushToken;
exports.registerPushToken = registerPushToken;
exports.addNotificationReceivedListener = addNotificationReceivedListener;
exports.addNotificationResponseListener = addNotificationResponseListener;
const Notifications = __importStar(require("expo-notifications"));
const react_native_1 = require("react-native");
// Notification channel for ride requests (Android)
exports.RIDE_REQUESTS_CHANNEL = 'ride-requests';
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
async function setupNotificationChannels() {
    if (react_native_1.Platform.OS === 'android') {
        // High-priority channel for ride requests (will show as heads-up notification)
        await Notifications.setNotificationChannelAsync(exports.RIDE_REQUESTS_CHANNEL, {
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
 * Get the Expo Push Token for push notifications
 */
async function getExpoPushToken() {
    try {
        const hasPermission = await requestNotificationPermissions();
        if (!hasPermission)
            return null;
        // Get push token - must provide projectId for dev builds
        const tokenData = await Notifications.getExpoPushTokenAsync({
            projectId: 'c7204baf-bff3-41dd-930f-daf97fb3d0dc', // EAS projectId from app.json
        });
        console.log('📱 Got push token:', tokenData.data);
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
async function registerPushToken(supabase, userId) {
    try {
        const token = await getExpoPushToken();
        if (!token)
            return false;
        const { error } = await supabase
            .from('users')
            .update({ expo_push_token: token })
            .eq('id', userId);
        if (error) {
            console.error('Error saving push token:', error);
            return false;
        }
        console.log('✅ Push token registered successfully');
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
 * Add listener for notification taps
 */
function addNotificationResponseListener(callback) {
    return Notifications.addNotificationResponseReceivedListener(callback);
}
