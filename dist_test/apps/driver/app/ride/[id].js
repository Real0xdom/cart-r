"use strict";
// Active Ride Screen
// Driver's view during an active shipment - connected to Supabase
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
const expo_router_1 = require("expo-router");
const react_1 = require("react");
const vector_icons_1 = require("@expo/vector-icons");
const react_native_maps_1 = __importStar(require("react-native-maps"));
const Location = __importStar(require("expo-location"));
const bookings_1 = require("@/lib/bookings");
const ActiveRide = () => {
    var _a, _b, _c;
    const { id } = (0, expo_router_1.useLocalSearchParams)();
    const [booking, setBooking] = (0, react_1.useState)(null);
    const [isLoading, setIsLoading] = (0, react_1.useState)(true);
    const [isUpdating, setIsUpdating] = (0, react_1.useState)(false);
    const [driverLocation, setDriverLocation] = (0, react_1.useState)(null);
    const mapRef = (0, react_1.useRef)(null);
    // Get driver's current location
    (0, react_1.useEffect)(() => {
        let subscription = null;
        (async () => {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status === 'granted') {
                // Get initial location
                const location = await Location.getCurrentPositionAsync({});
                setDriverLocation({
                    latitude: location.coords.latitude,
                    longitude: location.coords.longitude
                });
                // Watch location updates
                subscription = await Location.watchPositionAsync({ accuracy: Location.Accuracy.High, distanceInterval: 10 }, (location) => {
                    setDriverLocation({
                        latitude: location.coords.latitude,
                        longitude: location.coords.longitude
                    });
                });
            }
        })();
        return () => {
            subscription === null || subscription === void 0 ? void 0 : subscription.remove();
        };
    }, []);
    // Fetch booking data
    (0, react_1.useEffect)(() => {
        if (!id) {
            console.log('[ACTIVE RIDE] No booking ID provided');
            expo_router_1.router.back();
            return;
        }
        console.log('[ACTIVE RIDE] Fetching booking details for ID:', id);
        const fetchBooking = async () => {
            const { data, error } = await (0, bookings_1.getBookingById)(id);
            console.log('[ACTIVE RIDE] getBookingById result:', {
                hasData: !!data,
                error: error,
                bookingId: id
            });
            if (data) {
                console.log('[ACTIVE RIDE] Booking loaded successfully:', JSON.stringify(data, null, 2));
                setBooking(data);
            }
            else {
                console.error('[ACTIVE RIDE] Failed to load booking:', error);
                react_native_1.Alert.alert('Error', `Failed to load ride details: ${error || 'Unknown error'}`);
                expo_router_1.router.back();
            }
            setIsLoading(false);
        };
        fetchBooking();
        // Subscribe to real-time updates
        console.log('[ACTIVE RIDE] Subscribing to booking updates');
        const unsubscribe = (0, bookings_1.subscribeToBooking)(id, (updatedBooking) => {
            console.log('[ACTIVE RIDE] Received booking update:', updatedBooking.status);
            setBooking(updatedBooking);
        });
        return () => unsubscribe();
    }, [id]);
    // Fit map to show route when booking and driver location are available
    (0, react_1.useEffect)(() => {
        if (booking && driverLocation && mapRef.current) {
            const isInProgress = booking.status === 'in_progress';
            const targetLat = isInProgress ? booking.destination_latitude : booking.origin_latitude;
            const targetLng = isInProgress ? booking.destination_longitude : booking.origin_longitude;
            mapRef.current.fitToCoordinates([
                { latitude: driverLocation.latitude, longitude: driverLocation.longitude },
                { latitude: targetLat, longitude: targetLng }
            ], {
                edgePadding: { top: 80, right: 50, bottom: 250, left: 50 },
                animated: true
            });
        }
    }, [booking, driverLocation]);
    const openNavigation = () => {
        if (!booking)
            return;
        const isPickedUp = booking.status === 'in_progress';
        const lat = isPickedUp ? booking.destination_latitude : booking.origin_latitude;
        const lng = isPickedUp ? booking.destination_longitude : booking.origin_longitude;
        const url = react_native_1.Platform.select({
            ios: `maps://app?daddr=${lat},${lng}`,
            android: `google.navigation:q=${lat},${lng}`,
        });
        if (url)
            react_native_1.Linking.openURL(url);
    };
    const callCustomer = () => {
        var _a;
        const phone = ((_a = booking === null || booking === void 0 ? void 0 : booking.customer) === null || _a === void 0 ? void 0 : _a.phone) || (booking === null || booking === void 0 ? void 0 : booking.receiver_phone);
        if (phone) {
            react_native_1.Linking.openURL(`tel:${phone}`);
        }
    };
    const handleStatusUpdate = async () => {
        if (!booking || !id)
            return;
        const currentStatus = booking.status;
        // If arrived and about to start trip, navigate to OTP verification
        if (currentStatus === 'driver_arrived') {
            expo_router_1.router.push({
                pathname: '/ride/verify-otp',
                params: { bookingId: id },
            });
            return;
        }
        setIsUpdating(true);
        try {
            let newStatus;
            if (currentStatus === 'accepted') {
                newStatus = 'driver_arrived';
            }
            else if (currentStatus === 'in_progress') {
                // Navigate to payment collection
                expo_router_1.router.push({
                    pathname: '/ride/collect-payment',
                    params: { bookingId: id },
                });
                setIsUpdating(false);
                return;
            }
            else {
                setIsUpdating(false);
                return;
            }
            const { success, error } = await (0, bookings_1.updateBookingStatus)(id, newStatus);
            if (!success) {
                react_native_1.Alert.alert('Error', error || 'Failed to update status');
            }
        }
        catch (err) {
            react_native_1.Alert.alert('Error', err.message || 'Something went wrong');
        }
        setIsUpdating(false);
    };
    const getButtonText = () => {
        switch (booking === null || booking === void 0 ? void 0 : booking.status) {
            case 'accepted': return 'Arrived at Pickup';
            case 'driver_arrived': return 'Verify OTP & Start';
            case 'in_progress': return 'Complete & Collect Payment';
            default: return 'Continue';
        }
    };
    const getStatusBadge = () => {
        switch (booking === null || booking === void 0 ? void 0 : booking.status) {
            case 'accepted':
                return { text: '🚗 Head to pickup location', color: 'bg-blue-500/20', textColor: 'text-blue-400' };
            case 'driver_arrived':
                return { text: '📍 Arrived - Verify OTP', color: 'bg-yellow-500/20', textColor: 'text-yellow-400' };
            case 'in_progress':
                return { text: '🚚 Trip in progress', color: 'bg-green-500/20', textColor: 'text-green-400' };
            default:
                return { text: 'Loading...', color: 'bg-gray-500/20', textColor: 'text-gray-400' };
        }
    };
    if (isLoading || !booking) {
        return (<react_native_safe_area_context_1.SafeAreaView className="flex-1 bg-gray-900 items-center justify-center">
                <react_native_1.ActivityIndicator size="large" color="#22c55e"/>
                <react_native_1.Text className="text-gray-400 mt-4">Loading ride details...</react_native_1.Text>
            </react_native_safe_area_context_1.SafeAreaView>);
    }
    const status = getStatusBadge();
    const customerName = ((_a = booking.customer) === null || _a === void 0 ? void 0 : _a.name) || 'Customer';
    const isInProgress = booking.status === 'in_progress';
    const targetLat = isInProgress ? booking.destination_latitude : booking.origin_latitude;
    const targetLng = isInProgress ? booking.destination_longitude : booking.origin_longitude;
    return (<react_native_safe_area_context_1.SafeAreaView className="flex-1 bg-gray-900">
            {/* Map View */}
            <react_native_1.View className="flex-1">
                {driverLocation ? (<react_native_maps_1.default ref={mapRef} style={{ flex: 1 }} provider={react_native_maps_1.PROVIDER_GOOGLE} initialRegion={{
                latitude: driverLocation.latitude,
                longitude: driverLocation.longitude,
                latitudeDelta: 0.05,
                longitudeDelta: 0.05,
            }} showsUserLocation={false} showsMyLocationButton={false}>
                        {/* Driver marker */}
                        <react_native_maps_1.Marker coordinate={driverLocation} title="You" anchor={{ x: 0.5, y: 0.5 }}>
                            <react_native_1.View className="bg-blue-500 p-2 rounded-full border-2 border-white">
                                <react_native_1.Text className="text-lg">🚗</react_native_1.Text>
                            </react_native_1.View>
                        </react_native_maps_1.Marker>

                        {/* Pickup marker */}
                        <react_native_maps_1.Marker coordinate={{
                latitude: booking.origin_latitude,
                longitude: booking.origin_longitude,
            }} title="Pickup" pinColor={isInProgress ? "gray" : "green"}/>

                        {/* Dropoff marker */}
                        <react_native_maps_1.Marker coordinate={{
                latitude: booking.destination_latitude,
                longitude: booking.destination_longitude,
            }} title="Drop-off" pinColor={isInProgress ? "red" : "blue"}/>

                        {/* Route line from driver to target */}
                        <react_native_maps_1.Polyline coordinates={[
                driverLocation,
                { latitude: targetLat, longitude: targetLng }
            ]} strokeColor={isInProgress ? "#ef4444" : "#22c55e"} strokeWidth={4} lineDashPattern={[10, 5]}/>
                    </react_native_maps_1.default>) : (<react_native_1.View className="flex-1 bg-gray-800 items-center justify-center">
                        <react_native_1.ActivityIndicator size="large" color="#22c55e"/>
                        <react_native_1.Text className="text-gray-400 mt-2">Getting location...</react_native_1.Text>
                    </react_native_1.View>)}
            </react_native_1.View>

            {/* Bottom Sheet */}
            <react_native_1.View className="bg-gray-900 rounded-t-3xl -mt-8 max-h-[50%]">
                <react_native_1.ScrollView className="p-5" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
                    {/* Status Badge */}
                    <react_native_1.View className="items-center mb-4">
                        <react_native_1.View className={`px-4 py-2 rounded-full ${status.color}`}>
                            <react_native_1.Text className={`font-JakartaSemiBold ${status.textColor}`}>
                                {status.text}
                            </react_native_1.Text>
                        </react_native_1.View>
                    </react_native_1.View>

                    {/* Customer/Receiver Info */}
                    <react_native_1.View className="bg-gray-800 rounded-2xl p-4 mb-4">
                        <react_native_1.View className="flex-row justify-between items-center">
                            <react_native_1.View className="flex-row items-center">
                                <react_native_1.View className="w-12 h-12 bg-gray-700 rounded-full items-center justify-center mr-3">
                                    <vector_icons_1.Feather name="user" size={24} color="#9ca3af"/>
                                </react_native_1.View>
                                <react_native_1.View>
                                    <react_native_1.Text className="text-white font-JakartaBold">
                                        {isInProgress ? (booking.receiver_name || 'Receiver') : customerName}
                                    </react_native_1.Text>
                                    <react_native_1.Text className="text-gray-400 text-sm">
                                        {isInProgress ? 'Receiver' : 'Customer'}
                                    </react_native_1.Text>
                                </react_native_1.View>
                            </react_native_1.View>
                            <react_native_1.TouchableOpacity onPress={callCustomer} className="bg-green-500/20 w-12 h-12 rounded-full items-center justify-center">
                                <vector_icons_1.Feather name="phone" size={20} color="#22c55e"/>
                            </react_native_1.TouchableOpacity>
                        </react_native_1.View>
                    </react_native_1.View>

                    {/* Pickup OTP - shown when arrived */}
                    {booking.status === 'driver_arrived' && booking.pickup_otp && (<react_native_1.View className="bg-blue-500/10 rounded-xl p-4 mb-4">
                            <react_native_1.Text className="text-blue-400 text-sm font-JakartaMedium mb-1">
                                Ask customer for OTP to start trip
                            </react_native_1.Text>
                            <react_native_1.Text className="text-white text-xl font-JakartaBold">
                                Expected OTP: ****
                            </react_native_1.Text>
                        </react_native_1.View>)}

                    {/* Ride Details */}
                    <react_native_1.View className="bg-gray-800 rounded-2xl p-4 mb-4">
                        <react_native_1.View className="mb-3">
                            <react_native_1.Text className="text-gray-400 text-xs mb-1">
                                {isInProgress ? 'DROP-OFF' : 'PICKUP'}
                            </react_native_1.Text>
                            <react_native_1.Text className="text-white font-JakartaSemiBold" numberOfLines={2}>
                                {isInProgress ? booking.destination_address : booking.origin_address}
                            </react_native_1.Text>
                        </react_native_1.View>

                        {!isInProgress && (<react_native_1.View className="mb-3">
                                <react_native_1.Text className="text-gray-400 text-xs mb-1">DROP-OFF</react_native_1.Text>
                                <react_native_1.Text className="text-white font-JakartaSemiBold" numberOfLines={2}>
                                    {booking.destination_address}
                                </react_native_1.Text>
                            </react_native_1.View>)}

                        {/* Receiver contact when in progress */}
                        {isInProgress && booking.receiver_phone && (<react_native_1.View className="mb-3">
                                <react_native_1.Text className="text-gray-400 text-xs mb-1">RECEIVER PHONE</react_native_1.Text>
                                <react_native_1.Text className="text-white font-JakartaSemiBold">
                                    +91 {booking.receiver_phone}
                                </react_native_1.Text>
                            </react_native_1.View>)}

                        <react_native_1.View className="flex-row gap-4 mt-3 pt-3 border-t border-gray-700">
                            <react_native_1.View className="flex-1">
                                <react_native_1.Text className="text-gray-400 text-xs">Distance</react_native_1.Text>
                                <react_native_1.Text className="text-white font-JakartaSemiBold">
                                    {((_b = booking.estimated_distance) === null || _b === void 0 ? void 0 : _b.toFixed(1)) || '0'} km
                                </react_native_1.Text>
                            </react_native_1.View>
                            <react_native_1.View className="flex-1">
                                <react_native_1.Text className="text-gray-400 text-xs">Est. Time</react_native_1.Text>
                                <react_native_1.Text className="text-white font-JakartaSemiBold">
                                    {((_c = booking.estimated_duration) === null || _c === void 0 ? void 0 : _c.toFixed(0)) || '0'} min
                                </react_native_1.Text>
                            </react_native_1.View>
                            <react_native_1.View className="flex-1">
                                <react_native_1.Text className="text-gray-400 text-xs">Fare</react_native_1.Text>
                                <react_native_1.Text className="text-green-400 font-JakartaBold">
                                    ₹{booking.driver_payout || booking.total_fare}
                                </react_native_1.Text>
                            </react_native_1.View>
                        </react_native_1.View>
                    </react_native_1.View>

                    {/* Action Buttons */}
                    <react_native_1.View className="flex-row gap-3">
                        <react_native_1.TouchableOpacity onPress={openNavigation} className="flex-1 bg-blue-500 p-4 rounded-xl flex-row items-center justify-center">
                            <vector_icons_1.Feather name="navigation" size={18} color="#fff"/>
                            <react_native_1.Text className="text-white ml-2 font-JakartaBold">Navigate</react_native_1.Text>
                        </react_native_1.TouchableOpacity>
                        <react_native_1.TouchableOpacity onPress={handleStatusUpdate} disabled={isUpdating} className="flex-1 bg-green-500 p-4 rounded-xl flex-row items-center justify-center">
                            {isUpdating ? (<react_native_1.ActivityIndicator size="small" color="#fff"/>) : (<react_native_1.Text className="text-white text-center font-JakartaBold">
                                    {getButtonText()}
                                </react_native_1.Text>)}
                        </react_native_1.TouchableOpacity>
                    </react_native_1.View>

                    {/* Cancel Option - before trip start */}
                    {(booking.status === 'accepted' || booking.status === 'driver_arrived') && (<react_native_1.TouchableOpacity onPress={() => {
                react_native_1.Alert.alert('Cancel Ride', 'Are you sure you want to cancel this ride?', [
                    { text: 'No', style: 'cancel' },
                    {
                        text: 'Yes, Cancel',
                        style: 'destructive',
                        onPress: async () => {
                            if (!booking.driver_id) {
                                react_native_1.Alert.alert('Error', 'Driver info missing');
                                return;
                            }
                            const { success, error } = await (0, bookings_1.cancelBookingByDriver)(id, booking.driver_id, 'Cancelled by driver');
                            if (success) {
                                expo_router_1.router.replace('/(tabs)/home');
                            }
                            else {
                                react_native_1.Alert.alert('Error', error || 'Failed to cancel ride');
                            }
                        },
                    },
                ]);
            }} className="mt-4">
                            <react_native_1.Text className="text-red-400 text-center">Cancel Ride</react_native_1.Text>
                        </react_native_1.TouchableOpacity>)}
                </react_native_1.ScrollView>
            </react_native_1.View>
        </react_native_safe_area_context_1.SafeAreaView>);
};
exports.default = ActiveRide;
