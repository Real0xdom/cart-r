"use strict";
// OTP Verification Screen
// Driver enters pickup OTP from customer to start the trip
Object.defineProperty(exports, "__esModule", { value: true });
const react_native_1 = require("react-native");
const react_native_safe_area_context_1 = require("react-native-safe-area-context");
const expo_router_1 = require("expo-router");
const react_1 = require("react");
const vector_icons_1 = require("@expo/vector-icons");
const supabase_1 = require("@/lib/supabase");
const bookings_1 = require("@/lib/bookings");
const VerifyOTP = () => {
    const { bookingId } = (0, expo_router_1.useLocalSearchParams)();
    const [otp, setOtp] = (0, react_1.useState)(['', '', '', '']);
    const [booking, setBooking] = (0, react_1.useState)(null);
    const [isVerifying, setIsVerifying] = (0, react_1.useState)(false);
    const [error, setError] = (0, react_1.useState)(null);
    const [isLoading, setIsLoading] = (0, react_1.useState)(true);
    // Refs for OTP inputs
    const inputRefs = [
        (0, react_1.useRef)(null),
        (0, react_1.useRef)(null),
        (0, react_1.useRef)(null),
        (0, react_1.useRef)(null),
    ];
    // Fetch booking data
    (0, react_1.useEffect)(() => {
        if (!bookingId) {
            expo_router_1.router.back();
            return;
        }
        const fetchBooking = async () => {
            const { data, error } = await (0, bookings_1.getBookingById)(bookingId);
            if (data) {
                setBooking(data);
            }
            else {
                react_native_1.Alert.alert('Error', 'Failed to load booking details');
                expo_router_1.router.back();
            }
            setIsLoading(false);
        };
        fetchBooking();
    }, [bookingId]);
    // Handle OTP input
    const handleOtpChange = (value, index) => {
        var _a;
        // Only allow numbers
        const numericValue = value.replace(/[^0-9]/g, '');
        const newOtp = [...otp];
        newOtp[index] = numericValue;
        setOtp(newOtp);
        setError(null);
        // Auto-focus next input
        if (numericValue && index < 3) {
            (_a = inputRefs[index + 1].current) === null || _a === void 0 ? void 0 : _a.focus();
        }
    };
    // Handle backspace
    const handleKeyPress = (key, index) => {
        var _a;
        if (key === 'Backspace' && !otp[index] && index > 0) {
            (_a = inputRefs[index - 1].current) === null || _a === void 0 ? void 0 : _a.focus();
        }
    };
    // Verify OTP
    const handleVerify = async () => {
        var _a;
        const enteredOtp = otp.join('');
        if (enteredOtp.length !== 4) {
            setError('Please enter complete 4-digit OTP');
            return;
        }
        if (!booking) {
            setError('Booking not found');
            return;
        }
        setIsVerifying(true);
        setError(null);
        try {
            // Check if OTP matches
            if (enteredOtp !== booking.pickup_otp) {
                setError('Incorrect OTP. Please try again.');
                setOtp(['', '', '', '']);
                (_a = inputRefs[0].current) === null || _a === void 0 ? void 0 : _a.focus();
                setIsVerifying(false);
                return;
            }
            // OTP is correct - start the trip
            const { error: updateError } = await supabase_1.supabase
                .from('bookings')
                .update({
                status: 'in_progress',
                started_at: new Date().toISOString(),
            })
                .eq('id', bookingId);
            if (updateError) {
                throw updateError;
            }
            // Navigate to active ride screen
            expo_router_1.router.replace({
                pathname: '/ride/[id]',
                params: { id: bookingId },
            });
        }
        catch (err) {
            console.error('OTP verification failed:', err);
            setError(err.message || 'Verification failed. Please try again.');
            setIsVerifying(false);
        }
    };
    if (isLoading) {
        return (<react_native_safe_area_context_1.SafeAreaView className="flex-1 bg-gray-900 items-center justify-center">
                <react_native_1.ActivityIndicator size="large" color="#22c55e"/>
            </react_native_safe_area_context_1.SafeAreaView>);
    }
    return (<react_native_safe_area_context_1.SafeAreaView className="flex-1 bg-gray-900">
            <react_native_1.KeyboardAvoidingView className="flex-1" behavior={react_native_1.Platform.OS === 'ios' ? 'padding' : 'height'}>
                {/* Header */}
                <react_native_1.View className="flex-row items-center py-4 px-6">
                    <react_native_1.TouchableOpacity onPress={() => expo_router_1.router.back()} className="w-10 h-10 bg-gray-800 rounded-full items-center justify-center mr-4">
                        <vector_icons_1.Feather name="arrow-left" size={20} color="#fff"/>
                    </react_native_1.TouchableOpacity>
                    <react_native_1.Text className="text-xl font-JakartaBold text-white">Verify Pickup OTP</react_native_1.Text>
                </react_native_1.View>

                {/* Scrollable Content */}
                <react_native_1.ScrollView className="flex-1 px-6" contentContainerStyle={{ paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
                    <react_native_1.View className="items-center pt-12">
                        {/* Icon */}
                        <react_native_1.View className="w-24 h-24 bg-green-500/20 rounded-full items-center justify-center mb-8">
                            <vector_icons_1.Feather name="key" size={48} color="#22c55e"/>
                        </react_native_1.View>

                        {/* Instructions */}
                        <react_native_1.Text className="text-2xl font-JakartaBold text-white text-center mb-2">
                            Enter Pickup OTP
                        </react_native_1.Text>
                        <react_native_1.Text className="text-gray-400 text-center mb-8 px-4">
                            Ask the customer for the 4-digit OTP to verify pickup and start the trip
                        </react_native_1.Text>

                        {/* Customer Info */}
                        {(booking === null || booking === void 0 ? void 0 : booking.customer) && (<react_native_1.View className="bg-gray-800 rounded-xl p-4 w-full mb-8">
                                <react_native_1.View className="flex-row items-center">
                                    <react_native_1.View className="w-12 h-12 bg-gray-700 rounded-full items-center justify-center mr-3">
                                        <vector_icons_1.Feather name="user" size={24} color="#9ca3af"/>
                                    </react_native_1.View>
                                    <react_native_1.View>
                                        <react_native_1.Text className="text-white font-JakartaBold">
                                            {booking.customer.name}
                                        </react_native_1.Text>
                                        <react_native_1.Text className="text-gray-400 text-sm">
                                            Ask for OTP to start trip
                                        </react_native_1.Text>
                                    </react_native_1.View>
                                </react_native_1.View>
                            </react_native_1.View>)}

                        {/* OTP Input */}
                        <react_native_1.View className="flex-row justify-center gap-4 mb-6">
                            {otp.map((digit, index) => (<react_native_1.TextInput key={index} ref={inputRefs[index]} value={digit} onChangeText={(value) => handleOtpChange(value, index)} onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, index)} className={`w-16 h-16 bg-white rounded-xl text-center text-2xl font-JakartaBold text-black border-2 ${error ? 'border-red-500' : digit ? 'border-green-500' : 'border-gray-200'}`} keyboardType="number-pad" maxLength={1} selectTextOnFocus/>))}
                        </react_native_1.View>

                        {/* Error Message */}
                        {error && (<react_native_1.View className="flex-row items-center mb-4">
                                <vector_icons_1.Feather name="alert-circle" size={16} color="#ef4444"/>
                                <react_native_1.Text className="text-red-500 ml-2 font-JakartaMedium">{error}</react_native_1.Text>
                            </react_native_1.View>)}

                        {/* Verify Button */}
                        <react_native_1.TouchableOpacity onPress={handleVerify} disabled={isVerifying || otp.join('').length !== 4} className={`w-full py-4 rounded-xl flex-row items-center justify-center ${otp.join('').length === 4 ? 'bg-green-500' : 'bg-gray-700'}`}>
                            {isVerifying ? (<react_native_1.ActivityIndicator size="small" color="#fff"/>) : (<>
                                    <vector_icons_1.Feather name="check-circle" size={20} color="#fff"/>
                                    <react_native_1.Text className="ml-2 text-white font-JakartaBold text-lg">
                                        Verify & Start Trip
                                    </react_native_1.Text>
                                </>)}
                        </react_native_1.TouchableOpacity>

                        {/* Footer Info */}
                        <react_native_1.View className="bg-yellow-500/10 rounded-xl p-4 mt-6 w-full">
                            <react_native_1.View className="flex-row items-start">
                                <vector_icons_1.Feather name="info" size={18} color="#eab308"/>
                                <react_native_1.Text className="ml-2 text-yellow-500 font-JakartaMedium flex-1">
                                    The customer has received an OTP via the app. Please ask them to share it to verify pickup.
                                </react_native_1.Text>
                            </react_native_1.View>
                        </react_native_1.View>
                    </react_native_1.View>
                </react_native_1.ScrollView>
            </react_native_1.KeyboardAvoidingView>
        </react_native_safe_area_context_1.SafeAreaView>);
};
exports.default = VerifyOTP;
