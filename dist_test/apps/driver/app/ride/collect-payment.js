"use strict";
// Payment Collection Screen
// Driver acts as Point-Of-Sale: Selects Payer (Sender/Receiver) and Method (Cash/Online)
Object.defineProperty(exports, "__esModule", { value: true });
// Removed expo-sms - SMS is now sent automatically by backend
const react_native_1 = require("react-native");
const react_native_safe_area_context_1 = require("react-native-safe-area-context");
const expo_router_1 = require("expo-router");
const react_1 = require("react");
const vector_icons_1 = require("@expo/vector-icons");
const bookings_1 = require("@/lib/bookings");
const supabase_1 = require("@/lib/supabase");
// Helper to calculate total with fees (simplified for now)
const calculateTotal = (booking) => booking.driver_payout || booking.total_fare;
const CollectPayment = () => {
    var _a;
    const { bookingId } = (0, expo_router_1.useLocalSearchParams)();
    const [booking, setBooking] = (0, react_1.useState)(null);
    const [isLoading, setIsLoading] = (0, react_1.useState)(true);
    const [isProcessing, setIsProcessing] = (0, react_1.useState)(false);
    // Who is paying?
    const [payer, setPayer] = (0, react_1.useState)('receiver');
    // Payment method
    const [paymentMethod, setPaymentMethod] = (0, react_1.useState)('cash');
    // Delivery OTP
    const [deliveryOtp, setDeliveryOtp] = (0, react_1.useState)('');
    const [showOtpInput, setShowOtpInput] = (0, react_1.useState)(false);
    // Payment request status
    const [paymentRequested, setPaymentRequested] = (0, react_1.useState)(false);
    // SMS is now sent automatically by the backend edge function
    // No manual SMS sending needed
    // Fetch booking data & subscribe to updates
    (0, react_1.useEffect)(() => {
        if (!bookingId) {
            expo_router_1.router.back();
            return;
        }
        const fetchBooking = async () => {
            const { data, error } = await (0, bookings_1.getBookingById)(bookingId);
            if (data) {
                setBooking(data);
                // Generate OTP if not present (automatically queues SMS)
                if (!data.delivery_otp) {
                    console.log('Generating Delivery OTP...');
                    const { data: rpcData, error: rpcError } = await supabase_1.supabase.rpc('initiate_delivery_otp', {
                        p_booking_id: bookingId
                    });
                    if (rpcError) {
                        console.error('Failed to generate OTP:', rpcError);
                        react_native_1.Alert.alert('Error', 'Failed to generate delivery OTP');
                    }
                    else {
                        console.log('OTP Generated and SMS queued automatically:', rpcData);
                        // SMS is automatically sent by backend edge function
                        if (data.receiver_phone && (rpcData === null || rpcData === void 0 ? void 0 : rpcData.otp)) {
                            react_native_1.Alert.alert('✅ Notification Sent', `Delivery OTP sent to Customer's App. Ask them to check their notifications.`, [{ text: 'OK' }]);
                        }
                        // Refresh booking to get the new OTP
                        const { data: refreshed } = await (0, bookings_1.getBookingById)(bookingId);
                        if (refreshed)
                            setBooking(refreshed);
                    }
                }
            }
            else {
                react_native_1.Alert.alert('Error', 'Failed to load booking details');
                expo_router_1.router.back();
            }
            setIsLoading(false);
        };
        fetchBooking();
        // Listen for payment updates (e.g. if sender pays via app)
        const unsubscribe = (0, bookings_1.subscribeToBooking)(bookingId, (updatedBooking) => {
            setBooking(updatedBooking);
            if (updatedBooking.payment_status === 'paid') {
                react_native_1.Alert.alert('Payment Received! 💰', 'The payment has been confirmed online.');
            }
        });
        return () => unsubscribe();
    }, [bookingId]);
    // SMS Status
    const [smsStatus, setSmsStatus] = (0, react_1.useState)(null);
    const [isRetryingSms, setIsRetryingSms] = (0, react_1.useState)(false);
    // Poll for SMS status
    (0, react_1.useEffect)(() => {
        if (!bookingId)
            return;
        let interval;
        let attempts = 0;
        const checkSmsStatus = async () => {
            attempts++;
            const { data, error } = await supabase_1.supabase
                .from('sms_queue')
                .select('status, error_message')
                .eq('booking_id', bookingId)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();
            if (data) {
                console.log(`[SMS Poll] Status: ${data.status}, Error: ${data.error_message}`);
                setSmsStatus({ status: data.status, error: data.error_message });
                // FALLBACK: If stuck in pending for > 6 seconds (2 polls), wake up the edge function directly
                if (data.status === 'pending' && attempts > 2) {
                    console.log(`[SMS Poll] Status stuck in pending. Triggering Edge Function manually...`);
                    // Don't await this, just fire and forget to wake it up
                    supabase_1.supabase.functions.invoke('send-sms').then(({ data: funcData, error }) => {
                        if (error) {
                            console.error('Failed to invoke send-sms:', error);
                            if (error instanceof Error && 'context' in error) {
                                // @ts-ignore
                                const context = error.context;
                                console.error('Error Context:', JSON.stringify(context));
                                // Specific handling for 404 (Not Deployed)
                                if ((context === null || context === void 0 ? void 0 : context.status) === 404) {
                                    react_native_1.Alert.alert('System Error', 'SMS Service not deployed (404). Please contact support.');
                                    setSmsStatus({ status: 'failed', error: 'Service Missing (404)' });
                                    // Stop polling immediately since it won't fix itself
                                    clearInterval(interval);
                                }
                            }
                        }
                        else
                            console.log('Manually invoked send-sms function', funcData);
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
        if (booking === null || booking === void 0 ? void 0 : booking.delivery_otp) {
            checkSmsStatus(); // Check immediately
            interval = setInterval(checkSmsStatus, 3000); // Poll every 3s
        }
        return () => {
            if (interval)
                clearInterval(interval);
        };
    }, [bookingId, booking === null || booking === void 0 ? void 0 : booking.delivery_otp]);
    // Retry sending SMS manually (triggers edge function via RPC if needed, or re-queues)
    const handleRetrySms = async () => {
        if (!booking)
            return;
        setIsRetryingSms(true);
        try {
            // Re-queue SMS for existing OTP
            const { error } = await supabase_1.supabase
                .from('sms_queue')
                .insert({
                phone_number: '+91' + booking.receiver_phone,
                message: `CARTR Delivery: Your delivery OTP is ${booking.delivery_otp}. Booking #${booking.booking_number}`,
                booking_id: booking.id,
                status: 'pending' // This will trigger the pg_net trigger again
            });
            if (error)
                throw error;
            react_native_1.Alert.alert('Retrying', 'SMS has been re-queued for sending.');
            setSmsStatus({ status: 'pending' }); // Reset UI
        }
        catch (err) {
            react_native_1.Alert.alert('Error', 'Failed to retry SMS: ' + err.message);
        }
        finally {
            setIsRetryingSms(false);
        }
    };
    // Regenerate OTP (Hard Reset)
    const handleRegenerateOtp = async () => {
        if (!booking)
            return;
        react_native_1.Alert.alert('Regenerate OTP?', 'This will create a NEW OTP and send a NEW SMS. The old OTP will be invalid.', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Regenerate',
                style: 'destructive',
                onPress: async () => {
                    setIsRetryingSms(true);
                    try {
                        const { data: rpcData, error: rpcError } = await supabase_1.supabase.rpc('initiate_delivery_otp', {
                            p_booking_id: bookingId,
                            p_force_regenerate: true
                        });
                        if (rpcError)
                            throw rpcError;
                        react_native_1.Alert.alert('New OTP Generated', `New OTP: ${rpcData.otp}`);
                        // Refresh booking to get new OTP
                        const { data: refreshed } = await (0, bookings_1.getBookingById)(bookingId);
                        if (refreshed)
                            setBooking(refreshed);
                        // Reset UI status
                        setSmsStatus({ status: 'pending' });
                    }
                    catch (err) {
                        react_native_1.Alert.alert('Error', 'Failed to regenerate OTP: ' + err.message);
                    }
                    finally {
                        setIsRetryingSms(false);
                    }
                }
            }
        ]);
    };
    const verifyDeliveryOtp = () => {
        if (deliveryOtp.length !== 6) {
            react_native_1.Alert.alert('Error', 'Please enter complete 6-digit OTP');
            return false;
        }
        if (deliveryOtp !== (booking === null || booking === void 0 ? void 0 : booking.delivery_otp)) {
            react_native_1.Alert.alert('Incorrect OTP', 'The delivery OTP is incorrect. Please try again.');
            return false;
        }
        return true;
    };
    // Trigger push notification to sender
    const requestOnlinePayment = async () => {
        if (!booking || !booking.customer)
            return;
        setIsProcessing(true);
        try {
            // Send notification to customer
            const { error } = await supabase_1.supabase.rpc('send_notification_to_user', {
                p_user_id: booking.customer_id,
                p_title: 'Payment Requested',
                p_body: `Your driver requested payment of ₹${calculateTotal(booking)} for your booking.`,
                p_data: {
                    booking_id: booking.id,
                    type: 'payment_request',
                    amount: calculateTotal(booking)
                }
            });
            if (error)
                throw error;
            setPaymentRequested(true);
            react_native_1.Alert.alert('Request Sent', 'Notification sent to sender. Waiting for payment...');
        }
        catch (err) {
            react_native_1.Alert.alert('Error', 'Failed to send payment request.');
            console.error(err);
        }
        finally {
            setIsProcessing(false);
        }
    };
    const handleCompleteTrip = async () => {
        if (!booking || !bookingId)
            return;
        // Verify OTP if required (and not already verified)
        if (booking.delivery_otp && !booking.delivery_confirmed_at) {
            if (!showOtpInput) {
                setShowOtpInput(true);
                return;
            }
            if (!verifyDeliveryOtp())
                return;
        }
        setIsProcessing(true);
        try {
            const updatePayload = {
                status: 'completed',
                completed_at: new Date().toISOString(),
                delivery_confirmed_at: new Date().toISOString(),
            };
            // If paying cash now, update payment status
            if (booking.payment_status !== 'paid') {
                updatePayload.payment_status = 'paid';
                updatePayload.payment_method = paymentMethod; // 'cash' or 'online'
            }
            const { error } = await supabase_1.supabase
                .from('bookings')
                .update(updatePayload)
                .eq('id', bookingId);
            if (error)
                throw error;
            // Success
            react_native_1.Alert.alert('Trip Completed! 🎉', `You earned ₹${booking.driver_payout || booking.total_fare}`, [
                {
                    text: 'Back to Home',
                    onPress: () => expo_router_1.router.replace('/(tabs)/home'),
                },
            ]);
        }
        catch (err) {
            console.error('Failed to complete trip:', err);
            react_native_1.Alert.alert('Error', err.message || 'Failed to complete trip.');
            setIsProcessing(false);
        }
    };
    if (isLoading || !booking) {
        return (<react_native_safe_area_context_1.SafeAreaView className="flex-1 bg-gray-900 items-center justify-center">
                <react_native_1.ActivityIndicator size="large" color="#22c55e"/>
            </react_native_safe_area_context_1.SafeAreaView>);
    }
    const fare = calculateTotal(booking);
    const isPaid = booking.payment_status === 'paid';
    return (<react_native_safe_area_context_1.SafeAreaView className="flex-1 bg-gray-900">
            <react_native_1.ScrollView className="flex-1 px-6">
                {/* Header */}
                <react_native_1.View className="flex-row items-center py-4">
                    <react_native_1.TouchableOpacity onPress={() => expo_router_1.router.back()} className="w-10 h-10 bg-gray-800 rounded-full items-center justify-center mr-4">
                        <vector_icons_1.Feather name="arrow-left" size={20} color="#fff"/>
                    </react_native_1.TouchableOpacity>
                    <react_native_1.Text className="text-xl font-JakartaBold text-white">Collect Payment</react_native_1.Text>
                </react_native_1.View>

                {/* Amount Card */}
                <react_native_1.View className="bg-green-500/10 rounded-3xl p-8 items-center mb-6 border border-green-500/20">
                    <react_native_1.Text className="text-gray-400 font-JakartaMedium mb-2">Total Amount</react_native_1.Text>
                    <react_native_1.Text className="text-5xl font-JakartaBold text-green-400">₹{fare}</react_native_1.Text>
                    
                    {isPaid ? (<react_native_1.View className="bg-green-500 px-4 py-1 rounded-full mt-4">
                             <react_native_1.Text className="text-white font-bold">PAID</react_native_1.Text>
                         </react_native_1.View>) : (<react_native_1.View className="bg-yellow-500/20 px-4 py-1 rounded-full mt-4">
                             <react_native_1.Text className="text-yellow-500 font-bold">PENDING</react_native_1.Text>
                         </react_native_1.View>)}
                </react_native_1.View>

                {/* Payment Selection (Only if not paid) */}
                {!isPaid && (<react_native_1.View className="mb-8">
                    <react_native_1.Text className="text-gray-400 font-JakartaSemiBold mb-4">Who is paying?</react_native_1.Text>
                    
                    {/* Receiver / Sender Toggle */}
                    <react_native_1.View className="flex-row bg-gray-800 p-1 rounded-xl mb-6">
                        <react_native_1.TouchableOpacity onPress={() => setPayer('receiver')} className={`flex-1 py-3 rounded-lg items-center ${payer === 'receiver' ? 'bg-gray-700' : ''}`}>
                            <react_native_1.Text className={`font-JakartaBold ${payer === 'receiver' ? 'text-white' : 'text-gray-500'}`}>Receiver</react_native_1.Text>
                        </react_native_1.TouchableOpacity>
                        <react_native_1.TouchableOpacity onPress={() => setPayer('sender')} className={`flex-1 py-3 rounded-lg items-center ${payer === 'sender' ? 'bg-gray-700' : ''}`}>
                             <react_native_1.Text className={`font-JakartaBold ${payer === 'sender' ? 'text-white' : 'text-gray-500'}`}>Sender</react_native_1.Text>
                        </react_native_1.TouchableOpacity>
                    </react_native_1.View>

                    {/* Method Selection based on Payer */}
                    {payer === 'receiver' ? (<react_native_1.View>
                             <react_native_1.TouchableOpacity onPress={() => setPaymentMethod('cash')} className={`w-full p-4 rounded-xl flex-row items-center justify-center bg-green-600 mb-3`}>
                                <vector_icons_1.Feather name="dollar-sign" size={20} color="#fff"/>
                                <react_native_1.Text className="ml-2 font-JakartaBold text-white">
                                    Collect Cash from Receiver
                                </react_native_1.Text>
                            </react_native_1.TouchableOpacity>
                            <react_native_1.Text className="text-gray-500 text-center text-xs">
                                Confirm once you have received ₹{fare} cash or via your personal UPI QR.
                            </react_native_1.Text>
                        </react_native_1.View>) : (<react_native_1.View className="gap-3">
                            <react_native_1.TouchableOpacity onPress={requestOnlinePayment} disabled={paymentRequested} className={`w-full p-4 rounded-xl flex-row items-center justify-center ${paymentRequested ? 'bg-gray-700' : 'bg-blue-600'}`}>
                                {isProcessing ? <react_native_1.ActivityIndicator color="#fff"/> : <vector_icons_1.Feather name="smartphone" size={20} color="#fff"/>}
                                <react_native_1.Text className="ml-2 font-JakartaBold text-white">
                                    {paymentRequested ? 'Request Sent' : 'Request Payment from Sender'}
                                </react_native_1.Text>
                            </react_native_1.TouchableOpacity>
                            
                            <react_native_1.TouchableOpacity onPress={() => setPaymentMethod('cash')} className="w-full p-4 rounded-xl flex-row items-center justify-center bg-gray-800 border border-gray-700">
                                <vector_icons_1.Feather name="dollar-sign" size={20} color="#9ca3af"/>
                                <react_native_1.Text className="ml-2 font-JakartaBold text-gray-400">
                                    Sender Paid Cash/Offline
                                </react_native_1.Text>
                            </react_native_1.TouchableOpacity>
                        </react_native_1.View>)}
                </react_native_1.View>)}

                {/* Delivery OTP (Required to complete) */}
                <react_native_1.View className="mb-6">
                    <react_native_1.Text className="text-gray-400 font-JakartaSemiBold mb-3">Delivery Confirmation</react_native_1.Text>
                    
                    {/* Instruction for Driver */}
                    <react_native_1.View className="bg-blue-500/10 p-3 rounded-lg mb-4 border border-blue-500/20">
                        <react_native_1.View className="flex-row">
                            <vector_icons_1.Feather name="info" size={16} color="#3b82f6" style={{ marginTop: 2 }}/>
                            <react_native_1.Text className="text-blue-400 text-sm font-JakartaMedium ml-2 flex-1">
                                Ask the receiver for the 6-digit Delivery OTP sent to their app/SMS.
                            </react_native_1.Text>
                        </react_native_1.View>
                    </react_native_1.View>

                    {showOtpInput ? (<react_native_1.View>
                            <react_native_1.TextInput value={deliveryOtp} onChangeText={(text) => setDeliveryOtp(text.replace(/[^0-9]/g, ''))} placeholder="Enter 6-digit OTP" placeholderTextColor="#6b7280" keyboardType="number-pad" maxLength={6} className="bg-gray-800 rounded-xl p-4 text-white text-center text-xl font-JakartaBold tracking-widest mb-2"/>
                            {(booking === null || booking === void 0 ? void 0 : booking.receiver_phone) && (<react_native_1.View className="mt-2">
                                    <react_native_1.View className={`rounded-lg p-3 flex-row items-center justify-between ${(smsStatus === null || smsStatus === void 0 ? void 0 : smsStatus.status) === 'sent' ? 'bg-green-500/10 border border-green-500/20' :
                    (smsStatus === null || smsStatus === void 0 ? void 0 : smsStatus.status) === 'failed' ? 'bg-red-500/10 border border-red-500/20' :
                        'bg-blue-500/10 border border-blue-500/20'}`}>
                                        <react_native_1.View className="flex-row items-center flex-1">
                                            {(smsStatus === null || smsStatus === void 0 ? void 0 : smsStatus.status) === 'pending' && <react_native_1.ActivityIndicator size="small" color="#3b82f6" className="mr-2"/>}
                                            {(smsStatus === null || smsStatus === void 0 ? void 0 : smsStatus.status) === 'sent' && <vector_icons_1.Feather name="check-circle" size={16} color="#22c55e" className="mr-2"/>}
                                            {(smsStatus === null || smsStatus === void 0 ? void 0 : smsStatus.status) === 'failed' && <vector_icons_1.Feather name="alert-circle" size={16} color="#ef4444" className="mr-2"/>}
                                            
                                                <react_native_1.Text className={`font-JakartaMedium text-xs ${(smsStatus === null || smsStatus === void 0 ? void 0 : smsStatus.status) === 'sent' ? 'text-green-400' :
                    (smsStatus === null || smsStatus === void 0 ? void 0 : smsStatus.status) === 'failed' ? 'text-red-400' :
                        'text-blue-400'}`}>
                                                    {(smsStatus === null || smsStatus === void 0 ? void 0 : smsStatus.status) === 'sent' ? `Notification Sent to Customer App` :
                    (smsStatus === null || smsStatus === void 0 ? void 0 : smsStatus.status) === 'failed' ? `Notification Failed: ${(_a = smsStatus.error) === null || _a === void 0 ? void 0 : _a.substring(0, 20)}...` :
                        `Sending Notification...`}
                                                </react_native_1.Text>
                                        </react_native_1.View>
                                    </react_native_1.View>

                                    {/* Retry Button */}
                                    {(smsStatus === null || smsStatus === void 0 ? void 0 : smsStatus.status) === 'failed' && (<react_native_1.TouchableOpacity onPress={handleRetrySms} disabled={isRetryingSms} className="mt-2">
                                            <react_native_1.Text className="text-blue-400 text-xs text-center font-JakartaBold">
                                                {isRetryingSms ? 'Retrying...' : 'Tap to Retry Notification'}
                                            </react_native_1.Text>
                                        </react_native_1.TouchableOpacity>)}

                                    {/* Regenerate Button (Always visible if something is wrong or just delay) */}
                                    <react_native_1.TouchableOpacity onPress={handleRegenerateOtp} disabled={isRetryingSms} className="mt-4 border-t border-gray-700 pt-2">
                                        <react_native_1.Text className="text-gray-500 text-xs text-center font-JakartaMedium">
                                            Notification not received? <react_native_1.Text className="text-red-400 font-JakartaBold">Regenerate New OTP</react_native_1.Text>
                                        </react_native_1.Text>
                                    </react_native_1.TouchableOpacity>
                                    {/* Monitor Button */}
                                    <react_native_1.TouchableOpacity onPress={() => expo_router_1.router.push('/ride/debug-sms')} className="mt-4 pt-2 border-t border-gray-700 items-center">
                                        <react_native_1.Text className="text-gray-400 text-xs flex-row items-center">
                                            <vector_icons_1.Feather name="activity" size={12} color="gray"/> Open SMS Monitor
                                        </react_native_1.Text>
                                    </react_native_1.TouchableOpacity>
                                </react_native_1.View>)}
                        </react_native_1.View>) : (<react_native_1.TouchableOpacity onPress={() => setShowOtpInput(true)} className="bg-gray-800 p-4 rounded-xl flex-row items-center justify-center border border-gray-700">
                            <vector_icons_1.Feather name="lock" size={18} color="#9ca3af"/>
                            <react_native_1.Text className="ml-2 text-gray-300 font-JakartaMedium">Enter Delivery OTP</react_native_1.Text>
                        </react_native_1.TouchableOpacity>)}
                </react_native_1.View>

                {/* Complete Button */}
                <react_native_1.TouchableOpacity onPress={handleCompleteTrip} disabled={isProcessing || (!isPaid && paymentMethod === 'online' && !paymentRequested)} // Simplified logic
     className={`w-full py-4 rounded-xl flex-row items-center justify-center mb-10 ${(isPaid || payer === 'receiver' || paymentMethod === 'cash') ? 'bg-green-500' : 'bg-gray-700'}`}>
                    {isProcessing ? (<react_native_1.ActivityIndicator size="small" color="#fff"/>) : (<>
                            <vector_icons_1.Feather name="check-circle" size={20} color="#fff"/>
                            <react_native_1.Text className="ml-2 text-white font-JakartaBold text-lg">
                                {isPaid ? 'Complete Trip' : 'Confirm Payment & Complete'}
                            </react_native_1.Text>
                        </>)}
                </react_native_1.TouchableOpacity>

            </react_native_1.ScrollView>
        </react_native_safe_area_context_1.SafeAreaView>);
};
exports.default = CollectPayment;
