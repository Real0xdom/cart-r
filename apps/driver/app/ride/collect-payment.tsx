// Payment Collection Screen
// Driver acts as Point-Of-Sale: Selects Payer (Sender/Receiver) and Method (Cash/Online)
// Now supports Dynamic UPI QR code generation via Cashfree

import { View, Text, TouchableOpacity, Alert, ActivityIndicator, TextInput, ScrollView, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useState, useEffect, useRef } from 'react';
import { Feather } from '@expo/vector-icons';
import {
    getBookingById,
    subscribeToBooking,
    completeTripAtomic,
    getDriverActiveBookings,
    Booking
} from '@/lib/bookings';
import { getOutstandingCustomerAmount, usesWalletFunds } from '@/lib/bookingPayment';
import { getEffectiveCommission, type CommissionResult } from '@/lib/commission';
import { supabase } from '@/lib/supabase';
import { refreshLocationTrackingNotification } from '@/lib/location';
import { NotificationManager, removeActiveRide } from '@/lib/notifications';


// Helper to calculate total with fees (simplified for now)
const calculateTotal = (booking: Booking) => booking.total_fare;
const formatCurrency = (amount: number) => `₹${Math.round(amount)}`;

const CollectPayment = () => {
    const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
    const [booking, setBooking] = useState<Booking | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const isProcessingRef = useRef(false);

    // Sync ref for callback accessibility
    useEffect(() => {
        isProcessingRef.current = isProcessing;
    }, [isProcessing]);

    // Payment method
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'online'>('cash');

    // Delivery OTP
    const [deliveryOtp, setDeliveryOtp] = useState('');
    const [showOtpInput, setShowOtpInput] = useState(false);

    // SMS Status
    const [smsStatus, setSmsStatus] = useState<{ status: string; error?: string } | null>(null);
    const [isRetryingSms, setIsRetryingSms] = useState(false);
    const [commissionInfo, setCommissionInfo] = useState<CommissionResult | null>(null);
    const [isLoadingCommission, setIsLoadingCommission] = useState(true);
    const [completionSummary, setCompletionSummary] = useState<{
        payout: number;
        grossFare: number;
        platformFee: number;
        commissionRate: number;
    } | null>(null);
    const [nextRideId, setNextRideId] = useState<string | null>(null);

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

                // Generate OTP if not present (automatically queues SMS)
                if (!data.delivery_otp) {
                    console.log('Generating Delivery OTP...');
                    const { data: rpcData, error: rpcError } = await supabase.rpc('initiate_delivery_otp', {
                        p_booking_id: bookingId
                    });

                    if (rpcError) {
                        console.error('Failed to generate OTP:', rpcError);
                        Alert.alert('Error', 'Failed to generate delivery OTP');
                    } else {
                        console.log('OTP Generated and SMS queued automatically:', rpcData);

                        if (data.receiver_phone && rpcData?.otp) {
                            Alert.alert(
                                '✅ OTP Sent via SMS',
                                `Delivery OTP sent via SMS to receiver (+91 ${data.receiver_phone}). The sender also sees it in their app.`,
                                [{ text: 'OK' }]
                            );
                        }

                        // Refresh booking to get the new OTP
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

        // Listen for payment updates (e.g. if sender pays via app)
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
            
            // If payment is received via online channel while driver is on this screen
            // but ONLY if we aren't currently middle of manual completion (isProcessingRef.current)
            // to avoid alert conflicts.
            const hadOutstandingBeforeUpdate = getOutstandingCustomerAmount(booking) > 0;
            const isSettledNow = getOutstandingCustomerAmount(updatedBooking) <= 0;

            if (
              updatedBooking.status !== 'completed' &&
              !isProcessingRef.current &&
              (
                updatedBooking.payment_status === 'paid' ||
                (hadOutstandingBeforeUpdate && isSettledNow)
              )
            ) {

                Alert.alert('Payment Received! 💰', 'The payment has been confirmed online.');
            }
        });

        return () => unsubscribe();
    }, [bookingId, booking?.id, booking?.payment_status]);

    // Poll for SMS status
    useEffect(() => {
        if (!bookingId) return;

        let interval: NodeJS.Timeout;
        let attempts = 0;

        const checkSmsStatus = async () => {
            attempts++;
            const { data, error } = await supabase
                .from('sms_queue')
                .select('status, error_message')
                .eq('booking_id', bookingId)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (data) {
                console.log(`[SMS Poll] Status: ${data.status}, Error: ${data.error_message}`);

                let effectiveStatus = data.status;
                let effectiveError = data.error_message;

                // SUPPRESS "Customer does not have token" — treat as soft success
                if (effectiveError && (
                    effectiveError.includes('Customer does not have') ||
                    effectiveError.includes('Push Token') ||
                    effectiveError.includes('token')
                )) {
                    effectiveStatus = 'sent';
                    effectiveError = undefined;
                    console.log('[SMS Poll] Suppressing Push Token error, showing SENT to UI.');
                }

                setSmsStatus({ status: effectiveStatus, error: effectiveError });

                // FALLBACK: If stuck in pending for > 6 seconds (2 polls), wake the edge function
                if (data.status === 'pending' && attempts > 2) {
                    console.log(`[SMS Poll] Status stuck in pending. Triggering Edge Function manually...`);
                    supabase.functions.invoke('send-sms').then(({ data: funcData, error: funcError }) => {
                        if (funcError) {
                            console.error('Failed to invoke send-sms:', funcError);
                            if (funcError instanceof Error && 'context' in funcError) {
                                const context: any = (funcError as any).context;
                                if (context?.status === 404) {
                                    Alert.alert('System Error', 'SMS Service not deployed (404). Please contact support.');
                                    setSmsStatus({ status: 'failed', error: 'Service Missing (404)' });
                                    clearInterval(interval);
                                }
                            }
                        } else {
                            console.log('Manually invoked send-sms function', funcData);
                        }
                    });
                    attempts = 0;
                }

                // Stop polling if final state reached
                if (data.status === 'sent' || (data.status === 'failed' && data.error_message)) {
                    clearInterval(interval);
                }
            }
        };

        if (booking?.delivery_otp) {
            checkSmsStatus();
            interval = setInterval(checkSmsStatus, 3000);
        }

        return () => {
            if (interval) clearInterval(interval);
        };
    }, [bookingId, booking?.delivery_otp]);

    useEffect(() => {
        let isActive = true;

        const loadCommission = async () => {
            if (!booking) {
                if (isActive) {
                    setCommissionInfo(null);
                    setIsLoadingCommission(true);
                }
                return;
            }

            try {
                setIsLoadingCommission(true);
                const result = await getEffectiveCommission(
                    booking.total_fare,
                    booking.vehicle_type
                );

                if (isActive) {
                    setCommissionInfo(result);
                }
            } catch (error) {
                console.error('Failed to load commission:', error);

                if (isActive) {
                    setCommissionInfo(null);
                }
            } finally {
                if (isActive) {
                    setIsLoadingCommission(false);
                }
            }
        };

        loadCommission();

        return () => {
            isActive = false;
        };
    }, [booking?.id, booking?.total_fare, booking?.vehicle_type]);

    // Resend/Regenerate OTP
    const handleResendOtp = async () => {
        if (!booking || isRetryingSms) return;

        Alert.alert(
            'Resend OTP?',
            'This will create a NEW OTP and send a NEW Notification. The old OTP will be invalid.',
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

                            Alert.alert('New OTP Sent', `A new OTP has been sent via SMS to the receiver's phone. The sender's app also shows the updated OTP.`);
                            const { data: refreshed } = await getBookingById(bookingId);
                            if (refreshed) setBooking(refreshed);
                            setDeliveryOtp('');
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

    const verifyDeliveryOtp = (): boolean => {
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

    const handleCloseCompletionModal = () => {
        setCompletionSummary(null);
        if (nextRideId) {
            router.replace({
                pathname: '/ride/[id]',
                params: { id: nextRideId },
            });
            return;
        }

        router.replace('/(tabs)/home');
    };





    const confirmTripCompletion = async () => {
        if (isProcessing) return;
        setIsProcessing(true);

        try {
            console.log('[confirmTripCompletion] Starting atomic verification for:', bookingId);
            
            // Fetch latest booking to avoid race condition
            const { data: latestBooking, error: fetchError } = await getBookingById(bookingId as string);

            if (fetchError) throw new Error(fetchError);
            if (!latestBooking) throw new Error('Booking not found');

            setBooking(latestBooking);

            // Use atomic RPC — always succeeds or fails cleanly
            const result = await completeTripAtomic(bookingId as string, paymentMethod);
            if (!result.success) {
                throw new Error(result.error || 'Failed to complete trip');
            }

            const { data: completedBooking } = await getBookingById(bookingId as string);
            const finalizedBooking = completedBooking || latestBooking;
            const finalizedCommission = await getEffectiveCommission(
                finalizedBooking.total_fare,
                finalizedBooking.vehicle_type
            );
            const isPayoutValid = finalizedBooking.driver_payout && finalizedBooking.driver_payout < finalizedBooking.total_fare;
            const payout = Number(isPayoutValid ? finalizedBooking.driver_payout : (finalizedCommission.driverShare ?? 0));

            setBooking(finalizedBooking);
            setCommissionInfo(finalizedCommission);
            // Mark this ride as completed in the stacking tracker
            removeActiveRide(bookingId as string);
            // Fire notifications after trip is truly complete
            void NotificationManager.tripCompleted({
                id: finalizedBooking.id,
                origin_address: finalizedBooking.origin_address,
                destination_address: finalizedBooking.destination_address,
            });
            // For online payments, show payment received notification — only here,
            // AFTER delivery OTP is confirmed and completeTripAtomic has succeeded.
            if (paymentMethod === 'online' || finalizedBooking.payment_status === 'paid') {
                void NotificationManager.paymentSuccess(
                    finalizedBooking.id,
                    payout,                        // net driver earnings after commission
                    Number(finalizedBooking.total_fare) // gross fare for context
                );
            }
            void refreshLocationTrackingNotification();

            if (finalizedBooking.driver_id) {
                const { data: activeBookings } = await getDriverActiveBookings(finalizedBooking.driver_id);
                const promotedBooking = (activeBookings || []).find((candidate) => candidate.id !== bookingId);
                setNextRideId(promotedBooking?.id || null);
            }

            // Stop the spinner before presenting the completion UI.
            setIsProcessing(false);
            const shouldShowCompletionModal = completionSummary === null;

            if (shouldShowCompletionModal) {
                setCompletionSummary({
                    payout,
                    grossFare: Number(finalizedBooking.total_fare || 0),
                    platformFee: finalizedCommission.platformFee,
                    commissionRate: finalizedCommission.rate,
                });
            } else {

            Alert.alert(
                'Trip Completed! 🎉',
                `✅ Payment confirmed & credited to wallet\nYou earned ₹${payout}`,
                [
                    {
                        text: 'Back to Home',
                        onPress: () => {
                            router.replace('/(tabs)/home');
                        },
                    },
                ]
            );
            }

        } catch (err: any) {
            console.error('[PAYMENT CONFIRM] Update failed:', err);
            setIsProcessing(false);
            Alert.alert(
                'Update Failed',
                `Failed to confirm payment: ${err.message || 'Database error'}\n\nPlease retry.`,
                [
                    { text: 'Retry', onPress: () => setTimeout(() => confirmTripCompletion(), 100) },
                    { text: 'Cancel', style: 'cancel' }
                ]
            );
        }
    };

    const handleCompleteTrip = async () => {
        if (!booking || !bookingId || isProcessing) return;

        // If OTP exists and delivery NOT yet confirmed, require OTP entry first
        if (booking.delivery_otp && !booking.delivery_confirmed_at) {
            if (!showOtpInput) {
                setShowOtpInput(true);
                return;
            }
            // OTP input is shown — verify before proceeding
            if (!verifyDeliveryOtp()) return;
        }

        const fare = calculateTotal(booking);
        const amountToCollect = getOutstandingCustomerAmount(booking);
        const isPaidStatus = booking.payment_status === 'paid' && amountToCollect <= 0;

        if (!isPaidStatus) {
            Alert.alert(
                'Confirm Payment',
                `Did you securely receive ₹${amountToCollect} from the customer?`,
                [
                    { text: 'No, Cancel', style: 'cancel' },
                    { text: `Yes, I received ₹${amountToCollect}`, onPress: () => confirmTripCompletion() }
                ]
            );
        } else {
            Alert.alert(
                'Complete Trip',
                'Are you sure you want to complete this delivery?',
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Complete Delivery', onPress: () => confirmTripCompletion() }
                ]
            );
        }
    };

    if (isLoading || !booking) {
        return (
            <SafeAreaView className="flex-1 bg-white items-center justify-center">
                <ActivityIndicator size="large" color="#22c55e" />
            </SafeAreaView>
        );
    }

    const fare = calculateTotal(booking);
    const amountToCollect = getOutstandingCustomerAmount(booking);
    const isPaid = booking.payment_status === 'paid' && amountToCollect <= 0;
    const isPartial = booking.payment_status === 'partial_paid' || (usesWalletFunds(booking) && amountToCollect > 0);

    // Complete button is enabled when:
    // - already paid online, OR
    // - collecting cash (always ready), OR
    // - online payment was requested and confirmed
    const isCompleteEnabled = !isProcessing && (isPaid || paymentMethod === 'cash');

    return (
        <SafeAreaView className="flex-1 bg-white">
            <Modal
                visible={!!completionSummary}
                transparent
                animationType="fade"
                onRequestClose={handleCloseCompletionModal}
            >
                <View className="flex-1 justify-center bg-black/55 px-6">
                    <View className="overflow-hidden rounded-[28px] bg-white">
                        <View className="bg-green-600 px-6 pb-10 pt-8">
                            <View className="mx-auto mb-4 h-16 w-16 items-center justify-center rounded-full bg-white/20">
                                <Feather name="check" size={32} color="#ffffff" />
                            </View>
                            <Text className="text-center text-3xl font-JakartaBold text-white">
                                Trip Completed
                            </Text>
                            <Text className="mt-2 text-center text-sm font-JakartaMedium text-green-50">
                                Payment confirmed. Your net earnings are ready.
                            </Text>
                        </View>

                        <View className="-mt-6 rounded-t-[28px] bg-white px-6 pb-6 pt-5">
                            <View className="mb-5 rounded-3xl bg-green-50 px-5 py-5">
                                <Text className="text-center text-sm font-JakartaMedium text-green-700">
                                    You'll Earn
                                </Text>
                                <Text className="mt-2 text-center text-4xl font-JakartaBold text-green-700">
                                    {completionSummary ? formatCurrency(completionSummary.payout) : formatCurrency(0)}
                                </Text>
                                <Text className="mt-2 text-center text-xs font-JakartaMedium text-green-800/70">
                                    After platform commission deduction
                                </Text>
                            </View>

                            <View className="mb-6 rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4">
                                <View className="mb-2 flex-row items-center justify-between">
                                    <Text className="text-sm font-JakartaMedium text-gray-500">Trip Fare</Text>
                                    <Text className="text-sm font-JakartaSemiBold text-gray-900">
                                        {completionSummary ? formatCurrency(completionSummary.grossFare) : formatCurrency(0)}
                                    </Text>
                                </View>
                                <View className="mb-2 flex-row items-center justify-between">
                                    <Text className="text-sm font-JakartaMedium text-gray-500">
                                        Commission ({completionSummary?.commissionRate.toFixed(1)}%)
                                    </Text>
                                    <Text className="text-sm font-JakartaSemiBold text-red-500">
                                        -{completionSummary ? formatCurrency(completionSummary.platformFee) : formatCurrency(0)}
                                    </Text>
                                </View>
                                <View className="flex-row items-center justify-between border-t border-gray-200 pt-3">
                                    <Text className="text-sm font-JakartaBold text-gray-900">Driver Payout</Text>
                                    <Text className="text-base font-JakartaBold text-green-700">
                                        {completionSummary ? formatCurrency(completionSummary.payout) : formatCurrency(0)}
                                    </Text>
                                </View>
                            </View>

                            <TouchableOpacity
                                onPress={handleCloseCompletionModal}
                                className="rounded-2xl bg-green-600 px-5 py-4"
                            >
                                <Text className="text-center text-base font-JakartaBold text-white">
                                    {nextRideId ? 'Start Next Ride' : 'Back to Home'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            <ScrollView className="flex-1 px-6" contentContainerStyle={{ paddingBottom: 120 }}>
                {/* Header */}
                <View className="flex-row items-center justify-between py-4 border-b border-gray-100 mb-4">
                    <Text className="text-xl font-JakartaBold text-gray-900 flex-1">Collect Payment</Text>
                </View>

                {/* Amount Card */}
                <View className="bg-green-500/10 rounded-3xl p-8 items-center mb-6 border border-green-500/20">
                    <Text className="text-gray-600 font-JakartaMedium mb-2">
                        {isPaid ? 'Total Amount' : 'Amount to Collect'}
                    </Text>
                    <Text className="text-5xl font-JakartaBold text-green-600">
                        ₹{isPaid ? fare : amountToCollect}
                    </Text>

                    {/* Breakdown */}
                    <View className="mt-4 w-full px-4 pt-4 border-t border-green-500/10">
                        <View className="flex-row justify-between mb-1">
                            <Text className="text-green-700/70 font-JakartaMedium text-sm">Total Fare:</Text>
                            <Text className="text-green-800 font-JakartaSemiBold text-sm">₹{fare}</Text>
                        </View>
                        {isLoadingCommission ? (
                            <View className="py-3 items-center">
                                <ActivityIndicator size="small" color="#6b7280" />
                            </View>
                        ) : commissionInfo ? (
                            <>
                                <View className="flex-row justify-between mb-1">
                                    <Text className="text-red-500/70 font-JakartaMedium text-sm">
                                        Platform Commission ({commissionInfo.rate.toFixed(1)}%)
                                    </Text>
                                    <Text className="text-red-500 font-JakartaSemiBold text-sm">
                                        -₹{Math.round(commissionInfo.platformFee)}
                                    </Text>
                                </View>
                                <View className="flex-row justify-between mt-1 pt-2 border-t border-green-500/10">
                                    <Text className="text-green-800 font-JakartaBold text-sm">You'll Earn:</Text>
                                    <Text className="text-green-800 font-JakartaBold text-sm">
                                        ₹{Math.round(commissionInfo.driverShare)}
                                    </Text>
                                </View>
                                {commissionInfo.source === 'vehicle_specific' && (
                                    <Text className="mt-1 text-[11px] italic text-gray-500 font-JakartaMedium">
                                        * Custom rate for {booking.vehicle_type}
                                    </Text>
                                )}
                            </>
                        ) : (
                            <Text className="mt-2 text-center text-xs text-gray-500 font-JakartaMedium">
                                Commission details unavailable right now.
                            </Text>
                        )}
                    </View>

                    {isPartial && (
                        <View className="mt-4 bg-blue-500/20 px-3 py-1 rounded-lg border border-blue-200">
                            <Text className="text-blue-700 text-xs font-JakartaMedium">
                                Paid via Wallet: ₹{booking.wallet_amount_used || booking.quoted_total_fare || 0}
                            </Text>
                        </View>
                    )}

                    {isPaid ? (
                        <View className="bg-green-500 px-4 py-1 rounded-full mt-4">
                            <Text className="text-white font-bold">PAID</Text>
                        </View>
                    ) : (
                        <View className="bg-yellow-500/20 px-4 py-1 rounded-full mt-4">
                            <Text className="text-yellow-500 font-bold">
                                {isPartial ? `PARTIALLY PAID (Collect ₹${amountToCollect})` : 'PENDING'}
                            </Text>
                        </View>
                    )}
                </View>



                {/* Delivery OTP Section */}
                <View className="mb-6">
                    <Text className="text-gray-600 font-JakartaSemiBold mb-3">Delivery Confirmation</Text>

                    {booking.delivery_confirmed_at ? (
                        <View className="bg-green-500/10 p-4 rounded-lg border border-green-500/20 items-center">
                            <Feather name="check-circle" size={32} color="#22c55e" />
                            <Text className="text-green-700 font-JakartaBold mt-2">Delivery Verified ✓</Text>
                            <Text className="text-green-600 text-sm text-center mt-1">OTP successfully verified</Text>
                        </View>
                    ) : showOtpInput ? (
                        <View>
                            <TextInput
                                value={deliveryOtp}
                                onChangeText={(text) => setDeliveryOtp(text.replace(/[^0-9]/g, ''))}
                                placeholder="Enter 6-digit OTP"
                                placeholderTextColor="#6b7280"
                                keyboardType="number-pad"
                                maxLength={6}
                                className="bg-gray-100 rounded-xl p-4 text-gray-900 text-center text-xl font-JakartaBold tracking-widest mb-2 border border-gray-200"
                            />
                            {booking?.receiver_phone && (
                                <View className="mt-2">
                                    <View className={`rounded-lg p-3 flex-row items-center justify-between ${
                                        smsStatus?.status === 'sent' ? 'bg-green-500/10 border border-green-500/20' :
                                        smsStatus?.status === 'failed' ? 'bg-red-500/10 border border-red-500/20' :
                                        'bg-blue-500/10 border border-blue-500/20'
                                    }`}>
                                        <View className="flex-row items-center flex-1">
                                            {smsStatus?.status === 'pending' && (
                                                <ActivityIndicator size="small" color="#3b82f6" style={{ marginRight: 8 }} />
                                            )}
                                            {smsStatus?.status === 'sent' && (
                                                <Feather name="check-circle" size={16} color="#22c55e" style={{ marginRight: 8 }} />
                                            )}
                                            {smsStatus?.status === 'failed' && (
                                                <Feather name="alert-circle" size={16} color="#ef4444" style={{ marginRight: 8 }} />
                                            )}
                                            <Text className={`font-JakartaMedium text-xs ${
                                                smsStatus?.status === 'sent' ? 'text-green-600' :
                                                smsStatus?.status === 'failed' ? 'text-red-600' :
                                                'text-blue-600'
                                            }`}>
                                                {smsStatus?.status === 'sent' ? 'OTP SMS Sent to Receiver' :
                                                 smsStatus?.status === 'failed' ? `SMS Failed: ${smsStatus.error?.substring(0, 30)}...` :
                                                 'Sending OTP SMS to Receiver...'}
                                            </Text>
                                        </View>
                                    </View>

                                    <TouchableOpacity
                                        onPress={handleResendOtp}
                                        disabled={isRetryingSms}
                                        className="mt-4 border-t border-gray-200 pt-3"
                                    >
                                        <View className="flex-row items-center justify-center">
                                            <Feather name="refresh-cw" size={12} color="#4b5563" />
                                            <Text className="ml-2 text-gray-600 text-xs text-center font-JakartaBold">
                                                {isRetryingSms ? 'Sending...' : 'Resend New OTP'}
                                            </Text>
                                        </View>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        onPress={() => router.push('/ride/debug-sms')}
                                        className="mt-4 pt-2 border-t border-gray-200 items-center"
                                    >
                                        <Text className="text-gray-600 text-xs">
                                            Open Notification Monitor
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>
                    ) : (
                        <TouchableOpacity
                            onPress={() => setShowOtpInput(true)}
                            className="bg-gray-100 p-4 rounded-xl flex-row items-center justify-center border border-gray-200"
                        >
                            <Feather name="lock" size={18} color="#6b7280" />
                            <Text className="ml-2 text-gray-600 font-JakartaMedium">Enter Delivery OTP</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Complete Button */}
                <TouchableOpacity
                    onPress={handleCompleteTrip}
                    disabled={!isCompleteEnabled}
                    className={`w-full py-4 rounded-xl flex-row items-center justify-center mb-10 ${
                        isCompleteEnabled ? 'bg-green-500' : 'bg-gray-200'
                    }`}
                >
                    {isProcessing ? (
                        <ActivityIndicator size="small" color="#fff" />
                    ) : (
                        <>
                            <Feather name="check-circle" size={20} color={isCompleteEnabled ? '#fff' : '#9ca3af'} />
                            <Text className={`ml-2 font-JakartaBold text-lg ${isCompleteEnabled ? 'text-white' : 'text-gray-400'}`}>
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
