// Payment Collection Screen
// Driver acts as Point-Of-Sale: Selects Payer (Sender/Receiver) and Method (Cash/Online)

import { View, Text, TouchableOpacity, Alert, ActivityIndicator, TextInput, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useState, useEffect } from 'react';
import { Feather } from '@expo/vector-icons';
import { getBookingById, updateBookingStatus, subscribeToBooking, Booking } from '@/lib/bookings';
import { supabase } from '@/lib/supabase';

// Helper to calculate total with fees (simplified for now)
const calculateTotal = (booking: Booking) => booking.driver_payout || booking.total_fare;

const CollectPayment = () => {
    const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
    const [booking, setBooking] = useState<Booking | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    
    // Who is paying?
    const [payer, setPayer] = useState<'sender' | 'receiver'>('receiver');
    
    // Payment method
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'online'>('cash');
    
    // Delivery OTP
    const [deliveryOtp, setDeliveryOtp] = useState('');
    const [showOtpInput, setShowOtpInput] = useState(false);
    
    // Payment request status
    const [paymentRequested, setPaymentRequested] = useState(false);

    // Fetch booking data & subscribe to updates
    useEffect(() => {
        if (!bookingId) {
            router.back();
            return;
        }

        const fetchBooking = async () => {
            const { data, error } = await getBookingById(bookingId);
            if (data) {
                setBooking(data);
                // If already paid, might want to show success or different view
            } else {
                Alert.alert('Error', 'Failed to load booking details');
                router.back();
            }
            setIsLoading(false);
        };

        fetchBooking();
        
        // Listen for payment updates (e.g. if sender pays via app)
        const unsubscribe = subscribeToBooking(bookingId, (updatedBooking) => {
            setBooking(updatedBooking);
            if (updatedBooking.payment_status === 'paid') {
                 Alert.alert('Payment Received! 💰', 'The payment has been confirmed online.');
            }
        });
        
        return () => unsubscribe();
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

    // Trigger push notification to sender
    const requestOnlinePayment = async () => {
        if (!booking || !booking.customer) return;
        
        setIsProcessing(true);
        try {
            // Send notification to customer
             const { error } = await supabase.rpc('send_notification_to_user', {
                p_user_id: booking.customer_id,
                p_title: 'Payment Requested',
                p_body: `Your driver requested payment of ₹${calculateTotal(booking)} for your booking.`,
                p_data: { 
                    booking_id: booking.id, 
                    type: 'payment_request',
                    amount: calculateTotal(booking)
                }
            });
            
            if (error) throw error;
            
            setPaymentRequested(true);
            Alert.alert('Request Sent', 'Notification sent to sender. Waiting for payment...');
            
        } catch (err: any) {
            Alert.alert('Error', 'Failed to send payment request.');
            console.error(err);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleCompleteTrip = async () => {
        if (!booking || !bookingId) return;

        // Verify OTP if required (and not already verified)
        if (booking.delivery_otp && !booking.delivery_confirmed_at) {
            if (!showOtpInput) {
                 setShowOtpInput(true);
                 return;
            }
            if (!verifyDeliveryOtp()) return;
        }

        setIsProcessing(true);

        try {
            const updatePayload: any = {
                status: 'completed',
                completed_at: new Date().toISOString(),
                delivery_confirmed_at: new Date().toISOString(),
            };
            
            // If paying cash now, update payment status
            if (booking.payment_status !== 'paid') {
                updatePayload.payment_status = 'paid';
                updatePayload.payment_method = paymentMethod; // 'cash' or 'online'
            }

            const { error } = await supabase
                .from('bookings')
                .update(updatePayload)
                .eq('id', bookingId);

            if (error) throw error;

            // Success
            Alert.alert(
                'Trip Completed! 🎉',
                `You earned ₹${booking.driver_payout || booking.total_fare}`,
                [
                    {
                        text: 'Back to Home',
                        onPress: () => router.replace('/(tabs)/home'),
                    },
                ]
            );

        } catch (err: any) {
            console.error('Failed to complete trip:', err);
            Alert.alert('Error', err.message || 'Failed to complete trip.');
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

    const fare = calculateTotal(booking);
    const isPaid = booking.payment_status === 'paid';

    return (
        <SafeAreaView className="flex-1 bg-gray-900">
            <ScrollView className="flex-1 px-6">
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

                {/* Amount Card */}
                <View className="bg-green-500/10 rounded-3xl p-8 items-center mb-6 border border-green-500/20">
                    <Text className="text-gray-400 font-JakartaMedium mb-2">Total Amount</Text>
                    <Text className="text-5xl font-JakartaBold text-green-400">₹{fare}</Text>
                    
                    {isPaid ? (
                         <View className="bg-green-500 px-4 py-1 rounded-full mt-4">
                             <Text className="text-white font-bold">PAID</Text>
                         </View>
                    ) : (
                        <View className="bg-yellow-500/20 px-4 py-1 rounded-full mt-4">
                             <Text className="text-yellow-500 font-bold">PENDING</Text>
                         </View>
                    )}
                </View>

                {/* Payment Selection (Only if not paid) */}
                {!isPaid && (
                <View className="mb-8">
                    <Text className="text-gray-400 font-JakartaSemiBold mb-4">Who is paying?</Text>
                    
                    {/* Receiver / Sender Toggle */}
                    <View className="flex-row bg-gray-800 p-1 rounded-xl mb-6">
                        <TouchableOpacity 
                            onPress={() => setPayer('receiver')}
                            className={`flex-1 py-3 rounded-lg items-center ${payer === 'receiver' ? 'bg-gray-700' : ''}`}
                        >
                            <Text className={`font-JakartaBold ${payer === 'receiver' ? 'text-white' : 'text-gray-500'}`}>Receiver</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                            onPress={() => setPayer('sender')}
                            className={`flex-1 py-3 rounded-lg items-center ${payer === 'sender' ? 'bg-gray-700' : ''}`}
                        >
                             <Text className={`font-JakartaBold ${payer === 'sender' ? 'text-white' : 'text-gray-500'}`}>Sender</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Method Selection based on Payer */}
                    {payer === 'receiver' ? (
                        <View>
                             <TouchableOpacity
                                onPress={() => setPaymentMethod('cash')}
                                className={`w-full p-4 rounded-xl flex-row items-center justify-center bg-green-600 mb-3`}
                            >
                                <Feather name="dollar-sign" size={20} color="#fff" />
                                <Text className="ml-2 font-JakartaBold text-white">
                                    Collect Cash from Receiver
                                </Text>
                            </TouchableOpacity>
                            <Text className="text-gray-500 text-center text-xs">
                                Confirm once you have received ₹{fare} cash or via your personal UPI QR.
                            </Text>
                        </View>
                    ) : (
                         <View className="gap-3">
                            <TouchableOpacity
                                onPress={requestOnlinePayment}
                                disabled={paymentRequested}
                                className={`w-full p-4 rounded-xl flex-row items-center justify-center ${paymentRequested ? 'bg-gray-700' : 'bg-blue-600'}`}
                            >
                                {isProcessing ? <ActivityIndicator color="#fff" /> : <Feather name="smartphone" size={20} color="#fff" />}
                                <Text className="ml-2 font-JakartaBold text-white">
                                    {paymentRequested ? 'Request Sent' : 'Request Payment from Sender'}
                                </Text>
                            </TouchableOpacity>
                            
                            <TouchableOpacity
                                onPress={() => setPaymentMethod('cash')}
                                className="w-full p-4 rounded-xl flex-row items-center justify-center bg-gray-800 border border-gray-700"
                            >
                                <Feather name="dollar-sign" size={20} color="#9ca3af" />
                                <Text className="ml-2 font-JakartaBold text-gray-400">
                                    Sender Paid Cash/Offline
                                </Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
                )}

                {/* Delivery OTP (Required to complete) */}
                <View className="mb-6">
                    <Text className="text-gray-400 font-JakartaSemiBold mb-3">Delivery Confirmation</Text>
                    {showOtpInput ? (
                        <TextInput
                            value={deliveryOtp}
                            onChangeText={(text) => setDeliveryOtp(text.replace(/[^0-9]/g, ''))}
                            placeholder="Enter 6-digit OTP"
                            placeholderTextColor="#6b7280"
                            keyboardType="number-pad"
                            maxLength={6}
                            className="bg-gray-800 rounded-xl p-4 text-white text-center text-xl font-JakartaBold tracking-widest"
                        />
                    ) : (
                        <TouchableOpacity
                            onPress={() => setShowOtpInput(true)}
                            className="bg-gray-800 p-4 rounded-xl flex-row items-center justify-center border border-gray-700"
                        >
                            <Feather name="lock" size={18} color="#9ca3af" />
                            <Text className="ml-2 text-gray-300 font-JakartaMedium">Enter Delivery OTP</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Complete Button */}
                <TouchableOpacity
                    onPress={handleCompleteTrip}
                    disabled={isProcessing || (!isPaid && paymentMethod === 'online' && !paymentRequested)} // Simplified logic
                    className={`w-full py-4 rounded-xl flex-row items-center justify-center mb-10 ${
                        (isPaid || payer === 'receiver' || paymentMethod === 'cash') ? 'bg-green-500' : 'bg-gray-700'
                    }`}
                >
                    {isProcessing ? (
                        <ActivityIndicator size="small" color="#fff" />
                    ) : (
                        <>
                            <Feather name="check-circle" size={20} color="#fff" />
                            <Text className="ml-2 text-white font-JakartaBold text-lg">
                                {isPaid ? 'Complete Trip' : 'Confirm Payment & Complete'}
                            </Text>
                        </>
                    )}
                </TouchableOpacity>

            </ScrollView>
        </SafeAreaView>
    );
};

export default CollectPayment;
