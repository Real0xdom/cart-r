// Payment Collection Screen
// Driver acts as Point-Of-Sale: Selects Payer (Sender/Receiver) and Method (Cash/Online)
// Now supports Dynamic UPI QR code generation via Cashfree

import { View, Text, TouchableOpacity, Alert, ActivityIndicator, TextInput, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useState, useEffect } from 'react';
import { Feather } from '@expo/vector-icons';
import { getBookingById, updateBookingStatus, subscribeToBooking, Booking } from '@/lib/bookings';
import { supabase } from '@/lib/supabase';
import UpiQrView from '@/components/UpiQrView';

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
    
    // UPI QR State
    const [showQr, setShowQr] = useState(false);
    const [qrLoading, setQrLoading] = useState(false);
    const [qrPageUrl, setQrPageUrl] = useState('');
    const [qrAmount, setQrAmount] = useState(0);
    const [qrPaid, setQrPaid] = useState(false);

    // SMS is now sent automatically by the backend edge function
    // No manual SMS sending needed

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
                    
                    // SMS is automatically sent by backend edge function
                    if (data.receiver_phone && rpcData?.otp) {
                        Alert.alert(
                          '✅ Notification Sent',
                          `Delivery OTP sent to Customer's App. Ask them to check their notifications.`,
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
            if (updatedBooking.payment_status === 'paid') {
                 setQrPaid(true);
                 Alert.alert('Payment Received! 💰', 'The payment has been confirmed online.');
            }
        });
        
        return () => unsubscribe();
    }, [bookingId]);

    // SMS Status
    const [smsStatus, setSmsStatus] = useState<{status: string, error?: string} | null>(null);
    const [isRetryingSms, setIsRetryingSms] = useState(false);

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

                // SUPPRESS/HIDE "Customer does not have token" error
                // This happens when customer is not logged in / no push token.
                // We treat this as "sent" (or soft success) so driver isn't alarmed.
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
                
                // FALLBACK: If stuck in pending for > 6 seconds (2 polls), wake up the edge function directly
                if (data.status === 'pending' && attempts > 2) {
                    console.log(`[SMS Poll] Status stuck in pending. Triggering Edge Function manually...`);
                    // Don't await this, just fire and forget to wake it up
                    supabase.functions.invoke('send-sms').then(({ data: funcData, error }) => {
                        if (error) {
                             console.error('Failed to invoke send-sms:', error);
                             if (error instanceof Error && 'context' in error) {
                                // @ts-ignore
                                const context: any = error.context;
                                console.error('Error Context:', JSON.stringify(context));
                                
                                // Specific handling for 404 (Not Deployed)
                                if (context?.status === 404) {
                                    Alert.alert('System Error', 'SMS Service not deployed (404). Please contact support.');
                                    setSmsStatus({ status: 'failed', error: 'Service Missing (404)' });
                                    // Stop polling immediately since it won't fix itself
                                    clearInterval(interval);
                                }
                             }
                        }
                        else console.log('Manually invoked send-sms function', funcData);
                    });
                    // Reset attempts so we don't spam, but try again later if still pending
                    attempts = 0; 
                }

                // Stop polling if final state reached
                if (data.status === 'sent' || (data.status === 'failed' && data.error_message)) {
                    clearInterval(interval);
                }
            }
        };

        // Start polling if we know we generated an OTP
        if (booking?.delivery_otp) {
            checkSmsStatus(); // Check immediately
            interval = setInterval(checkSmsStatus, 3000); // Poll every 3s
        }

        return () => {
            if (interval) clearInterval(interval);
        };
    }, [bookingId, booking?.delivery_otp]);

    // Retry sending SMS manually (triggers edge function via RPC if needed, or re-queues)
    const handleRetrySms = async () => {
        if (!booking || isRetryingSms) return;
        setIsRetryingSms(true);
        
        try {
            // Re-queue SMS for existing OTP
            const { error } = await supabase
                .from('sms_queue')
                .insert({
                    phone_number: '+91' + booking.receiver_phone,
                    message: `CARTR Delivery: Your delivery OTP is ${booking.delivery_otp}. Booking #${booking.booking_number}`,
                    booking_id: booking.id,
                    status: 'pending' // This will trigger the pg_net trigger again
                });

            if (error) throw error;
            Alert.alert('Retrying', 'Notification has been re-queued for sending.');
            setSmsStatus({ status: 'pending' }); // Reset UI
            
        } catch (err: any) {
            Alert.alert('Error', 'Failed to retry Notification: ' + err.message);
        } finally {
            setIsRetryingSms(false);
        }
    };

    // Regenerate OTP (Hard Reset)
    const handleRegenerateOtp = async () => {
        if (!booking || isRetryingSms) return;
        
        Alert.alert(
            'Regenerate OTP?',
            'This will create a NEW OTP and send a NEW Notification. The old OTP will be invalid.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Regenerate',
                    style: 'destructive',
                    onPress: async () => {
                        setIsRetryingSms(true);
                        try {
                            const { data: rpcData, error: rpcError } = await supabase.rpc('initiate_delivery_otp', { 
                                p_booking_id: bookingId,
                                p_force_regenerate: true 
                            });

                            if (rpcError) throw rpcError;

                            Alert.alert('New OTP Generated', `New OTP: ${rpcData.otp}`);
                            // Refresh booking to get new OTP
                            const { data: refreshed } = await getBookingById(bookingId);
                            if (refreshed) setBooking(refreshed);
                            
                            // Reset UI status
                            setSmsStatus({ status: 'pending' });

                        } catch (err: any) {
                            Alert.alert('Error', 'Failed to regenerate OTP: ' + err.message);
                        } finally {
                            setIsRetryingSms(false);
                        }
                    }
                }
            ]
        );
    };

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

    // Generate UPI QR Code via Cashfree
    const handleShowQR = async () => {
        if (!booking || qrLoading) return;
        
        // If we already have a QR URL, just show it without re-fetching
        if (qrPageUrl) {
            setShowQr(true);
            return;
        }
        
        setQrLoading(true);
        try {
            const { data, error } = await supabase.functions.invoke('create-upi-qr', {
                body: { booking_id: booking.id }
            });
            
            if (error) throw error;
            if (!data || !data.qr_page_url) {
                throw new Error(data?.error || 'Failed to generate QR code');
            }
            
            setQrPageUrl(data.qr_page_url);
            setQrAmount(data.amount);
            setQrPaid(false);
            setShowQr(true);
            
        } catch (err: any) {
            console.error('QR generation error:', err);
            Alert.alert('Error', err.message || 'Failed to generate QR code. Try again.');
        } finally {
            setQrLoading(false);
        }
    };

    // Poll payment status while QR is shown
    useEffect(() => {
        if (!showQr || !bookingId || !qrPageUrl || qrPaid) return;
        
        const pollInterval = setInterval(async () => {
            try {
                const { data } = await getBookingById(bookingId);
                if (data && (data.payment_status === 'paid' || data.payment_status === 'completed')) {
                    setQrPaid(true);
                    setBooking(data);
                    clearInterval(pollInterval);
                    Alert.alert('Payment Received! 💰', `₹${qrAmount} has been paid successfully.`);
                }
            } catch (e) {
                console.log('[QR Poll] Error checking payment status:', e);
            }
        }, 3000); // Poll every 3 seconds
        
        return () => clearInterval(pollInterval);
    }, [showQr, bookingId, qrPaid, qrPageUrl]);

    // Trigger push notification to sender
    const requestOnlinePayment = async () => {
        if (!booking || !booking.customer || isProcessing) return;
        
        setIsProcessing(true);
        try {
            const total = calculateTotal(booking);
            const outstanding = booking.payment_status === 'partial_paid' 
                 ? total - (booking.wallet_amount_used || 0) 
                 : total;

            // Send notification to customer
             const { error } = await supabase.rpc('send_notification_to_user', {
                p_user_id: booking.customer_id,
                p_title: 'Payment Requested',
                p_body: `Your driver requested payment of ₹${outstanding} for your booking.`,
                p_data: { 
                    booking_id: booking.id, 
                    type: 'payment_request',
                    amount: outstanding
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

        if (isProcessing) return;
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
            <SafeAreaView className="flex-1 bg-white items-center justify-center">
                <ActivityIndicator size="large" color="#22c55e" />
            </SafeAreaView>
        );
    }

    const fare = calculateTotal(booking);
    // Updated to support new wallet statuses
    const isPaid = booking.payment_status === 'paid' || booking.payment_status === 'completed';
    const isPartial = booking.payment_status === 'partial_paid';
    
    // Calculate outstanding amount to collect
    const amountToCollect = isPartial 
        ? (fare - (booking.wallet_amount_used || 0)) 
        : fare;

     return (
         <SafeAreaView className="flex-1 bg-white">
             <ScrollView className="flex-1 px-6" contentContainerStyle={{ paddingBottom: 120 }}>
                 {/* Clean Header - No Back Button */}
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
                    
                     {/* Partial Payment breakdown */}
                     {isPartial && (
                          <View className="mt-2 bg-blue-500/20 px-3 py-1 rounded-lg border border-blue-200">
                             <Text className="text-blue-700 text-xs font-JakartaMedium">
                                 Paid via Wallet: ₹{booking.wallet_amount_used}
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

                {/* Payment Selection (Only if not paid) */}
                {!isPaid && (
                <View className="mb-8">
                    <Text className="text-gray-500 font-JakartaSemiBold mb-4">Who is paying?</Text>
                    
                    {/* Receiver / Sender Toggle */}
                    <View className="flex-row bg-gray-100 p-1 rounded-xl mb-6">
                        <TouchableOpacity 
                            onPress={() => setPayer('receiver')}
                            className={`flex-1 py-3 rounded-lg items-center ${payer === 'receiver' ? 'bg-gray-200' : ''}`}
                        >
                            <Text className={`font-JakartaBold ${payer === 'receiver' ? 'text-gray-900' : 'text-gray-500'}`}>Receiver</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                            onPress={() => setPayer('sender')}
                            className={`flex-1 py-3 rounded-lg items-center ${payer === 'sender' ? 'bg-gray-200' : ''}`}
                        >
                             <Text className={`font-JakartaBold ${payer === 'sender' ? 'text-gray-900' : 'text-gray-500'}`}>Sender</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Method Selection based on Payer */}
                    {payer === 'receiver' ? (
                        <View className="gap-4">
                            <Text className="text-gray-500 text-center text-xs">
                                Collect ₹{amountToCollect} cash, or show the UPI QR for the customer to scan.
                            </Text>
                            
                            {/* Show QR Button */}
                            {!showQr ? (
                                <TouchableOpacity
                                    onPress={handleShowQR}
                                    disabled={qrLoading}
                                    className="w-full p-4 rounded-xl flex-row items-center justify-center bg-blue-500 shadow-sm"
                                >
                                    {qrLoading ? (
                                        <ActivityIndicator size="small" color="#fff" />
                                    ) : (
                                        <>
                                            <Feather name="maximize" size={20} color="#fff" />
                                            <Text className="ml-2 font-JakartaBold text-white">
                                                Show UPI QR Code
                                            </Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            ) : (
                                <View className="items-center">
                                    {/* UPI QR Display */}
                                    <UpiQrView
                                        qrUrl={qrPageUrl}
                                        amount={qrAmount}
                                        isPaid={qrPaid}
                                        isPolling={showQr && !qrPaid}
                                    />
                                    
                            {/* Hide QR - only hides view, keeps URL cached for re-show */}
                                    {!qrPaid && (
                                        <TouchableOpacity
                                            onPress={() => setShowQr(false)}
                                            className="mt-3 py-2 px-4"
                                        >
                                            <Text className="text-gray-500 text-xs font-JakartaMedium">Hide QR Code</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            )}
                        </View>
                    ) : (
                         <View className="gap-3">
                            <TouchableOpacity
                                onPress={() => setPaymentMethod('cash')}
                                className="w-full p-4 rounded-xl flex-row items-center justify-center bg-gray-100 border border-gray-200"
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
                     <Text className="text-gray-600 font-JakartaSemiBold mb-3">Delivery Confirmation</Text>
                     
                     {/* Instruction for Driver */}
                     <View className="bg-blue-500/10 p-3 rounded-lg mb-4 border border-blue-200">
                         <View className="flex-row">
                             <Feather name="info" size={16} color="#2563eb" style={{ marginTop: 2 }} />
                             <Text className="text-blue-700 text-sm font-JakartaMedium ml-2 flex-1">
                                 Ask the receiver or customer for the 6-digit Delivery OTP sent to their app.
                             </Text>
                         </View>
                     </View>

                    {showOtpInput ? (
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
                                            {smsStatus?.status === 'pending' && <ActivityIndicator size="small" color="#3b82f6" className="mr-2" />}
                                            {smsStatus?.status === 'sent' && <Feather name="check-circle" size={16} color="#22c55e" className="mr-2" />}
                                            {smsStatus?.status === 'failed' && <Feather name="alert-circle" size={16} color="#ef4444" className="mr-2" />}
                                            
                                                 <Text className={`font-JakartaMedium text-xs ${
                                                     smsStatus?.status === 'sent' ? 'text-green-600' :
                                                     smsStatus?.status === 'failed' ? 'text-red-600' :
                                                     'text-blue-600'
                                                 }`}>
                                                    {smsStatus?.status === 'sent' ? `Notification Sent to Customer App` :
                                                     smsStatus?.status === 'failed' ? `Notification Failed: ${smsStatus.error?.substring(0, 20)}...` :
                                                     `Sending Notification...`}
                                                </Text>
                                        </View>
                                    </View>

                                     {/* Retry Button */}
                                     {smsStatus?.status === 'failed' && (
                                         <TouchableOpacity 
                                             onPress={handleRetrySms}
                                             disabled={isRetryingSms}
                                             className="mt-2"
                                         >
                                             <Text className="text-blue-600 text-xs text-center font-JakartaBold">
                                                 {isRetryingSms ? 'Retrying...' : 'Tap to Retry Notification'}
                                             </Text>
                                         </TouchableOpacity>
                                     )}

                                     {/* Regenerate Button (Always visible if something is wrong or just delay) */}
                                     <TouchableOpacity 
                                         onPress={handleRegenerateOtp}
                                         disabled={isRetryingSms}
                                         className="mt-4 border-t border-gray-200 pt-2"
                                     >
                                         <Text className="text-gray-600 text-xs text-center font-JakartaMedium">
                                             Notification not received? <Text className="text-red-600 font-JakartaBold">Regenerate New OTP</Text>
                                         </Text>
                                     </TouchableOpacity>
                                     {/* Monitor Button */}
                                     <TouchableOpacity 
                                         onPress={() => router.push('/ride/debug-sms')}
                                         className="mt-4 pt-2 border-t border-gray-200 items-center"
                                     >
                                         <Text className="text-gray-600 text-xs flex-row items-center">
                                             <Feather name="activity" size={12} color="gray" /> Open Notification Monitor
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
                    disabled={isProcessing || (!isPaid && paymentMethod === 'online' && !paymentRequested)} // Simplified logic
                    className={`w-full py-4 rounded-xl flex-row items-center justify-center mb-10 ${
                        (isPaid || payer === 'receiver' || paymentMethod === 'cash') ? 'bg-green-500' : 'bg-gray-200'
                    }`}
                >
                    {isProcessing ? (
                        <ActivityIndicator size="small" color="#fff" />
                    ) : (
                        <>
                            <Feather name="check-circle" size={20} color="#fff" />
                            <Text className="ml-2 text-gray-900 font-JakartaBold text-lg">
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
