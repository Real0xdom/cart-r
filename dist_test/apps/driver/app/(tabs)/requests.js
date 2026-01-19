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
const react_native_1 = require("react-native");
const react_native_safe_area_context_1 = require("react-native-safe-area-context");
const react_1 = require("react");
const expo_router_1 = require("expo-router");
const AuthContext_1 = require("@/contexts/AuthContext");
const bookings_1 = require("@/lib/bookings");
const Location = __importStar(require("expo-location"));
// Countdown timer hook for expiration
const useCountdown = (expiresAt) => {
    const [timeLeft, setTimeLeft] = (0, react_1.useState)('');
    const [isExpired, setIsExpired] = (0, react_1.useState)(false);
    (0, react_1.useEffect)(() => {
        if (!expiresAt) {
            setTimeLeft('');
            return;
        }
        const updateCountdown = () => {
            const now = new Date().getTime();
            const expiry = new Date(expiresAt).getTime();
            const diff = expiry - now;
            if (diff <= 0) {
                setTimeLeft('Expired');
                setIsExpired(true);
            }
            else {
                const mins = Math.floor(diff / 60000);
                const secs = Math.floor((diff % 60000) / 1000);
                setTimeLeft(`${mins}:${secs.toString().padStart(2, '0')}`);
                setIsExpired(false);
            }
        };
        updateCountdown();
        const interval = setInterval(updateCountdown, 1000);
        return () => clearInterval(interval);
    }, [expiresAt]);
    return { timeLeft, isExpired };
};
const RideRequestCard = ({ request, onAccept, onReject }) => {
    const { timeLeft, isExpired } = useCountdown(request.expires_at || null);
    // Don't render expired requests
    if (isExpired)
        return null;
    return (<react_native_1.View className="bg-gray-800 rounded-2xl p-4 mb-4">
            {/* Expiration Timer Badge */}
            {timeLeft && (<react_native_1.View className={`absolute top-3 right-3 px-2 py-1 rounded-full ${parseInt(timeLeft) < 1 ? 'bg-red-500' : 'bg-blue-500'}`}>
                    <react_native_1.Text className="text-white font-JakartaBold text-xs">⏱ {timeLeft}</react_native_1.Text>
                </react_native_1.View>)}
            
            {/* Increased Fare Badge */}
            {((request.tip_amount && request.tip_amount > 0) || (request.fare_multiplier && request.fare_multiplier > 1)) && (<react_native_1.View className="bg-orange-500 px-3 py-1 rounded-full self-start mb-2 flex-row items-center">
                    <react_native_1.Text className="text-white font-JakartaBold text-xs">🔥 Increased Fare</react_native_1.Text>
                    {request.tip_amount && request.tip_amount > 0 && (<react_native_1.Text className="text-white font-JakartaMedium text-xs ml-1">+₹{request.tip_amount} tip</react_native_1.Text>)}
                </react_native_1.View>)}
            
            <react_native_1.View className="flex-row justify-between items-start mb-4">
                <react_native_1.View className="flex-1 pr-16">
                    <react_native_1.Text className="text-gray-400 text-xs mb-1">PICKUP</react_native_1.Text>
                    <react_native_1.Text className="text-white font-JakartaSemiBold text-base" numberOfLines={2}>
                        {request.origin_address}
                    </react_native_1.Text>
                </react_native_1.View>
                <react_native_1.View className="bg-green-500/20 px-3 py-1 rounded-full ml-2 absolute right-0 top-6">
                    <react_native_1.Text className="text-green-400 font-JakartaBold">₹{request.driver_payout || request.total_fare}</react_native_1.Text>
                </react_native_1.View>
            </react_native_1.View>

            <react_native_1.View className="mb-4">
                <react_native_1.Text className="text-gray-400 text-xs mb-1">DROP-OFF</react_native_1.Text>
                <react_native_1.Text className="text-white font-JakartaSemiBold text-base" numberOfLines={2}>
                    {request.destination_address}
                </react_native_1.Text>
            </react_native_1.View>

            <react_native_1.View className="flex-row gap-4 mb-4">
                <react_native_1.View className="flex-1 bg-gray-700/50 p-3 rounded-xl">
                    <react_native_1.Text className="text-gray-400 text-xs">Distance</react_native_1.Text>
                    <react_native_1.Text className="text-white font-JakartaSemiBold">
                        {request.estimated_distance ? `${request.estimated_distance.toFixed(1)} km` : '-'}
                    </react_native_1.Text>
                </react_native_1.View>
                <react_native_1.View className="flex-1 bg-gray-700/50 p-3 rounded-xl">
                    <react_native_1.Text className="text-gray-400 text-xs">Est. Time</react_native_1.Text>
                    <react_native_1.Text className="text-white font-JakartaSemiBold">
                        {request.estimated_duration ? `${request.estimated_duration.toFixed(0)} min` : '-'}
                    </react_native_1.Text>
                </react_native_1.View>
                <react_native_1.View className="flex-1 bg-gray-700/50 p-3 rounded-xl">
                    <react_native_1.Text className="text-gray-400 text-xs">Payment</react_native_1.Text>
                    <react_native_1.Text className="text-white font-JakartaSemiBold capitalize">{request.payment_method}</react_native_1.Text>
                </react_native_1.View>
            </react_native_1.View>

            <react_native_1.View className="flex-row gap-3">
                <react_native_1.TouchableOpacity onPress={() => onReject(request.id)} className="flex-1 bg-red-500/20 p-4 rounded-xl">
                    <react_native_1.Text className="text-red-400 text-center font-JakartaBold">Decline</react_native_1.Text>
                </react_native_1.TouchableOpacity>
                <react_native_1.TouchableOpacity onPress={() => onAccept(request.id)} className="flex-1 bg-green-500 p-4 rounded-xl">
                    <react_native_1.Text className="text-white text-center font-JakartaBold">Accept</react_native_1.Text>
                </react_native_1.TouchableOpacity>
            </react_native_1.View>
        </react_native_1.View>);
};
const DriverRequests = () => {
    const { driverProfile, profile } = (0, AuthContext_1.useAuth)();
    const [requests, setRequests] = (0, react_1.useState)([]);
    const [refreshing, setRefreshing] = (0, react_1.useState)(false);
    const [loading, setLoading] = (0, react_1.useState)(true);
    const [location, setLocation] = (0, react_1.useState)(null);
    const fetchRequests = async () => {
        console.log('========================================');
        console.log('[DRIVER REQUESTS] Fetching available bookings...');
        console.log('[DRIVER REQUESTS] Location:', location);
        console.log('[DRIVER REQUESTS] Driver vehicle type:', driverProfile === null || driverProfile === void 0 ? void 0 : driverProfile.vehicle_type);
        console.log('========================================');
        if (!location || !(driverProfile === null || driverProfile === void 0 ? void 0 : driverProfile.vehicle_type)) {
            console.log('[DRIVER REQUESTS] Missing location or vehicle type, skipping fetch');
            return; // Wait for location and driver profile
        }
        const { data, error } = await (0, bookings_1.getAvailableBookings)(location.latitude, location.longitude, driverProfile.vehicle_type, // Only show bookings matching driver's vehicle
        20 // 20km radius
        );
        if (error) {
            console.error("[DRIVER REQUESTS] Error fetching requests:", error);
            // Don't show alert on auto-refresh to avoid annoyance
        }
        else {
            console.log('[DRIVER REQUESTS] Found bookings:', data.length);
            console.log('[DRIVER REQUESTS] Bookings:', JSON.stringify(data, null, 2));
            setRequests(data);
        }
        setLoading(false);
    };
    const onRefresh = (0, react_1.useCallback)(async () => {
        setRefreshing(true);
        await fetchRequests();
        setRefreshing(false);
    }, [location]);
    // Initial load and subscription
    (0, react_1.useEffect)(() => {
        (async () => {
            // Get current location first
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                react_native_1.Alert.alert('Permission to access location was denied');
                setLoading(false);
                return;
            }
            let location = await Location.getCurrentPositionAsync({});
            setLocation({
                latitude: location.coords.latitude,
                longitude: location.coords.longitude
            });
        })();
    }, []);
    // Fetch requests when location and driver profile are available
    (0, react_1.useEffect)(() => {
        if (location && (driverProfile === null || driverProfile === void 0 ? void 0 : driverProfile.vehicle_type)) {
            fetchRequests();
            // Subscribe to real-time updates - filtered by vehicle type
            const unsubscribe = (0, bookings_1.subscribeToAvailableBookings)(driverProfile.vehicle_type, (newBooking) => {
                setRequests(prev => [newBooking, ...prev]);
            }, (removedBookingId) => {
                setRequests(prev => prev.filter(b => b.id !== removedBookingId));
            });
            return () => {
                unsubscribe();
            };
        }
    }, [location, driverProfile === null || driverProfile === void 0 ? void 0 : driverProfile.vehicle_type]);
    const handleAccept = async (id) => {
        console.log('========================================');
        console.log('[HANDLE ACCEPT] Booking ID:', id);
        console.log('[HANDLE ACCEPT] Driver profile:', driverProfile === null || driverProfile === void 0 ? void 0 : driverProfile.id);
        console.log('========================================');
        if (!(driverProfile === null || driverProfile === void 0 ? void 0 : driverProfile.id)) {
            console.error('[HANDLE ACCEPT] No driver profile found');
            react_native_1.Alert.alert("Error", "Driver profile not found. Please log in again.");
            return;
        }
        console.log('[HANDLE ACCEPT] Calling acceptBooking...');
        const { success, error } = await (0, bookings_1.acceptBooking)(id, driverProfile.id);
        console.log('[HANDLE ACCEPT] Accept result:', { success, error });
        if (success) {
            console.log('[HANDLE ACCEPT] Booking accepted successfully');
            console.log('[HANDLE ACCEPT] Navigating to /ride/' + id);
            react_native_1.Alert.alert("Success", "Booking accepted! Navigate to pickup location.");
            // Navigate to active ride screen
            expo_router_1.router.push(`/ride/${id}`);
            console.log('[HANDLE ACCEPT] Navigation triggered');
        }
        else {
            console.error('[HANDLE ACCEPT] Failed to accept:', error);
            react_native_1.Alert.alert("Error", error || "Failed to accept booking. It might have been taken.");
            // Refresh list
            fetchRequests();
        }
    };
    const handleReject = async (id) => {
        react_native_1.Alert.alert("Decline Request", "Are you sure you want to decline this request? You won't see it again.", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Decline",
                style: "destructive",
                onPress: async () => {
                    // Optimistically remove from list
                    setRequests(prev => prev.filter(r => r.id !== id));
                    // Call API to persist decline
                    const { success, error } = await (0, bookings_1.declineBooking)(id);
                    if (!success) {
                        console.error('[HANDLE REJECT] Failed to decline:', error);
                        // Ideally we would show it again or show toast, but for now just log
                    }
                    else {
                        console.log('[HANDLE REJECT] Booking declined successfully');
                    }
                }
            }
        ]);
    };
    if (loading && !requests.length) {
        return (<react_native_safe_area_context_1.SafeAreaView className="flex-1 bg-gray-900 justify-center items-center">
                <react_native_1.ActivityIndicator size="large" color="#22c55e"/>
                <react_native_1.Text className="text-white mt-4">Finding nearby requests...</react_native_1.Text>
            </react_native_safe_area_context_1.SafeAreaView>);
    }
    return (<react_native_safe_area_context_1.SafeAreaView className="flex-1 bg-gray-900">
            <react_native_1.View className="p-5">
                <react_native_1.Text className="text-white text-2xl font-JakartaBold mb-2">Ride Requests</react_native_1.Text>
                <react_native_1.Text className="text-gray-400 mb-4">
                    {requests.length} {requests.length === 1 ? 'request' : 'requests'} available nearby
                </react_native_1.Text>
            </react_native_1.View>

            <react_native_1.ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingBottom: 100 }} refreshControl={<react_native_1.RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff"/>}>
                {requests.length > 0 ? (requests.map(request => (<RideRequestCard key={request.id} request={request} onAccept={handleAccept} onReject={handleReject}/>))) : (<react_native_1.View className="flex-1 items-center justify-center py-20">
                        <react_native_1.Text className="text-6xl mb-4">📭</react_native_1.Text>
                        <react_native_1.Text className="text-white text-xl font-JakartaBold mb-2">No Requests</react_native_1.Text>
                        <react_native_1.Text className="text-gray-400 text-center">
                            New ride requests will appear here.{'\n'}Make sure you're online!
                        </react_native_1.Text>
                    </react_native_1.View>)}
            </react_native_1.ScrollView>
        </react_native_safe_area_context_1.SafeAreaView>);
};
exports.default = DriverRequests;
