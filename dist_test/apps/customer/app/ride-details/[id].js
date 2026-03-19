"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const react_native_1 = require("react-native");
const react_native_safe_area_context_1 = require("react-native-safe-area-context");
const expo_router_1 = require("expo-router");
const react_1 = require("react");
const vector_icons_1 = require("@expo/vector-icons");
const bookings_1 = require("@/lib/bookings");
const supabase_1 = require("@/lib/supabase");
const RideDetails = () => {
    var _a;
    const { id } = (0, expo_router_1.useLocalSearchParams)();
    const [booking, setBooking] = (0, react_1.useState)(null);
    const [isLoading, setIsLoading] = (0, react_1.useState)(true);
    const [rating, setRating] = (0, react_1.useState)(0);
    const [review, setReview] = (0, react_1.useState)('');
    const [isSubmittingRating, setIsSubmittingRating] = (0, react_1.useState)(false);
    (0, react_1.useEffect)(() => {
        if (!id) {
            expo_router_1.router.back();
            return;
        }
        const fetchBooking = async () => {
            const { data } = await (0, bookings_1.getBookingById)(id);
            if (data) {
                setBooking(data);
                // Pre-fill rating if already rated (assuming we had a ratings table, but simplified for now we might store in booking or separate table)
                // For now, we'll assume rating is stored on booking or just allow one-time rating submission
            }
            else {
                react_native_1.Alert.alert('Error', 'Failed to load trip details');
            }
            setIsLoading(false);
        };
        fetchBooking();
    }, [id]);
    const handleRateTrip = async () => {
        if (rating === 0) {
            react_native_1.Alert.alert('Rate Trip', 'Please select a star rating');
            return;
        }
        if (!(booking === null || booking === void 0 ? void 0 : booking.driver_id)) {
            react_native_1.Alert.alert('Error', 'Cannot rate a trip without a driver');
            return;
        }
        setIsSubmittingRating(true);
        try {
            const { error } = await supabase_1.supabase
                .from('ratings')
                .insert({
                booking_id: booking.id,
                from_user_id: booking.customer_id,
                to_user_id: booking.driver.user.id || booking.driver.id, // Fallback if join structure differs
                rating: rating,
                review: review,
                is_from_customer: true
            });
            if (error) {
                // Handle duplicate rating case nicely
                if (error.code === '23505') { // Unique violation
                    react_native_1.Alert.alert('Already Rated', 'You have already rated this trip.');
                }
                else {
                    throw error;
                }
            }
            else {
                react_native_1.Alert.alert('Thank you!', 'Your feedback helps us improve.');
                expo_router_1.router.back();
            }
        }
        catch (err) {
            console.error('Rating error:', err);
            react_native_1.Alert.alert('Error', 'Failed to submit rating. Please try again.');
        }
        finally {
            setIsSubmittingRating(false);
        }
    };
    if (isLoading || !booking) {
        return (<react_native_safe_area_context_1.SafeAreaView className="flex-1 bg-white items-center justify-center">
                <react_native_1.ActivityIndicator size="large" color="#FF9800"/>
            </react_native_safe_area_context_1.SafeAreaView>);
    }
    const isCompleted = booking.status === 'completed';
    const isCancelled = booking.status === 'cancelled';
    return (<react_native_safe_area_context_1.SafeAreaView className="flex-1 bg-gray-50">
            {/* Header */}
            <react_native_1.View className="px-5 py-4 flex-row items-center bg-white border-b border-gray-100 shadow-sm">
                <react_native_1.TouchableOpacity onPress={() => expo_router_1.router.back()} className="w-10 h-10 bg-gray-50 rounded-full items-center justify-center mr-4">
                    <vector_icons_1.Feather name="arrow-left" size={20} color="black"/>
                </react_native_1.TouchableOpacity>
                <react_native_1.Text className="text-xl font-JakartaBold">Trip Details</react_native_1.Text>
            </react_native_1.View>

            <react_native_1.ScrollView className="flex-1 px-5 pt-4">
                
                {/* Status Card */}
                <react_native_1.View className="bg-white p-5 rounded-2xl mb-4 shadow-sm">
                    <react_native_1.View className="flex-row justify-between items-center mb-4">
                        <react_native_1.Text className="text-gray-500 font-JakartaMedium">Status</react_native_1.Text>
                        <react_native_1.View className={`px-3 py-1 rounded-full ${isCompleted ? 'bg-green-100' : isCancelled ? 'bg-red-100' : 'bg-orange-100'}`}>
                            <react_native_1.Text className={`text-xs font-JakartaBold ${isCompleted ? 'text-green-700' : isCancelled ? 'text-red-700' : 'text-orange-700'}`}>
                                {booking.status.toUpperCase().replace('_', ' ')}
                            </react_native_1.Text>
                        </react_native_1.View>
                    </react_native_1.View>
                    
                    <react_native_1.Text className="text-3xl font-JakartaBold text-gray-800 mb-1">
                        ₹{booking.driver_payout || booking.total_fare}
                    </react_native_1.Text>
                     <react_native_1.Text className="text-gray-400 text-xs font-JakartaMedium mb-4">
                        {booking.payment_method === 'online' ? 'Paid Online' : 'Cash Payment'}
                    </react_native_1.Text>
                    
                    <react_native_1.View className="bg-gray-50 p-3 rounded-xl flex-row items-center">
                         <vector_icons_1.Feather name="calendar" size={16} color="#6b7280"/>
                         <react_native_1.Text className="ml-2 text-gray-600 text-sm">
                            {new Date(booking.created_at).toLocaleString('en-IN')}
                         </react_native_1.Text>
                    </react_native_1.View>
                </react_native_1.View>

                {/* Route Info */}
                <react_native_1.View className="bg-white p-5 rounded-2xl mb-4 shadow-sm">
                    <react_native_1.Text className="text-lg font-JakartaBold mb-4">Route Info</react_native_1.Text>
                    
                    <react_native_1.View className="flex-row mb-6">
                        <react_native_1.View className="items-center mr-4">
                            <react_native_1.View className="w-4 h-4 bg-green-500 rounded-full border-2 border-white shadow-sm"/>
                            <react_native_1.View className="w-0.5 h-10 bg-gray-200"/>
                            <react_native_1.View className="w-4 h-4 bg-red-500 rounded-full border-2 border-white shadow-sm"/>
                        </react_native_1.View>
                        <react_native_1.View className="flex-1">
                            <react_native_1.View>
                                <react_native_1.Text className="text-gray-500 text-xs font-JakartaMedium mb-1">PICKUP</react_native_1.Text>
                                <react_native_1.Text className="text-gray-900 font-JakartaMedium text-sm leading-5">
                                    {booking.origin_address}
                                </react_native_1.Text>
                            </react_native_1.View>
                            <react_native_1.View className="h-6"/>
                            <react_native_1.View>
                                <react_native_1.Text className="text-gray-500 text-xs font-JakartaMedium mb-1">DROP OFF</react_native_1.Text>
                                <react_native_1.Text className="text-gray-900 font-JakartaMedium text-sm leading-5">
                                    {booking.destination_address}
                                </react_native_1.Text>
                            </react_native_1.View>
                        </react_native_1.View>
                    </react_native_1.View>
                    
                    <react_native_1.View className="flex-row justify-between border-t border-gray-100 pt-4">
                        <react_native_1.View>
                            <react_native_1.Text className="text-gray-500 text-xs">Vehicle</react_native_1.Text>
                            <react_native_1.Text className="font-JakartaSemiBold capitalize">{booking.vehicle_type}</react_native_1.Text>
                        </react_native_1.View>
                        <react_native_1.View>
                            <react_native_1.Text className="text-gray-500 text-xs text-right">Distance</react_native_1.Text>
                            <react_native_1.Text className="font-JakartaSemiBold text-right">
                                {booking.estimated_distance ? (booking.estimated_distance / 1000).toFixed(1) : '-'} km
                            </react_native_1.Text>
                        </react_native_1.View>
                    </react_native_1.View>
                </react_native_1.View>

                {/* Receiver Info */}
                <react_native_1.View className="bg-white p-5 rounded-2xl mb-4 shadow-sm">
                    <react_native_1.Text className="text-lg font-JakartaBold mb-4">Receiver</react_native_1.Text>
                    <react_native_1.View className="flex-row items-center">
                        <react_native_1.View className="w-10 h-10 bg-orange-50 rounded-full items-center justify-center mr-3">
                            <vector_icons_1.Feather name="user" size={18} color="#FF9800"/>
                        </react_native_1.View>
                        <react_native_1.View>
                            <react_native_1.Text className="font-JakartaSemiBold text-gray-800">
                                {booking.receiver_name}
                            </react_native_1.Text>
                            <react_native_1.Text className="text-gray-500 text-sm">
                                +91 {booking.receiver_phone}
                            </react_native_1.Text>
                        </react_native_1.View>
                    </react_native_1.View>
                     {booking.delivery_otp && (<react_native_1.View className="mt-4 bg-gray-50 p-3 rounded-lg flex-row justify-between items-center">
                            <react_native_1.Text className="text-gray-500 text-sm">Delivery OTP</react_native_1.Text>
                            <react_native_1.Text className="font-JakartaBold text-lg text-gray-800 tracking-widest">{booking.delivery_otp}</react_native_1.Text>
                        </react_native_1.View>)}
                </react_native_1.View>
                
                {/* Driver Info - Only if assigned */}
                {booking.driver && (<react_native_1.View className="bg-white p-5 rounded-2xl mb-4 shadow-sm">
                        <react_native_1.Text className="text-lg font-JakartaBold mb-4">Driver</react_native_1.Text>
                        <react_native_1.View className="flex-row items-center">
                             <react_native_1.View className="w-10 h-10 bg-gray-200 rounded-full items-center justify-center mr-3">
                                <vector_icons_1.Feather name="user" size={18} color="#666"/>
                            </react_native_1.View>
                            <react_native_1.View className="flex-1">
                                <react_native_1.Text className="font-JakartaSemiBold text-gray-800">
                                    {((_a = booking.driver.user) === null || _a === void 0 ? void 0 : _a.name) || 'Driver'}
                                </react_native_1.Text>
                                <react_native_1.Text className="text-gray-500 text-sm">
                                    {booking.driver.vehicle_number}
                                </react_native_1.Text>
                            </react_native_1.View>
                        </react_native_1.View>
                    </react_native_1.View>)}

                {/* Rating Section (Only for completed trips) */}
                {isCompleted && (<react_native_1.View className="bg-white p-5 rounded-2xl mb-8 shadow-sm">
                        <react_native_1.Text className="text-lg font-JakartaBold mb-4">Rate your experience</react_native_1.Text>
                        <react_native_1.View className="flex-row justify-center space-x-2 mb-4">
                            {[1, 2, 3, 4, 5].map((star) => (<react_native_1.TouchableOpacity key={star} onPress={() => setRating(star)} className="p-2">
                                    <vector_icons_1.Feather name="star" size={32} color={rating >= star ? "#fbbf24" : "#e5e7eb"} fill={rating >= star ? "#fbbf24" : "none"}/>
                                </react_native_1.TouchableOpacity>))}
                        </react_native_1.View>
                        
                        <react_native_1.TouchableOpacity onPress={handleRateTrip} disabled={isSubmittingRating} className={`w-full py-3 rounded-xl flex-row items-center justify-center ${rating > 0 ? 'bg-primary-500' : 'bg-gray-200'}`}>
                            {isSubmittingRating ? <react_native_1.ActivityIndicator color="white"/> : (<react_native_1.Text className={`font-JakartaBold ${rating > 0 ? 'text-white' : 'text-gray-400'}`}>
                                    Submit Feedback
                                </react_native_1.Text>)}
                        </react_native_1.TouchableOpacity>
                    </react_native_1.View>)}

            </react_native_1.ScrollView>
        </react_native_safe_area_context_1.SafeAreaView>);
};
exports.default = RideDetails;
