"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const react_native_1 = require("react-native");
const react_native_safe_area_context_1 = require("react-native-safe-area-context");
const expo_router_1 = require("expo-router");
const react_1 = require("react");
const vector_icons_1 = require("@expo/vector-icons");
const bookings_1 = require("@/lib/bookings");
const payment_1 = require("@/lib/payment");
const supabase_1 = require("@/lib/supabase");
const AuthContext_1 = require("@/contexts/AuthContext");
const constants_1 = require("@/constants");
const PayBooking = () => {
    const { bookingId } = (0, expo_router_1.useLocalSearchParams)();
    const { user, profile } = (0, AuthContext_1.useAuth)();
    const [booking, setBooking] = (0, react_1.useState)(null);
    const [isLoading, setIsLoading] = (0, react_1.useState)(true);
    const [isPaying, setIsPaying] = (0, react_1.useState)(false);
    (0, react_1.useEffect)(() => {
        if (!bookingId) {
            expo_router_1.router.back();
            return;
        }
        const fetchBooking = async () => {
            const { data } = await (0, bookings_1.getBookingById)(bookingId);
            if (data) {
                setBooking(data);
                // Redirect if already paid
                if (data.payment_status === 'paid') {
                    react_native_1.Alert.alert('Success', 'This booking is already paid.');
                    expo_router_1.router.replace('/(tabs)/home');
                }
            }
            else {
                react_native_1.Alert.alert('Error', 'Booking not found');
                expo_router_1.router.back();
            }
            setIsLoading(false);
        };
        fetchBooking();
    }, [bookingId]);
    const handlePayment = async () => {
        if (!booking || !user || !profile)
            return;
        setIsPaying(true);
        try {
            const amount = booking.driver_payout || booking.total_fare;
            // 1. Create Order
            const { data: orderData, error: orderError } = await (0, payment_1.createPaymentOrder)(booking.id, user.id, profile.first_name + ' ' + profile.last_name, user.email || 'user@cartr.app', profile.phone_number || '9999999999', amount);
            if (orderError || !orderData)
                throw new Error(orderError || "Failed to create order");
            // 2. Initiate Payment (Web Flow for Expo Go / Native SDK for Prod)
            // Note: initiateCashfreePayment handles the environment switch
            const result = await (0, payment_1.initiateCashfreePayment)(orderData.payment_session_id, orderData.order_id);
            if (result.success) {
                // In Web Flow/Deep Link, we might need manual confirmation or polling.
                // For now, let's assume valid return initiates success or we poll.
                // But for standard flow, we wait for webhook.
                // However, we can optimistically update or Poll.
                react_native_1.Alert.alert('Use Browser to Pay', 'You will be redirected to Cashfree. After payment, come back here.', [
                    {
                        text: 'I have Paid',
                        onPress: () => checkPaymentStatus()
                    }
                ]);
            }
            else {
                throw new Error(result.error);
            }
        }
        catch (err) {
            react_native_1.Alert.alert('Payment Failed', err.message);
        }
        finally {
            setIsPaying(false);
        }
    };
    // Quick check function (could be improved with real-time sub)
    const checkPaymentStatus = async () => {
        setIsLoading(true);
        const { data } = await supabase_1.supabase
            .from('bookings')
            .select('payment_status')
            .eq('id', booking.id)
            .single();
        if ((data === null || data === void 0 ? void 0 : data.payment_status) === 'paid') {
            react_native_1.Alert.alert('Success', 'Payment Confirmed!', [
                { text: 'OK', onPress: () => expo_router_1.router.replace('/(tabs)/home') }
            ]);
        }
        else {
            react_native_1.Alert.alert('Not Confirmed', 'Payment status is still pending. Please wait a moment and try again.');
        }
        setIsLoading(false);
    };
    if (isLoading || !booking) {
        return (<react_native_safe_area_context_1.SafeAreaView className="flex-1 bg-white items-center justify-center">
                <react_native_1.ActivityIndicator size="large" color="#FF9800"/>
            </react_native_safe_area_context_1.SafeAreaView>);
    }
    const amount = booking.driver_payout || booking.total_fare;
    return (<react_native_safe_area_context_1.SafeAreaView className="flex-1 bg-white">
            <react_native_1.View className="flex-1 px-5 pt-5">
                 {/* Header */}
                 <react_native_1.View className="flex-row items-center mb-6">
                    <react_native_1.TouchableOpacity onPress={() => expo_router_1.router.back()} className="w-10 h-10 bg-gray-100 rounded-full items-center justify-center mr-4">
                        <vector_icons_1.Feather name="x" size={24} color="black"/>
                    </react_native_1.TouchableOpacity>
                    <react_native_1.Text className="text-2xl font-JakartaBold">Pay for Booking</react_native_1.Text>
                </react_native_1.View>
                
                <react_native_1.View className="items-center py-10">
                     <react_native_1.Image source={constants_1.images.onboarding2} className="w-40 h-40 mb-5" resizeMode="contain"/>
                     <react_native_1.Text className="text-gray-500 font-JakartaMedium mb-2">Request from Driver</react_native_1.Text>
                     <react_native_1.Text className="text-4xl font-JakartaBold text-primary-500">₹{amount}</react_native_1.Text>
                </react_native_1.View>
                
                <react_native_1.View className="bg-gray-50 p-5 rounded-2xl mb-8">
                    <react_native_1.View className="flex-row justify-between mb-3">
                        <react_native_1.Text className="text-gray-500">Booking ID</react_native_1.Text>
                        <react_native_1.Text className="font-JakartaBold">{booking.booking_number}</react_native_1.Text>
                    </react_native_1.View>
                     <react_native_1.View className="flex-row justify-between mb-3">
                        <react_native_1.Text className="text-gray-500">Distance</react_native_1.Text>
                        <react_native_1.Text className="font-JakartaBold">{(booking.estimated_distance / 1000).toFixed(1)} km</react_native_1.Text>
                    </react_native_1.View>
                    <react_native_1.View className="border-t border-gray-200 my-2"/>
                    <react_native_1.View className="flex-row justify-between mt-2">
                        <react_native_1.Text className="font-JakartaBold text-lg">Total Pay</react_native_1.Text>
                        <react_native_1.Text className="font-JakartaBold text-lg">₹{amount}</react_native_1.Text>
                    </react_native_1.View>
                </react_native_1.View>
                
                <react_native_1.TouchableOpacity onPress={handlePayment} disabled={isPaying} className="w-full bg-primary-500 py-4 rounded-full flex-row items-center justify-center shadow-md shadow-primary-300">
                    {isPaying ? (<react_native_1.ActivityIndicator color="white"/>) : (<>
                            <react_native_1.Text className="text-white font-JakartaBold text-lg mr-2">Pay Now</react_native_1.Text>
                            <vector_icons_1.Feather name="arrow-right" size={20} color="white"/>
                        </>)}
                </react_native_1.TouchableOpacity>
                
            </react_native_1.View>
        </react_native_safe_area_context_1.SafeAreaView>);
};
exports.default = PayBooking;
