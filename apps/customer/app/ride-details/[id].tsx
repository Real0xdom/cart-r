import { View, Text, TouchableOpacity, ScrollView, Image, ActivityIndicator, Alert, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useState, useEffect } from 'react';
import { Feather } from '@expo/vector-icons';
import { getBookingById } from '@/lib/bookings';
import { supabase } from '@/lib/supabase';
import type { Booking } from '@/types/type';

const RideDetails = () => {
    const { id } = useLocalSearchParams<{ id: string }>();
    const [booking, setBooking] = useState<Booking | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [rating, setRating] = useState(0);
    const [review, setReview] = useState('');
    const [isSubmittingRating, setIsSubmittingRating] = useState(false);

    useEffect(() => {
        if (!id) {
            router.back();
            return;
        }

        const fetchBooking = async () => {
            const { data } = await getBookingById(id);
            if (data) {
                setBooking(data);
                // Pre-fill rating if already rated (assuming we had a ratings table, but simplified for now we might store in booking or separate table)
                // For now, we'll assume rating is stored on booking or just allow one-time rating submission
            } else {
                Alert.alert('Error', 'Failed to load trip details');
            }
            setIsLoading(false);
        };

        fetchBooking();
    }, [id]);

    const handleRateTrip = async () => {
        if (rating === 0) {
            Alert.alert('Rate Trip', 'Please select a star rating');
            return;
        }
        
        setIsSubmittingRating(true);
        try {
            // Update booking with rating (assuming we add these columns, strictly speaking we should have a reviews table)
            // For MVP, lets assume we update driver rating aggregate or insert into a 'reviews' table
            // Simplified: console log for now as schema might not have it
            
            // To make this real:
            // 1. Insert into reviews table
            // 2. Update driver average rating
            
            // Placeholder for now
            Alert.alert('Thank you!', 'Your feedback helps us improve.');
            
        } catch (err) {
            console.error(err);
        } finally {
            setIsSubmittingRating(false);
        }
    };

    if (isLoading || !booking) {
        return (
            <SafeAreaView className="flex-1 bg-white items-center justify-center">
                <ActivityIndicator size="large" color="#FF9800" />
            </SafeAreaView>
        );
    }
    
    const isCompleted = booking.status === 'completed';
    const isCancelled = booking.status === 'cancelled';

    return (
        <SafeAreaView className="flex-1 bg-gray-50">
            {/* Header */}
            <View className="px-5 py-4 flex-row items-center bg-white border-b border-gray-100 shadow-sm">
                <TouchableOpacity 
                    onPress={() => router.back()}
                    className="w-10 h-10 bg-gray-50 rounded-full items-center justify-center mr-4"
                >
                    <Feather name="arrow-left" size={20} color="black" />
                </TouchableOpacity>
                <Text className="text-xl font-JakartaBold">Trip Details</Text>
            </View>

            <ScrollView className="flex-1 px-5 pt-4">
                
                {/* Status Card */}
                <View className="bg-white p-5 rounded-2xl mb-4 shadow-sm">
                    <View className="flex-row justify-between items-center mb-4">
                        <Text className="text-gray-500 font-JakartaMedium">Status</Text>
                        <View className={`px-3 py-1 rounded-full ${isCompleted ? 'bg-green-100' : isCancelled ? 'bg-red-100' : 'bg-orange-100'}`}>
                            <Text className={`text-xs font-JakartaBold ${isCompleted ? 'text-green-700' : isCancelled ? 'text-red-700' : 'text-orange-700'}`}>
                                {booking.status.toUpperCase().replace('_', ' ')}
                            </Text>
                        </View>
                    </View>
                    
                    <Text className="text-3xl font-JakartaBold text-gray-800 mb-1">
                        ₹{booking.driver_payout || booking.total_fare}
                    </Text>
                     <Text className="text-gray-400 text-xs font-JakartaMedium mb-4">
                        {booking.payment_method === 'online' ? 'Paid Online' : 'Cash Payment'}
                    </Text>
                    
                    <View className="bg-gray-50 p-3 rounded-xl flex-row items-center">
                         <Feather name="calendar" size={16} color="#6b7280" />
                         <Text className="ml-2 text-gray-600 text-sm">
                            {new Date(booking.created_at).toLocaleString('en-IN')}
                         </Text>
                    </View>
                </View>

                {/* Route Info */}
                <View className="bg-white p-5 rounded-2xl mb-4 shadow-sm">
                    <Text className="text-lg font-JakartaBold mb-4">Route Info</Text>
                    
                    <View className="flex-row mb-6">
                        <View className="items-center mr-4">
                            <View className="w-4 h-4 bg-green-500 rounded-full border-2 border-white shadow-sm" />
                            <View className="w-0.5 h-10 bg-gray-200" />
                            <View className="w-4 h-4 bg-red-500 rounded-full border-2 border-white shadow-sm" />
                        </View>
                        <View className="flex-1">
                            <View>
                                <Text className="text-gray-500 text-xs font-JakartaMedium mb-1">PICKUP</Text>
                                <Text className="text-gray-900 font-JakartaMedium text-sm leading-5">
                                    {booking.origin_address}
                                </Text>
                            </View>
                            <View className="h-6" />
                            <View>
                                <Text className="text-gray-500 text-xs font-JakartaMedium mb-1">DROP OFF</Text>
                                <Text className="text-gray-900 font-JakartaMedium text-sm leading-5">
                                    {booking.destination_address}
                                </Text>
                            </View>
                        </View>
                    </View>
                    
                    <View className="flex-row justify-between border-t border-gray-100 pt-4">
                        <View>
                            <Text className="text-gray-500 text-xs">Vehicle</Text>
                            <Text className="font-JakartaSemiBold capitalize">{booking.vehicle_type}</Text>
                        </View>
                        <View>
                            <Text className="text-gray-500 text-xs text-right">Distance</Text>
                            <Text className="font-JakartaSemiBold text-right">
                                {booking.estimated_distance ? (booking.estimated_distance / 1000).toFixed(1) : '-'} km
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Receiver Info */}
                <View className="bg-white p-5 rounded-2xl mb-4 shadow-sm">
                    <Text className="text-lg font-JakartaBold mb-4">Receiver</Text>
                    <View className="flex-row items-center">
                        <View className="w-10 h-10 bg-orange-50 rounded-full items-center justify-center mr-3">
                            <Feather name="user" size={18} color="#FF9800" />
                        </View>
                        <View>
                            <Text className="font-JakartaSemiBold text-gray-800">
                                {booking.receiver_name}
                            </Text>
                            <Text className="text-gray-500 text-sm">
                                +91 {booking.receiver_phone}
                            </Text>
                        </View>
                    </View>
                     {booking.delivery_otp && (
                        <View className="mt-4 bg-gray-50 p-3 rounded-lg flex-row justify-between items-center">
                            <Text className="text-gray-500 text-sm">Delivery OTP</Text>
                            <Text className="font-JakartaBold text-lg text-gray-800 tracking-widest">{booking.pickup_otp}</Text>
                        </View>
                    )}
                </View>
                
                {/* Driver Info - Only if assigned */}
                {booking.driver && (
                    <View className="bg-white p-5 rounded-2xl mb-4 shadow-sm">
                        <Text className="text-lg font-JakartaBold mb-4">Driver</Text>
                        <View className="flex-row items-center">
                             <View className="w-10 h-10 bg-gray-200 rounded-full items-center justify-center mr-3">
                                <Feather name="user" size={18} color="#666" />
                            </View>
                            <View className="flex-1">
                                <Text className="font-JakartaSemiBold text-gray-800">
                                    {booking.driver.user?.name || 'Driver'}
                                </Text>
                                <Text className="text-gray-500 text-sm">
                                    {booking.driver.vehicle_number}
                                </Text>
                            </View>
                        </View>
                    </View>
                )}

                {/* Rating Section (Only for completed trips) */}
                {isCompleted && (
                    <View className="bg-white p-5 rounded-2xl mb-8 shadow-sm">
                        <Text className="text-lg font-JakartaBold mb-4">Rate your experience</Text>
                        <View className="flex-row justify-center space-x-2 mb-4">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <TouchableOpacity key={star} onPress={() => setRating(star)} className="p-2">
                                    <Feather 
                                        name="star" 
                                        size={32} 
                                        color={rating >= star ? "#fbbf24" : "#e5e7eb"} 
                                        fill={rating >= star ? "#fbbf24" : "none"}
                                    />
                                </TouchableOpacity>
                            ))}
                        </View>
                        
                        <TouchableOpacity 
                            onPress={handleRateTrip}
                            disabled={isSubmittingRating}
                            className={`w-full py-3 rounded-xl flex-row items-center justify-center ${rating > 0 ? 'bg-primary-500' : 'bg-gray-200'}`}
                        >
                            {isSubmittingRating ? <ActivityIndicator color="white" /> : (
                                <Text className={`font-JakartaBold ${rating > 0 ? 'text-white' : 'text-gray-400'}`}>
                                    Submit Feedback
                                </Text>
                            )}
                        </TouchableOpacity>
                    </View>
                )}

            </ScrollView>
        </SafeAreaView>
    );
};

export default RideDetails;
