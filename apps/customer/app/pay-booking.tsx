import { View, Text, TouchableOpacity, Alert, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useState, useEffect } from 'react';
import { Feather } from '@expo/vector-icons';
import { getBookingById, Booking } from '@/lib/bookings';
import { initiateCashfreePayment, createPaymentOrder, PaymentResult } from '@/lib/payment';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { images } from "@/constants";

const PayBooking = () => {
    const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
    const { user, profile } = useAuth();
    const [booking, setBooking] = useState<Booking | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isPaying, setIsPaying] = useState(false);

    useEffect(() => {
        if (!bookingId) {
            router.back();
            return;
        }
        
        const fetchBooking = async () => {
            const { data } = await getBookingById(bookingId);
            if (data) {
                setBooking(data);
                // Redirect if already paid
                if (data.payment_status === 'paid') {
                    Alert.alert('Success', 'This booking is already paid.');
                    router.replace('/(tabs)/home');
                }
            } else {
                Alert.alert('Error', 'Booking not found');
                router.back();
            }
            setIsLoading(false);
        };
        fetchBooking();
    }, [bookingId]);

    const handlePayment = async () => {
        if (!booking || !user || !profile) return;
        setIsPaying(true);

        try {
            const amount = booking.driver_payout || booking.total_fare;
            
            // 1. Create Order
            const { data: orderData, error: orderError } = await createPaymentOrder(
                booking.id,
                user.id,
                profile.first_name + ' ' + profile.last_name,
                user.email || 'user@cartr.app',
                profile.phone_number || '9999999999',
                amount
            );

            if (orderError || !orderData) throw new Error(orderError || "Failed to create order");

            // 2. Initiate Payment (Web Flow for Expo Go / Native SDK for Prod)
            // Note: initiateCashfreePayment handles the environment switch
            const result = await initiateCashfreePayment(
                orderData.payment_session_id,
                orderData.order_id
            );

            if (result.success) {
                // In Web Flow/Deep Link, we might need manual confirmation or polling.
                // For now, let's assume valid return initiates success or we poll.
                // But for standard flow, we wait for webhook.
                // However, we can optimistically update or Poll.
                 Alert.alert(
                    'Use Browser to Pay',
                    'You will be redirected to Cashfree. After payment, come back here.',
                    [
                        { 
                            text: 'I have Paid', 
                            onPress: () => checkPaymentStatus() 
                        }
                    ]
                );
            } else {
                throw new Error(result.error);
            }

        } catch (err: any) {
            Alert.alert('Payment Failed', err.message);
        } finally {
            setIsPaying(false);
        }
    };
    
    // Quick check function (could be improved with real-time sub)
    const checkPaymentStatus = async () => {
        setIsLoading(true);
        const { data } = await supabase
            .from('bookings')
            .select('payment_status')
            .eq('id', booking!.id)
            .single();
            
        if (data?.payment_status === 'paid') {
            Alert.alert('Success', 'Payment Confirmed!', [
                { text: 'OK', onPress: () => router.replace('/(tabs)/home') }
            ]);
        } else {
            Alert.alert('Not Confirmed', 'Payment status is still pending. Please wait a moment and try again.');
        }
        setIsLoading(false);
    };

    if (isLoading || !booking) {
        return (
            <SafeAreaView className="flex-1 bg-white items-center justify-center">
                <ActivityIndicator size="large" color="#FF9800" />
            </SafeAreaView>
        );
    }

    const amount = booking.driver_payout || booking.total_fare;

    return (
        <SafeAreaView className="flex-1 bg-white">
            <View className="flex-1 px-5 pt-5">
                 {/* Header */}
                 <View className="flex-row items-center mb-6">
                    <TouchableOpacity 
                        onPress={() => router.back()}
                        className="w-10 h-10 bg-gray-100 rounded-full items-center justify-center mr-4"
                    >
                        <Feather name="x" size={24} color="black" />
                    </TouchableOpacity>
                    <Text className="text-2xl font-JakartaBold">Pay for Booking</Text>
                </View>
                
                <View className="items-center py-10">
                     <Image source={images.onboarding2} className="w-40 h-40 mb-5" resizeMode="contain" />
                     <Text className="text-gray-500 font-JakartaMedium mb-2">Request from Driver</Text>
                     <Text className="text-4xl font-JakartaBold text-primary-500">₹{amount}</Text>
                </View>
                
                <View className="bg-gray-50 p-5 rounded-2xl mb-8">
                    <View className="flex-row justify-between mb-3">
                        <Text className="text-gray-500">Booking ID</Text>
                        <Text className="font-JakartaBold">{booking.booking_number}</Text>
                    </View>
                     <View className="flex-row justify-between mb-3">
                        <Text className="text-gray-500">Distance</Text>
                        <Text className="font-JakartaBold">{(booking.estimated_distance / 1000).toFixed(1)} km</Text>
                    </View>
                    <View className="border-t border-gray-200 my-2" />
                    <View className="flex-row justify-between mt-2">
                        <Text className="font-JakartaBold text-lg">Total Pay</Text>
                        <Text className="font-JakartaBold text-lg">₹{amount}</Text>
                    </View>
                </View>
                
                <TouchableOpacity
                    onPress={handlePayment}
                    disabled={isPaying}
                    className="w-full bg-primary-500 py-4 rounded-full flex-row items-center justify-center shadow-md shadow-primary-300"
                >
                    {isPaying ? (
                         <ActivityIndicator color="white" />
                    ) : (
                        <>
                            <Text className="text-white font-JakartaBold text-lg mr-2">Pay Now</Text>
                            <Feather name="arrow-right" size={20} color="white" />
                        </>
                    )}
                </TouchableOpacity>
                
            </View>
        </SafeAreaView>
    );
};

export default PayBooking;
