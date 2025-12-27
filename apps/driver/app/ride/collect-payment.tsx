// Payment Collection Screen
// Driver collects payment (cash or online) and completes the trip

import { View, Text, TouchableOpacity, Alert, ActivityIndicator, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useState, useEffect } from 'react';
import { Feather } from '@expo/vector-icons';
import { getBookingById, updateBookingStatus, Booking } from '@/lib/bookings';
import { supabase } from '@/lib/supabase';

const CollectPayment = () => {
    const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
    const [booking, setBooking] = useState<Booking | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'online'>('cash');
    const [deliveryOtp, setDeliveryOtp] = useState('');
    const [showOtpInput, setShowOtpInput] = useState(false);

    // Fetch booking data
    useEffect(() => {
        if (!bookingId) {
            router.back();
            return;
        }

        const fetchBooking = async () => {
            const { data, error } = await getBookingById(bookingId);
            if (data) {
                setBooking(data);
            } else {
                Alert.alert('Error', 'Failed to load booking details');
                router.back();
            }
            setIsLoading(false);
        };

        fetchBooking();
    }, [bookingId]);

    const verifyDeliveryOtp = () => {
        if (deliveryOtp.length !== 6) {
            Alert.alert('Error', 'Please enter complete 6-digit OTP');
            return false;
        }

        if (deliveryOtp !== booking?.delivery_otp) {
            Alert.alert('Incorrect OTP', 'The delivery OTP is incorrect. Please try again.');
            return false;
        }

        return true;
    };

    const handleCompleteTrip = async (skipOtp: boolean = false) => {
        if (!booking || !bookingId) return;

        // Verify OTP if required
        if (!skipOtp && booking.delivery_otp && showOtpInput) {
            if (!verifyDeliveryOtp()) return;
        }

        setIsProcessing(true);

        try {
            // Update booking with payment info and complete status
            const { error } = await supabase
                .from('bookings')
                .update({
                    status: 'completed',
                    payment_status: 'paid',
                    payment_method: paymentMethod,
                    completed_at: new Date().toISOString(),
                    delivery_confirmed_at: new Date().toISOString(),
                })
                .eq('id', bookingId);

            if (error) {
                throw error;
            }

            // Success - show completion and navigate home
            Alert.alert(
                'Trip Completed! 🎉',
                `You earned ₹${booking.driver_payout || booking.total_fare} for this trip.`,
                [
                    {
                        text: 'Back to Home',
                        onPress: () => router.replace('/(tabs)/home'),
                    },
                ]
            );

        } catch (err: any) {
            console.error('Failed to complete trip:', err);
            Alert.alert('Error', err.message || 'Failed to complete trip. Please try again.');
            setIsProcessing(false);
        }
    };

    if (isLoading || !booking) {
        return (
            <SafeAreaView className="flex-1 bg-gray-900 items-center justify-center">
                <ActivityIndicator size="large" color="#22c55e" />
            </SafeAreaView>
        );
    }

    const fare = booking.driver_payout || booking.total_fare;

    return (
        <SafeAreaView className="flex-1 bg-gray-900">
            <View className="flex-1 px-6">
                {/* Header */}
                <View className="flex-row items-center py-4">
                    <TouchableOpacity 
                        onPress={() => router.back()}
                        className="w-10 h-10 bg-gray-800 rounded-full items-center justify-center mr-4"
                    >
                        <Feather name="arrow-left" size={20} color="#fff" />
                    </TouchableOpacity>
                    <Text className="text-xl font-JakartaBold text-white">Collect Payment</Text>
                </View>

                {/* Content */}
                <View className="flex-1">
                    {/* Fare Amount */}
                    <View className="bg-green-500/10 rounded-3xl p-8 items-center mb-6">
                        <Text className="text-gray-400 font-JakartaMedium mb-2">
                            Total Amount to Collect
                        </Text>
                        <Text className="text-5xl font-JakartaBold text-green-400">
                            ₹{fare}
                        </Text>
                        {booking.tip_amount && booking.tip_amount > 0 && (
                            <Text className="text-orange-400 font-JakartaMedium mt-2">
                                Includes ₹{booking.tip_amount} tip
                            </Text>
                        )}
                    </View>

                    {/* Payment Method Selection */}
                    <View className="mb-6">
                        <Text className="text-gray-400 font-JakartaSemiBold mb-3">
                            Payment Received Via
                        </Text>
                        <View className="flex-row gap-3">
                            <TouchableOpacity
                                onPress={() => setPaymentMethod('cash')}
                                className={`flex-1 p-4 rounded-xl flex-row items-center justify-center ${
                                    paymentMethod === 'cash' ? 'bg-green-500' : 'bg-gray-800'
                                }`}
                            >
                                <Feather name="dollar-sign" size={20} color={paymentMethod === 'cash' ? '#fff' : '#9ca3af'} />
                                <Text className={`ml-2 font-JakartaBold ${
                                    paymentMethod === 'cash' ? 'text-white' : 'text-gray-400'
                                }`}>
                                    Cash
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => setPaymentMethod('online')}
                                className={`flex-1 p-4 rounded-xl flex-row items-center justify-center ${
                                    paymentMethod === 'online' ? 'bg-green-500' : 'bg-gray-800'
                                }`}
                            >
                                <Feather name="credit-card" size={20} color={paymentMethod === 'online' ? '#fff' : '#9ca3af'} />
                                <Text className={`ml-2 font-JakartaBold ${
                                    paymentMethod === 'online' ? 'text-white' : 'text-gray-400'
                                }`}>
                                    Online
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Receiver Info */}
                    <View className="bg-gray-800 rounded-xl p-4 mb-6">
                        <View className="flex-row items-center mb-2">
                            <Feather name="user" size={18} color="#9ca3af" />
                            <Text className="ml-2 text-gray-400 font-JakartaMedium">Receiver</Text>
                        </View>
                        <Text className="text-white font-JakartaBold text-lg">
                            {booking.receiver_name || 'Customer'}
                        </Text>
                        {booking.receiver_phone && (
                            <Text className="text-gray-400">+91 {booking.receiver_phone}</Text>
                        )}
                    </View>

                    {/* Delivery OTP Verification */}
                    {booking.delivery_otp && (
                        <View className="mb-6">
                            {!showOtpInput ? (
                                <TouchableOpacity
                                    onPress={() => setShowOtpInput(true)}
                                    className="bg-blue-500/20 p-4 rounded-xl flex-row items-center justify-center"
                                >
                                    <Feather name="shield" size={20} color="#3b82f6" />
                                    <Text className="ml-2 text-blue-400 font-JakartaBold">
                                        Verify Delivery OTP (Optional)
                                    </Text>
                                </TouchableOpacity>
                            ) : (
                                <View className="bg-gray-800 rounded-xl p-4">
                                    <Text className="text-gray-400 font-JakartaMedium mb-3">
                                        Enter 6-digit Delivery OTP from receiver
                                    </Text>
                                    <TextInput
                                        value={deliveryOtp}
                                        onChangeText={(text) => setDeliveryOtp(text.replace(/[^0-9]/g, ''))}
                                        placeholder="Enter OTP"
                                        placeholderTextColor="#6b7280"
                                        keyboardType="number-pad"
                                        maxLength={6}
                                        className="bg-gray-700 rounded-xl p-4 text-white text-center text-xl font-JakartaBold"
                                    />
                                </View>
                            )}
                        </View>
                    )}
                </View>

                {/* Complete Button */}
                <View className="pb-4">
                    <TouchableOpacity
                        onPress={() => handleCompleteTrip(false)}
                        disabled={isProcessing}
                        className="bg-green-500 py-4 rounded-xl flex-row items-center justify-center mb-3"
                    >
                        {isProcessing ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <>
                                <Feather name="check-circle" size={20} color="#fff" />
                                <Text className="ml-2 text-white font-JakartaBold text-lg">
                                    Payment Received - Complete Trip
                                </Text>
                            </>
                        )}
                    </TouchableOpacity>

                    <Text className="text-gray-500 text-center text-sm">
                        Make sure you have collected ₹{fare} before completing
                    </Text>
                </View>
            </View>
        </SafeAreaView>
    );
};

export default CollectPayment;
