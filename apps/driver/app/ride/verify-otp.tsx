// OTP Verification Screen
// Driver enters pickup OTP from customer to start the trip

import { View, Text, TouchableOpacity, TextInput, Alert, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useState, useRef, useEffect } from 'react';
import { Feather } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { getBookingById, updateBookingStatus, subscribeToBooking } from '@/lib/bookings';
import type { Booking } from '@/lib/bookings';

const VerifyOTP = () => {
    const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
    const [otp, setOtp] = useState(['', '', '', '']);
    const [booking, setBooking] = useState<Booking | null>(null);
    const [isVerifying, setIsVerifying] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    
    // Refs for OTP inputs
    const inputRefs = [
        useRef<TextInput>(null),
        useRef<TextInput>(null),
        useRef<TextInput>(null),
        useRef<TextInput>(null),
    ];

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
        
        // Subscribe to booking updates (for cancellation)
        const unsubscribe = subscribeToBooking(bookingId, (updatedBooking) => {
            // Customer cancelled the ride
            if (updatedBooking.status === 'cancelled') {
                Alert.alert(
                    'Ride Cancelled',
                    `The customer has cancelled this ride.\nReason: ${updatedBooking.cancellation_reason || 'No reason provided'}`,
                    [{
                        text: 'OK',
                        onPress: () => router.replace('/(tabs)/home')
                    }]
                );
                return;
            }
            setBooking(updatedBooking);
        });
        
        return () => unsubscribe();
    }, [bookingId]);

    // Handle OTP input
    const handleOtpChange = (value: string, index: number) => {
        // Only allow numbers
        const numericValue = value.replace(/[^0-9]/g, '');
        
        const newOtp = [...otp];
        newOtp[index] = numericValue;
        setOtp(newOtp);
        setError(null);

        // Auto-focus next input
        if (numericValue && index < 3) {
            inputRefs[index + 1].current?.focus();
        }
    };

    // Handle backspace
    const handleKeyPress = (key: string, index: number) => {
        if (key === 'Backspace' && !otp[index] && index > 0) {
            inputRefs[index - 1].current?.focus();
        }
    };

    // Verify OTP
    const handleVerify = async () => {
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
                inputRefs[0].current?.focus();
                setIsVerifying(false);
                return;
            }

            // OTP is correct - start the trip
            const { error: updateError } = await supabase
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
            router.replace({
                pathname: '/ride/[id]',
                params: { id: bookingId },
            });

        } catch (err: any) {
            console.error('OTP verification failed:', err);
            setError(err.message || 'Verification failed. Please try again.');
            setIsVerifying(false);
        }
    };

    if (isLoading) {
        return (
            <SafeAreaView className="flex-1 bg-gray-900 items-center justify-center">
                <ActivityIndicator size="large" color="#22c55e" />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-gray-900">
            <KeyboardAvoidingView 
                className="flex-1"
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                {/* Header */}
                <View className="flex-row items-center py-4 px-6">
                    <TouchableOpacity 
                        onPress={() => router.back()}
                        className="w-10 h-10 bg-gray-800 rounded-full items-center justify-center mr-4"
                    >
                        <Feather name="arrow-left" size={20} color="#fff" />
                    </TouchableOpacity>
                    <Text className="text-xl font-JakartaBold text-white">Verify Pickup OTP</Text>
                </View>

                {/* Scrollable Content */}
                <ScrollView 
                    className="flex-1 px-6"
                    contentContainerStyle={{ paddingBottom: 20 }}
                    showsVerticalScrollIndicator={false}
                >
                    <View className="items-center pt-12">
                        {/* Icon */}
                        <View className="w-24 h-24 bg-green-500/20 rounded-full items-center justify-center mb-8">
                            <Feather name="key" size={48} color="#22c55e" />
                        </View>

                        {/* Instructions */}
                        <Text className="text-2xl font-JakartaBold text-white text-center mb-2">
                            Enter Pickup OTP
                        </Text>
                        <Text className="text-gray-400 text-center mb-8 px-4">
                            Ask the customer for the 4-digit OTP to verify pickup and start the trip
                        </Text>

                        {/* Customer Info */}
                        {booking?.customer && (
                            <View className="bg-gray-800 rounded-xl p-4 w-full mb-8">
                                <View className="flex-row items-center">
                                    <View className="w-12 h-12 bg-gray-700 rounded-full items-center justify-center mr-3">
                                        <Feather name="user" size={24} color="#9ca3af" />
                                    </View>
                                    <View>
                                        <Text className="text-white font-JakartaBold">
                                            {booking.customer.name}
                                        </Text>
                                        <Text className="text-gray-400 text-sm">
                                            Ask for OTP to start trip
                                        </Text>
                                    </View>
                                </View>
                            </View>
                        )}

                        <View className="flex-row justify-center gap-4 mb-6">
                            {otp.map((digit, index) => (
                                <TextInput
                                    key={index}
                                    ref={inputRefs[index]}
                                    value={digit}
                                    onChangeText={(value) => handleOtpChange(value, index)}
                                    onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, index)}
                                    className={`w-16 h-16 bg-white rounded-xl text-center text-2xl font-JakartaBold border-2 ${
                                        error ? 'border-red-500' : digit ? 'border-green-500' : 'border-gray-200'
                                    }`}
                                    style={{ color: '#000000' }}
                                    keyboardType="number-pad"
                                    maxLength={1}
                                    selectTextOnFocus
                                />
                            ))}
                        </View>

                        {/* Error Message */}
                        {error && (
                            <View className="flex-row items-center mb-4">
                                <Feather name="alert-circle" size={16} color="#ef4444" />
                                <Text className="text-red-500 ml-2 font-JakartaMedium">{error}</Text>
                            </View>
                        )}

                        {/* Verify Button */}
                        <TouchableOpacity
                            onPress={handleVerify}
                            disabled={isVerifying || otp.join('').length !== 4}
                            className={`w-full py-4 rounded-xl flex-row items-center justify-center ${
                                otp.join('').length === 4 ? 'bg-green-500' : 'bg-gray-700'
                            }`}
                        >
                            {isVerifying ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <>
                                    <Feather name="check-circle" size={20} color="#fff" />
                                    <Text className="ml-2 text-white font-JakartaBold text-lg">
                                        Verify & Start Trip
                                    </Text>
                                </>
                            )}
                        </TouchableOpacity>

                        {/* Footer Info */}
                        <View className="bg-yellow-500/10 rounded-xl p-4 mt-6 w-full">
                            <View className="flex-row items-start">
                                <Feather name="info" size={18} color="#eab308" />
                                <Text className="ml-2 text-yellow-500 font-JakartaMedium flex-1">
                                    The customer has received an OTP via the app. Please ask them to share it to verify pickup.
                                </Text>
                            </View>
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

export default VerifyOTP;
