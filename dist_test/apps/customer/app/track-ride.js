"use strict";
// Track Ride Screen
// Live tracking of driver location during shipment
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const store_1 = require("@/store");
const expo_router_1 = require("expo-router");
const react_1 = require("react");
const react_native_1 = require("react-native");
const react_native_safe_area_context_1 = require("react-native-safe-area-context");
const vector_icons_1 = require("@expo/vector-icons");
const react_native_maps_1 = __importStar(require("react-native-maps"));
const bookings_1 = require("@/lib/bookings");
const PaymentConfirmationModal_1 = __importDefault(require("@/components/PaymentConfirmationModal"));
const TrackRidePage = () => {
    var _a;
    const { bookingId } = (0, expo_router_1.useLocalSearchParams)();
    const { currentBooking, setCurrentBooking } = (0, store_1.useBookingStore)();
    const { destinationAddress } = (0, store_1.useLocationStore)();
    const [booking, setBooking] = (0, react_1.useState)(currentBooking);
    const [driverLocation, setDriverLocation] = (0, react_1.useState)(null);
    const [isLoading, setIsLoading] = (0, react_1.useState)(true);
    const [showPaymentConfirmation, setShowPaymentConfirmation] = (0, react_1.useState)(false);
    const [completedBookingAmount, setCompletedBookingAmount] = (0, react_1.useState)(0);
    const mapRef = (0, react_1.useRef)(null);
    // Fetch booking and set up subscriptions
    (0, react_1.useEffect)(() => {
        if (!bookingId) {
            expo_router_1.router.replace("/(tabs)/home");
            return;
        }
        // Fetch latest booking data
        (0, bookings_1.getBookingById)(bookingId).then(({ data }) => {
            if (data) {
                // If booking is still pending (finding driver), redirect back to waiting screen
                if (data.status === 'pending' || !data.driver_id) {
                    expo_router_1.router.replace({
                        pathname: "/waiting-for-driver",
                        params: { bookingId }
                    });
                    return;
                }
                setBooking(data);
                setCurrentBooking(data);
                setIsLoading(false);
            }
        });
        // Subscribe to booking status updates
        const unsubscribeBooking = (0, bookings_1.subscribeToBooking)(bookingId, (updatedBooking) => {
            setBooking(updatedBooking);
            setCurrentBooking(updatedBooking);
            // If completed, show payment confirmation modal first
            if (updatedBooking.status === 'completed') {
                setCompletedBookingAmount(updatedBooking.driver_payout || updatedBooking.total_fare);
                setShowPaymentConfirmation(true);
            }
            else if (updatedBooking.status === 'pending') {
                // Driver cancelled - redirect back to waiting screen to find new driver
                expo_router_1.router.replace({
                    pathname: "/waiting-for-driver",
                    params: { bookingId }
                });
            }
        });
        return () => unsubscribeBooking();
    }, [bookingId]);
    // Subscribe to driver location when we have driver info
    (0, react_1.useEffect)(() => {
        if (!(booking === null || booking === void 0 ? void 0 : booking.driver_id))
            return;
        const unsubscribeLocation = (0, bookings_1.subscribeToDriverLocation)(booking.driver_id, setDriverLocation);
        return () => unsubscribeLocation();
    }, [booking === null || booking === void 0 ? void 0 : booking.driver_id]);
    // Fit map to show driver and destination
    (0, react_1.useEffect)(() => {
        if (driverLocation && booking && mapRef.current) {
            const isInProgress = booking.status === 'in_progress';
            const targetLat = isInProgress ? booking.destination_latitude : booking.origin_latitude;
            const targetLng = isInProgress ? booking.destination_longitude : booking.origin_longitude;
            mapRef.current.fitToCoordinates([
                driverLocation,
                { latitude: targetLat, longitude: targetLng }
            ], {
                edgePadding: { top: 80, right: 50, bottom: 400, left: 50 },
                animated: true
            });
        }
    }, [driverLocation, booking === null || booking === void 0 ? void 0 : booking.status]);
    // Call driver
    const handleCallDriver = () => {
        var _a, _b;
        if ((_b = (_a = booking === null || booking === void 0 ? void 0 : booking.driver) === null || _a === void 0 ? void 0 : _a.user) === null || _b === void 0 ? void 0 : _b.phone) {
            react_native_1.Linking.openURL(`tel:${booking.driver.user.phone}`);
        }
    };
    // Get status message
    const getStatusMessage = () => {
        switch (booking === null || booking === void 0 ? void 0 : booking.status) {
            case 'accepted':
                return { text: 'Driver is on the way to pickup', color: 'bg-blue-500' };
            case 'driver_arrived':
                return { text: 'Driver has arrived at pickup', color: 'bg-yellow-500' };
            case 'in_progress':
                return { text: 'Shipment in progress', color: 'bg-green-500' };
            default:
                return { text: 'Tracking shipment...', color: 'bg-gray-500' };
        }
    };
    const status = getStatusMessage();
    const isInProgress = (booking === null || booking === void 0 ? void 0 : booking.status) === 'in_progress';
    if (isLoading) {
        return (<react_native_safe_area_context_1.SafeAreaView className="flex-1 bg-white items-center justify-center">
        <react_native_1.ActivityIndicator size="large" color="#FF9800"/>
        <react_native_1.Text className="mt-4 text-gray-500 font-JakartaMedium">Loading tracking...</react_native_1.Text>
      </react_native_safe_area_context_1.SafeAreaView>);
    }
    return (<react_native_1.View className="flex-1 bg-white">
      {/* Map with driver tracking */}
      <react_native_1.View className="absolute inset-0 h-[55%]">
        {booking ? (<react_native_maps_1.default ref={mapRef} style={{ flex: 1 }} provider={react_native_maps_1.PROVIDER_GOOGLE} initialRegion={{
                latitude: booking.origin_latitude,
                longitude: booking.origin_longitude,
                latitudeDelta: 0.05,
                longitudeDelta: 0.05,
            }} showsUserLocation={false} showsMyLocationButton={false}>
            {/* Driver marker */}
            {driverLocation && (<react_native_maps_1.Marker coordinate={driverLocation} anchor={{ x: 0.5, y: 0.5 }}>
                <react_native_1.View style={{ backgroundColor: '#3b82f6', padding: 8, borderRadius: 20, borderWidth: 2, borderColor: 'white' }}>
                  <react_native_1.Text style={{ fontSize: 18 }}>🚗</react_native_1.Text>
                </react_native_1.View>
              </react_native_maps_1.Marker>)}

            {/* Pickup marker */}
            <react_native_maps_1.Marker coordinate={{
                latitude: booking.origin_latitude,
                longitude: booking.origin_longitude,
            }} title="Pickup" pinColor={isInProgress ? "gray" : "green"}/>

            {/* Dropoff marker */}
            <react_native_maps_1.Marker coordinate={{
                latitude: booking.destination_latitude,
                longitude: booking.destination_longitude,
            }} title="Drop-off" pinColor="red"/>

            {/* Route line from driver to current target */}
            {driverLocation && (<react_native_maps_1.Polyline coordinates={[
                    driverLocation,
                    {
                        latitude: isInProgress ? booking.destination_latitude : booking.origin_latitude,
                        longitude: isInProgress ? booking.destination_longitude : booking.origin_longitude
                    }
                ]} strokeColor={isInProgress ? "#ef4444" : "#22c55e"} strokeWidth={4} lineDashPattern={[10, 5]}/>)}
          </react_native_maps_1.default>) : (<react_native_1.View className="flex-1 bg-gray-100 items-center justify-center">
            <react_native_1.ActivityIndicator size="large" color="#22c55e"/>
          </react_native_1.View>)}
      </react_native_1.View>

      {/* Header */}
      <react_native_safe_area_context_1.SafeAreaView className="z-10 bg-transparent pointer-events-box-none">
        <react_native_1.View className="flex-row items-center justify-between px-5 pt-2">
          <react_native_1.TouchableOpacity onPress={() => expo_router_1.router.back()} className="w-12 h-12 bg-white rounded-full items-center justify-center shadow-sm">
            <vector_icons_1.Feather name="chevron-left" size={24} color="black"/>
          </react_native_1.TouchableOpacity>
          <react_native_1.Text className="text-xl font-JakartaBold text-black">Track Shipment</react_native_1.Text>
          <react_native_1.TouchableOpacity className="w-12 h-12 bg-white rounded-full items-center justify-center shadow-sm">
            <vector_icons_1.Feather name="more-vertical" size={24} color="black"/>
          </react_native_1.TouchableOpacity>
        </react_native_1.View>
      </react_native_safe_area_context_1.SafeAreaView>

      {/* Bottom Sheet */}
      <react_native_1.View className="absolute bottom-0 w-full bg-white rounded-t-[32px] shadow-lg h-[50%]">
        <react_native_1.ScrollView className="pt-6 pb-8 px-6" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
          {/* Status Badge */}
          <react_native_1.View className="items-center mb-4">
            <react_native_1.View className={`${status.color} px-4 py-2 rounded-full`}>
              <react_native_1.Text className="text-white font-JakartaSemiBold">{status.text}</react_native_1.Text>
            </react_native_1.View>
          </react_native_1.View>

          {/* Driver Info */}
          {(booking === null || booking === void 0 ? void 0 : booking.driver) && (<react_native_1.View className="bg-gray-50 rounded-2xl p-4 mb-4">
              <react_native_1.View className="flex-row items-center justify-between">
                <react_native_1.View className="flex-row items-center">
                  <react_native_1.View className="w-14 h-14 bg-gray-200 rounded-full items-center justify-center mr-3">
                    <vector_icons_1.Feather name="user" size={24} color="#666"/>
                  </react_native_1.View>
                  <react_native_1.View>
                    <react_native_1.Text className="text-lg font-JakartaBold text-gray-800">
                      {((_a = booking.driver.user) === null || _a === void 0 ? void 0 : _a.name) || 'Driver'}
                    </react_native_1.Text>
                    <react_native_1.View className="flex-row items-center">
                      <react_native_1.Text className="text-gray-500 text-sm font-JakartaMedium mr-2">
                        {booking.driver.vehicle_number}
                      </react_native_1.Text>
                      <vector_icons_1.Feather name="star" size={12} color="#f59e0b"/>
                      <react_native_1.Text className="text-gray-500 text-sm ml-1">
                        {booking.driver.rating}
                      </react_native_1.Text>
                    </react_native_1.View>
                  </react_native_1.View>
                </react_native_1.View>

                <react_native_1.TouchableOpacity onPress={handleCallDriver} className="w-12 h-12 bg-green-500 rounded-full items-center justify-center">
                  <vector_icons_1.Feather name="phone" size={20} color="#fff"/>
                </react_native_1.TouchableOpacity>
              </react_native_1.View>
            </react_native_1.View>)}

          {/* Trip Info */}
          <react_native_1.View className="bg-gray-50 rounded-2xl p-4 mb-4">
            <react_native_1.View className="flex-row justify-between mb-3">
              <react_native_1.View>
                <react_native_1.Text className="text-xs text-gray-500 font-JakartaMedium">DROP LOCATION</react_native_1.Text>
                <react_native_1.Text className="text-sm font-JakartaSemiBold text-gray-800" numberOfLines={1}>
                  {destinationAddress || (booking === null || booking === void 0 ? void 0 : booking.destination_address)}
                </react_native_1.Text>
              </react_native_1.View>
            </react_native_1.View>

            <react_native_1.View className="h-px bg-gray-200 my-2"/>

            <react_native_1.View className="flex-row justify-between">
              <react_native_1.View className="items-center flex-1">
                <react_native_1.Text className="text-xs text-gray-500">Receiver</react_native_1.Text>
                <react_native_1.Text className="text-sm font-JakartaSemiBold text-gray-800">
                  {booking === null || booking === void 0 ? void 0 : booking.receiver_name}
                </react_native_1.Text>
              </react_native_1.View>
              
              {/* Show Pickup OTP before trip starts, Delivery OTP during/after trip */}
              {(booking === null || booking === void 0 ? void 0 : booking.status) === 'in_progress' || (booking === null || booking === void 0 ? void 0 : booking.status) === 'completed' ? (<react_native_1.View className="items-center flex-1">
                  <react_native_1.Text className="text-xs text-gray-500">Delivery OTP</react_native_1.Text>
                  <react_native_1.Text className="text-lg font-JakartaBold text-orange-600">
                    {(booking === null || booking === void 0 ? void 0 : booking.delivery_otp) || '------'}
                  </react_native_1.Text>
                  <react_native_1.Text className="text-[10px] text-gray-400 mt-1">Share with Driver to Receive</react_native_1.Text>
                </react_native_1.View>) : (<react_native_1.View className="items-center flex-1">
                  <react_native_1.Text className="text-xs text-gray-500">Pickup OTP</react_native_1.Text>
                  <react_native_1.Text className="text-lg font-JakartaBold text-blue-600">
                    {booking === null || booking === void 0 ? void 0 : booking.pickup_otp}
                  </react_native_1.Text>
                  <react_native_1.Text className="text-[10px] text-gray-400 mt-1">Give to driver</react_native_1.Text>
                </react_native_1.View>)}
              
              <react_native_1.View className="items-center flex-1">
                <react_native_1.Text className="text-xs text-gray-500">Fare</react_native_1.Text>
                <react_native_1.Text className="text-sm font-JakartaBold text-green-600">
                  ₹{(booking === null || booking === void 0 ? void 0 : booking.driver_payout) || (booking === null || booking === void 0 ? void 0 : booking.total_fare)}
                </react_native_1.Text>
              </react_native_1.View>
            </react_native_1.View>

            {/* Payment Request Banner */}
            {/* Note: In a real app we'd add a 'payment_requested_at' field or similar logic.
            For now we rely on status='in_progress' and user check manually via push notification,
            or we can add a persistent button here if not paid. */}
            {(booking === null || booking === void 0 ? void 0 : booking.status) === 'in_progress' && (booking === null || booking === void 0 ? void 0 : booking.payment_status) !== 'paid' && (<react_native_1.TouchableOpacity onPress={() => expo_router_1.router.push({ pathname: "/pay-booking", params: { bookingId: booking.id } })} className="mt-4 bg-primary-100 p-3 rounded-lg flex-row items-center justify-between">
                  <react_native_1.View className="flex-row items-center">
                      <vector_icons_1.Feather name="credit-card" size={18} color="#FF9800"/>
                      <react_native_1.Text className="ml-2 text-primary-600 font-JakartaSemiBold">Pay Online</react_native_1.Text>
                  </react_native_1.View>
                  <vector_icons_1.Feather name="chevron-right" size={18} color="#FF9800"/>
               </react_native_1.TouchableOpacity>)}

            {(booking === null || booking === void 0 ? void 0 : booking.payment_status) === 'paid' && (<react_native_1.View className="mt-4 bg-green-100 p-2 rounded-lg items-center">
                  <react_native_1.Text className="text-green-700 font-JakartaBold text-xs">PAYMENT COMPLETE</react_native_1.Text>
               </react_native_1.View>)}

          </react_native_1.View>

          {/* SOS Button */}
          <react_native_1.TouchableOpacity onPress={() => {
            react_native_1.Alert.alert("Emergency SOS", "Are you sure you want to call emergency services?", [
                { text: "Cancel", style: "cancel" },
                { text: "Call 112", style: "destructive", onPress: () => react_native_1.Linking.openURL('tel:112') }
            ]);
        }} className="bg-red-500 py-4 rounded-xl flex-row items-center justify-center">
            <vector_icons_1.Feather name="alert-triangle" size={20} color="#fff"/>
            <react_native_1.Text className="ml-2 text-white font-JakartaBold">Emergency SOS</react_native_1.Text>
          </react_native_1.TouchableOpacity>
        </react_native_1.ScrollView>
      </react_native_1.View>

      {/* Payment Confirmation Modal - shown after trip completion */}
      <PaymentConfirmationModal_1.default visible={showPaymentConfirmation} bookingId={bookingId || ''} amount={completedBookingAmount} onConfirm={() => {
            setShowPaymentConfirmation(false);
            expo_router_1.router.replace("/(tabs)/home");
        }} onSkip={() => {
            setShowPaymentConfirmation(false);
            expo_router_1.router.replace("/(tabs)/home");
        }}/>
    </react_native_1.View>);
};
exports.default = TrackRidePage;
