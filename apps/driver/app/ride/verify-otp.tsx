// OTP Verification Screen
// Driver enters 4-digit pickup OTP from customer to start the trip

import { View, Text, TouchableOpacity, Alert, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { useState, useRef, useEffect } from 'react';
import { Feather } from '@expo/vector-icons';
import { getBookingById, subscribeToBooking, verifyPickupOTPAndStartTrip } from '@/lib/bookings';
import type { Booking } from '@/lib/bookings';
import OtpCodeField, { type OtpCodeFieldHandle } from '@/components/OtpCodeField';

const VerifyOTP = () => {
    const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
    const [otp, setOtp] = useState('');
    const [booking, setBooking] = useState<Booking | null>(null);
    const [isVerifying, setIsVerifying] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const cancellationHandledRef = useRef(false);
    const otpInputRef = useRef<OtpCodeFieldHandle>(null);

    // Fetch booking data
    useEffect(() => {
        if (!bookingId) {
            router.back();
            return;
        }

        const exitForCancellation = (cancelledBooking: Booking) => {
            if (cancellationHandledRef.current) return;
            cancellationHandledRef.current = true;
            setBooking(cancelledBooking);
            setIsVerifying(false);
            Alert.alert(
                'Ride Cancelled',
                `The customer has cancelled this ride.\nReason: ${cancelledBooking.cancellation_reason || 'No reason provided'}`,
                [{
                    text: 'OK',
                    onPress: () => router.replace('/(tabs)/home')
                }]
            );
        };

        const fetchBooking = async () => {
            const { data, error } = await getBookingById(bookingId);
            if (data) {
                if (data.status === 'cancelled') {
                    setIsLoading(false);
                    exitForCancellation(data);
                    return;
                }
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
            if (updatedBooking.status === 'cancelled') {
                exitForCancellation(updatedBooking);
                return;
            }
            setBooking(updatedBooking);
        });
        
        return () => unsubscribe();
    }, [bookingId]);

    // Verify OTP
    const handleVerify = async () => {
        const enteredOtp = otp;
        
        if (enteredOtp.length !== 4) {
            setError('Please enter complete 4-digit OTP');
            return;
        }

        if (!booking) {
            setError('Booking not found');
            return;
        }

        if (booking.status === 'cancelled') {
            setError('This ride was already cancelled by the customer.');
            return;
        }

        setIsVerifying(true);
        setError(null);

        try {
            // Check if OTP matches
            if (enteredOtp !== booking.pickup_otp) {
                setError('Incorrect OTP. Please try again.');
                setOtp('');
                otpInputRef.current?.focus();
                setIsVerifying(false);
                return;
            }

            // OTP is correct - start the trip only if the ride is still valid
            const { success, error: transitionError } = await verifyPickupOTPAndStartTrip(bookingId, enteredOtp);

            if (!success) {
                throw new Error(transitionError || 'Unable to start trip');
            }

            // Navigate to active ride screen
            router.replace({
                pathname: '/ride/[id]',
                params: { id: bookingId },
            });

        } catch (err: any) {
            console.error('OTP verification failed:', err);
            const message = err.message || 'Verification failed. Please try again.';
            setError(message);
            if (message.includes('cancelled') || message.includes('another state')) {
                Alert.alert('Ride Cancelled', message, [
                    { text: 'OK', onPress: () => router.replace('/(tabs)/home') }
                ]);
            }
            setIsVerifying(false);
        }
    };


    if (isLoading) {
        return (
            <SafeAreaView className="flex-1 bg-white items-center justify-center">
                <ActivityIndicator size="large" color="#22c55e" />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-white">
            <Stack.Screen
                options={{
                    headerShown: true,
                    title: 'Verify Pickup OTP',
                    headerBackVisible: true,
                }}
            />
            <KeyboardAvoidingView 
                className="flex-1"
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
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
                         <Text className="text-2xl font-JakartaBold text-gray-900 text-center mb-2">
                            Enter Pickup OTP
                        </Text>
                        <Text className="text-gray-500 text-center mb-8 px-4">
                            Ask the customer for the 4-digit OTP to verify pickup and start the trip
                        </Text>

                        {/* Customer Info */}
                        {booking?.customer && (
                            <View className="bg-gray-100 rounded-xl p-4 w-full mb-8 border border-gray-200">
                                <View className="flex-row items-center">
                                    <View className="w-12 h-12 bg-gray-200 rounded-full items-center justify-center mr-3">
                                        <Feather name="user" size={24} color="#6b7280" />
                                    </View>
                                    <View>
                                        <Text className="text-gray-900 font-JakartaBold">
                                            {booking.customer.name}
                                        </Text>
                                        <Text className="text-gray-500 text-sm">
                                            Ask for 4-digit OTP to start trip
                                        </Text>
                                    </View>
                                </View>
                            </View>
                        )}

                        <View className="mb-6 w-full">
                            <OtpCodeField
                                ref={otpInputRef}
                                value={otp}
                                onChange={(value) => {
                                    setOtp(value);
                                    if (error) {
                                        setError(null);
                                    }
                                }}
                                length={4}
                                error={!!error}
                                autoFocus
                                boxWidth={64}
                                boxHeight={64}
                                fontSize={24}
                                gap={16}
                                testID="pickup-otp-field"
                            />
                        </View>

                        {/* Error Message */}
                        {error && (
                            <View className="flex-row items-center mb-4">
                                <Feather name="alert-circle" size={16} color="#ef4444" />
                                <Text className="text-red-600 ml-2 font-JakartaMedium">{error}</Text>
                            </View>
                        )}

                        {/* Verify Button */}
                        <TouchableOpacity
                            onPress={handleVerify}
                            disabled={isVerifying || otp.length !== 4}
                            className={`w-full py-4 rounded-xl flex-row items-center justify-center ${
                                otp.length === 4 ? 'bg-green-500' : 'bg-gray-200'
                            }`}
                        >
                            {isVerifying ? (
                                <ActivityIndicator size="small" color={otp.length === 4 ? '#fff' : '#6b7280'} />
                            ) : (
                                <>
                                    <Feather name="check-circle" size={20} color={otp.length === 4 ? '#fff' : '#6b7280'} />
                                    <Text className="ml-2 text-gray-900 font-JakartaBold text-lg">
                                        Verify & Start Trip
                                    </Text>
                                </>
                            )}
                        </TouchableOpacity>

                        {/* Footer Info */}
                        <View className="bg-yellow-500/10 rounded-xl p-4 mt-6 w-full border border-yellow-200">
                            <View className="flex-row items-start">
                                <Feather name="info" size={18} color="#ca8a04" />
                                <Text className="ml-2 text-yellow-700 font-JakartaMedium flex-1">
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
