// OTP Verification Screen for Drop-off
// Driver enters 6-digit delivery OTP from receiver/customer to complete the trip

import { View, Text, TouchableOpacity, Alert, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { useState, useRef, useEffect } from 'react';
import { Feather } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { getBookingById, subscribeToBooking } from '@/lib/bookings';
import type { Booking } from '@/lib/bookings';
import OtpCodeField, { type OtpCodeFieldHandle } from '@/components/OtpCodeField';

const VerifyDropOtp = () => {
    const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
    const [otp, setOtp] = useState('');
    const [booking, setBooking] = useState<Booking | null>(null);
    const [isVerifying, setIsVerifying] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isRetryingSms, setIsRetryingSms] = useState(false);
    const otpInputRef = useRef<OtpCodeFieldHandle>(null);

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

                // IMPORTANT: Generate OTP if not present when arriving at drop-off
                if (!data.delivery_otp) {
                    console.log('Generating Delivery OTP at drop-off...');
                    const { data: rpcData, error: rpcError } = await supabase.rpc('initiate_delivery_otp', {
                        p_booking_id: bookingId
                    });

                    if (rpcError) {
                        console.error('Failed to generate OTP:', rpcError);
                        Alert.alert('Error', 'Failed to generate delivery OTP');
                    } else {
                        console.log('OTP Generated and SMS queued automatically:', rpcData);
                        
                        // Notify driver playfully that SMS has been sent to receiver
                        if (data.receiver_phone && rpcData?.otp) {
                            Alert.alert(
                                '✅ OTP Sent via SMS',
                                `A 6-digit OTP has been sent via SMS to the receiver's phone (+91 ${data.receiver_phone}). The sender can also see it in their app. Ask for the OTP to complete delivery!`,
                                [{ text: 'Got it!' }]
                            );
                        }

                        // Refresh booking to get the new OTP into state
                        const { data: refreshed } = await getBookingById(bookingId);
                        if (refreshed) setBooking(refreshed);
                    }
                }
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

    // Verify OTP
    const handleVerify = async () => {
        const enteredOtp = otp;
        
        if (enteredOtp.length !== 6) {
            setError('Please enter complete 6-digit OTP');
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
            if (enteredOtp !== booking.delivery_otp) {
                setError('Incorrect OTP. Please try again.');
                setOtp('');
                otpInputRef.current?.focus();
                setIsVerifying(false);
                return;
            }

            // OTP is correct - mark delivery as confirmed and navigate to payment
            const { error: updateError } = await supabase
                .from('bookings')
                .update({
                    delivery_confirmed_at: new Date().toISOString(),
                })
                .eq('id', bookingId);

            if (updateError) {
                throw updateError;
            }

            // Navigate to payment collection screen
            router.replace({
                pathname: '/ride/collect-payment',
                params: { bookingId },
            });

        } catch (err: any) {
            console.error('OTP verification failed:', err);
            setError(err.message || 'Verification failed. Please try again.');
            setIsVerifying(false);
        }
    };

    // Resend/Regenerate OTP
    const handleResendOtp = async () => {
        if (!booking || !bookingId || isRetryingSms) return;

        Alert.alert(
            'Resend OTP?',
            'This will create a NEW OTP and send a NEW Notification to the receiver. The old OTP will become invalid.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Resend',
                    style: 'destructive',
                    onPress: async () => {
                        setIsRetryingSms(true);
                        try {
                            const { data: rpcData, error: rpcError } = await supabase.rpc('initiate_delivery_otp', {
                                p_booking_id: bookingId,
                                p_force_regenerate: true
                            });

                            if (rpcError) throw rpcError;

                            Alert.alert('New OTP Sent', `A new 6-digit OTP has been sent via SMS to the receiver's phone. The sender's app also shows the updated OTP.`);
                            const { data: refreshed } = await getBookingById(bookingId);
                            if (refreshed) setBooking(refreshed);
                            setOtp('');
                            setError(null);
                        } catch (err: any) {
                            Alert.alert('Error', 'Failed to resend OTP: ' + err.message);
                        } finally {
                            setIsRetryingSms(false);
                        }
                    }
                }
            ]
        );
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
                    title: 'Verify Delivery OTP',
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
                            Enter Delivery OTP
                        </Text>
                        <Text className="text-gray-500 text-center mb-8 px-4">
                            Ask the receiver or customer for the 6-digit OTP to verify delivery and proceed to payment
                        </Text>

                        {/* Customer Info */}
                        {booking && (booking.receiver_name || booking.receiver_phone) && (
                            <View className="bg-gray-100 rounded-xl p-4 w-full mb-8 border border-gray-200">
                                <View className="flex-row items-center">
                                    <View className="w-12 h-12 bg-gray-200 rounded-full items-center justify-center mr-3">
                                        <Feather name="user" size={24} color="#6b7280" />
                                    </View>
                                    <View>
                                        <Text className="text-gray-900 font-JakartaBold">
                                            {booking.receiver_name || 'Receiver'}
                                        </Text>
                                        <Text className="text-gray-500 text-sm">
                                            Ask for OTP to complete delivery
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
                                length={6}
                                error={!!error}
                                autoFocus
                                boxWidth={45}
                                boxHeight={45}
                                fontSize={18}
                                gap={8}
                                testID="drop-otp-field"
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
                            disabled={isVerifying || otp.length !== 6}
                            className={`w-full py-4 rounded-xl flex-row items-center justify-center ${
                                otp.length === 6 ? 'bg-green-500' : 'bg-gray-200'
                            }`}
                        >
                            {isVerifying ? (
                                <ActivityIndicator size="small" color={otp.length === 6 ? '#fff' : '#6b7280'} />
                            ) : (
                                <>
                                    <Feather name="check-circle" size={20} color={otp.length === 6 ? '#fff' : '#6b7280'} />
                                    <Text className="ml-2 text-gray-900 font-JakartaBold text-lg">
                                        Verify & Complete Delivery
                                    </Text>
                                </>
                            )}
                        </TouchableOpacity>

                        {/* Resend Action */}
                        <TouchableOpacity 
                            onPress={handleResendOtp}
                            disabled={isRetryingSms}
                            className={`mt-6 py-4 px-6 rounded-xl flex-row items-center justify-center w-full bg-gray-100 ${isRetryingSms ? 'opacity-50' : 'active:bg-gray-200'}`}
                        >
                            <Feather name="refresh-cw" size={18} color="#4b5563" />
                            <Text className="ml-2 font-JakartaBold text-gray-700">
                                {isRetryingSms ? 'Sending...' : 'Resend OTP'}
                            </Text>
                        </TouchableOpacity>

                        {/* Footer Info */}
                        <View className="bg-yellow-500/10 rounded-xl p-4 mt-6 w-full border border-yellow-200">
                            <View className="flex-row items-start">
                                <Feather name="info" size={18} color="#ca8a04" />
                                <Text className="ml-2 text-yellow-700 font-JakartaMedium flex-1">
                                    The receiver has been sent a 6-digit OTP via SMS. The sender (customer) can also see it in their app. Ask either of them for the OTP to verify successful delivery.
                                </Text>
                            </View>
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

export default VerifyDropOtp;
