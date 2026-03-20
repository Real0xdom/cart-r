import { View, Text, TouchableOpacity, Alert, ActivityIndicator, Image, ScrollView, Platform, AppState } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useState, useEffect, useRef } from 'react';
import { Feather } from '@expo/vector-icons';
import { getBookingById } from '@/lib/bookings';
import { Booking } from '@/types/type';
import { initiateCashfreePayment, createPaymentOrder } from '@/lib/payment';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { images } from "@/constants";
import { getWalletBalance, payWithWallet, calculatePaymentSplit, completePartialPayment, rollbackPartialPayment } from '@/lib/walletPayment';

// Icon Component
const Icon = ({ name }: { name: any }) => (
    <View className="w-10 h-10 bg-gray-100 rounded-full items-center justify-center">
        <Feather name={name} size={20} color="black" />
    </View>
);

// Check if WebView is available (for in-app checkout)
let CashfreeCheckoutModal: any = null;
let isWebViewAvailable = false;

if (Platform.OS !== 'web') {
  try {
    require('react-native-webview');
    CashfreeCheckoutModal = require('@/components/CashfreeCheckoutModal').default;
    isWebViewAvailable = true;
    console.log('[PayBooking] WebView available for in-app checkout');
  } catch (e) {
    console.log('[PayBooking] WebView not available, will use browser fallback');
  }
}

// Check if native SDK is available (only works in dev builds, not Expo Go or Web)
let CFPaymentGatewayService: any = null;
let isNativeSDKAvailable = false;

// Only try to load native SDK on mobile platforms (not web)
if (Platform.OS !== 'web') {
  try {
    // Dynamic import - will fail gracefully in Expo Go or if not linked
    const cashfreeModule = require('react-native-cashfree-pg-sdk');
    if (cashfreeModule && cashfreeModule.CFPaymentGatewayService) {
      CFPaymentGatewayService = cashfreeModule.CFPaymentGatewayService;
      isNativeSDKAvailable = true;
      console.log("[PayBooking] Cashfree native SDK loaded successfully");
    }
  } catch (e: any) {
    console.log("[PayBooking] Cashfree native SDK not available:", e?.message || e);
    isNativeSDKAvailable = false;
  }
}

// Helper for total
const calculateTotal = (b: any) => b.driver_payout || b.total_fare;

const PayBooking = () => {
    const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
    const { user, profile } = useAuth();
    const [booking, setBooking] = useState<Booking | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isPaying, setIsPaying] = useState(false);
    
    // Wallet State
    const [walletBalance, setWalletBalance] = useState(0);
    const [paymentMethod, setPaymentMethod] = useState<'online' | 'wallet'>('online');

    // Checkout Modal State (for WebView)
    const [showCheckoutModal, setShowCheckoutModal] = useState(false);
    const [checkoutSessionId, setCheckoutSessionId] = useState("");
    const [checkoutOrderId, setCheckoutOrderId] = useState("");
    const [currentAmount, setCurrentAmount] = useState(0);
    const [isSplitPayment, setIsSplitPayment] = useState(false);

    // Idempotency Key
    const idempotencyKeyRef = useRef(`pay-${Date.now()}-${Math.floor(Math.random() * 1000)}`);
    const appState = useRef(AppState.currentState);

    useEffect(() => {
        if (!bookingId) {
            router.back();
            return;
        }
        
        const fetchData = async () => {
            if (user?.id) {
                let balance = 0;
                try {
                    balance = await getWalletBalance(user.id);
                    setWalletBalance(balance);
                } catch (error) {
                    console.error('[PayBooking] Failed to load wallet balance:', error);
                    setWalletBalance(0);
                }
                
                // Auto-select wallet if balance > 0
                if (balance > 0) {
                    setPaymentMethod('wallet');
                }
            }

            const { data } = await getBookingById(bookingId);
            if (data) {
                setBooking(data);
                if (data.payment_status === 'paid') {
                    Alert.alert('Success', 'This booking is already paid.');
                    router.replace('/(tabs)/home');
                }
                
                // If already partially paid, enforce wallet payment method (it was already used)
                if (data.payment_status === 'partial_paid') {
                    setPaymentMethod('wallet');
                    setIsSplitPayment(true);
                }
            } else {
                Alert.alert('Error', 'Booking not found');
                router.back();
            }
            setIsLoading(false);
        };
        fetchData();
    }, [bookingId, user?.id]);

    // Initialize native Cashfree SDK callbacks (only if available)
    useEffect(() => {
        if (isNativeSDKAvailable && CFPaymentGatewayService) {
        try {
            CFPaymentGatewayService.setCallback({
            onVerify: async (orderID: string) => {
                console.log("[PayBooking] Order Verified:", orderID);
                // Verify against backend
                await checkPaymentStatus(orderID);
            },
            onError: async (error: any, orderID: string) => {
                console.log("[PayBooking] Payment Failed:", error, orderID);
                setIsPaying(false);
                Alert.alert("Payment Failed", error?.message || "Payment could not be completed.");
            },
            });
        } catch (e) {
            console.log("[PayBooking] Error setting up native SDK callbacks:", e);
        }
        }
        
        // Cleanup
        return () => {
            if (isNativeSDKAvailable && CFPaymentGatewayService) {
                try {
                CFPaymentGatewayService.removeCallback();
                } catch (e) {
                console.log("[PayBooking] Error removing SDK callbacks:", e);
                }
            }
        };
    }, []);

    // ============================================================
    // PAYMENT HANDLER
    // ============================================================
    const handlePayment = async () => {
        console.log('[PayBooking] handlePayment called. Method:', paymentMethod);
        
        if (isPaying) return;

        if (!booking || !user || !profile) {
            Alert.alert('Error', 'User profile not loaded. Please restart the app.');
            return;
        }
        
        const amount = booking.driver_payout || booking.total_fare;
        const { canPayFull, walletAmount, onlineAmount, needsOnlinePayment } = calculatePaymentSplit(walletBalance, amount);

        if (paymentMethod === 'wallet' && walletBalance <= 0 && booking.payment_status !== 'partial_paid') {
             Alert.alert('Insufficient Balance', 'Please add money to your wallet or pay online.');
             return;
        }

        setIsPaying(true);

        try {
            if (paymentMethod === 'wallet') {
                if (canPayFull) {
                    // Full Wallet Payment
                    const result = await payWithWallet(booking.id, user.id, true);
                    if (result.success) {
                        Alert.alert('Success', 'Payment Successful via Wallet!', [
                            { text: 'OK', onPress: () => router.replace('/(tabs)/home') }
                        ]);
                    } else {
                        throw new Error(result.error || 'Wallet payment failed');
                    }
                    setIsPaying(false);
                } else {
                    // Split Payment (Wallet + Online)
                    console.log(`[PayBooking] Split Payment: Wallet ₹${walletAmount}, Online ₹${onlineAmount}`);
                    
                    // 1. Deduct from wallet FIRST
                    const walletResult = await payWithWallet(booking.id, user.id, false);
                    
                    if (!walletResult.success) {
                        throw new Error(walletResult.error || 'Failed to deduct wallet balance');
                    }
                    
                    // Update local balance to reflect deduction immediately
                    if (walletResult.new_wallet_balance !== undefined && walletResult.new_wallet_balance !== null) {
                        setWalletBalance(walletResult.new_wallet_balance);
                    } else {
                         // Fallback: If backend returns null (error case), assume 0 or keep current
                         console.warn('Wallet balance returned null from RPC');
                    }

                    // 2. Create Online Order for remaining amount
                    const { data: orderData, error: orderError } = await createPaymentOrder(
                        booking.id,
                        user.id,
                        profile.name || 'Customer',
                        user.email || 'user@cartr.app',
                        profile.phone || '9999999999',
                        onlineAmount,
                        idempotencyKeyRef.current
                    );

                    if (orderError || !orderData) {
                        // Critical: Online order creation failed after the wallet hold was created.
                        // In a production app, we should auto-refund or show a "Retry Online" state.
                        // For now, throwing error will alert user. They can try paying online again 
                        // (logic needs to support paying remaining if status is partial_paid).
                        throw new Error(orderError || "Failed to create online order. Please contact support if your wallet hold was created.");
                    }

                    // Track for verification
                    setCurrentAmount(onlineAmount);
                    setIsSplitPayment(true);
                    
                    // Show payment options / Open Payment
                    openRealPayment(orderData.payment_session_id, orderData.order_id, orderData.environment);
                }
            } else {
                // Full Online Payment
                console.log('[PayBooking] Full Online Payment: ₹' + amount);
                
                const { data: orderData, error: orderError } = await createPaymentOrder(
                    booking.id,
                    user.id,
                    profile.name || 'Customer',
                    user.email || 'user@cartr.app',
                    profile.phone || '9999999999',
                    amount,
                    idempotencyKeyRef.current
                );

                if (orderError || !orderData) throw new Error(orderError || "Failed to create order");

                // Track for verification
                setCurrentAmount(amount);
                setIsSplitPayment(false);

                // Show payment options / Open Payment
                openRealPayment(orderData.payment_session_id, orderData.order_id, orderData.environment);
            }

        } catch (err: any) {
            // If it's a partial payment failure, prompt user to revert or retry
            if (isSplitPayment || booking.payment_status === 'partial_paid') {
                 Alert.alert(
                    'Online Payment Error', 
                    `${err.message}\n\nYou have already paid ₹${booking.wallet_amount_used || walletAmount} from your wallet.`,
                    [
                        { text: 'Retry Online', onPress: () => handlePayment() },
                        { text: 'Revert Wallet Deduction', onPress: () => handleRollback(), style: 'destructive' },
                    ]
                );
            } else {
                Alert.alert('Payment Failed', err.message);
            }
            setIsPaying(false);
        }
    };

    // ============================================================
    // ROLLBACK HANDLER
    // ============================================================
    const handleRollback = async () => {
        setIsLoading(true);
        try {
            const result = await rollbackPartialPayment(booking!.id);
            if (result.success) {
                // Refresh data
                try {
                    const balance = await getWalletBalance(user!.id);
                    setWalletBalance(balance);
                } catch (error) {
                    console.error('[PayBooking] Failed to refresh wallet balance after rollback:', error);
                    setWalletBalance(0);
                }
                
                const { data } = await getBookingById(bookingId);
                if (data) setBooking(data);
                
                Alert.alert('Wallet Restored', `₹${result.restored_amount} has been added back to your wallet.`);
            } else {
                Alert.alert('Rollback Failed', result.error || 'Failed to restore balance. Please contact support.');
            }
        } catch (e: any) {
            Alert.alert('Error', e.message);
        } finally {
            setIsLoading(false);
            setIsPaying(false);
        }
    };

    // ============================================================
    // PAYMENT OPTIONS (Simulate / Real Cashfree)
    // ============================================================
    const showPaymentOptions = (sessionId: string, orderId: string, amount: number, isSplit: boolean) => {
        Alert.alert(
            '💳 Payment Options',
            `Amount: ₹${amount.toFixed(2)}\n\nChoose how to proceed:`,
            [
                { 
                    text: 'Cancel', 
                    style: 'cancel',
                    onPress: () => setIsPaying(false) 
                },
                {
                    text: '✅ Simulate Success',
                    onPress: () => simulatePayment(orderId, amount, isSplit, true)
                },
                {
                    text: '❌ Simulate Failure', 
                    onPress: () => simulatePayment(orderId, amount, isSplit, false)
                },
                { 
                    text: '💳 Real Cashfree', 
                    onPress: () => openRealPayment(sessionId, orderId)
                }
            ]
        );
    };

    // ============================================================
    // SIMULATE PAYMENT (Success / Failure)
    // ============================================================
    const simulatePayment = async (orderId: string, amount: number, isSplit: boolean, success: boolean) => {
        setIsPaying(false); // Reset button state immediately so user can retry
        
        if (success) {
            try {
                // Call backend to mark payment as complete
                const completeRes = await completePartialPayment(
                    booking!.id, 
                    orderId, 
                    amount
                );
                
                if (completeRes.success) {
                    Alert.alert(
                        '✅ Payment Successful!', 
                        isSplit ? 'Split payment completed successfully.' : 'Payment completed successfully.',
                        [{ text: 'OK', onPress: () => router.replace('/(tabs)/home') }]
                    );
                } else {
                    // Backend returned error - allow retry
                    Alert.alert(
                        '⚠️ Payment Error', 
                        completeRes.error || 'Failed to complete payment. Please try again.',
                        [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Try Again', onPress: () => handlePayment() }
                        ]
                    );
                }
            } catch (e: any) {
                // Network/exception error - allow retry
                Alert.alert(
                    '⚠️ Connection Error', 
                    e.message || 'Network error occurred. Please check your connection.',
                    [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Try Again', onPress: () => handlePayment() }
                    ]
                );
            }
        } else {
            // Simulate failure - show clear message with retry option
            const wAmount = booking?.wallet_amount_used || amount - onlineAmount;
            
            Alert.alert(
                '❌ Payment Failed', 
                isSplit ? `The online payment failed. ₹${wAmount} is already deducted from your wallet.\n\nYou can retry the online part or revert the wallet deduction.` : 'The payment could not be processed. Your money has not been deducted.',
                isSplit ? [
                    { text: 'Retry Online', onPress: () => handlePayment() },
                    { text: 'Revert Wallet', style: 'destructive', onPress: () => handleRollback() },
                ] : [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Try Again', style: 'default', onPress: () => handlePayment() }
                ]
            );
        }
    };

    // ============================================================
    // REAL CASHFREE PAYMENT
    // ============================================================
    const openRealPayment = async (sessionId: string, orderId: string, env: 'sandbox' | 'production' = 'sandbox') => {
        
        // 1. Try Native SDK First
        if (Platform.OS !== 'web' && isNativeSDKAvailable && CFPaymentGatewayService) {
            try {
                console.log("[PayBooking] Attempting native SDK payment...");
                
                // Import from contract package
                const { CFSession, CFEnvironment, CFDropCheckoutPayment, CFThemeBuilder, CFTheme } = require('cashfree-pg-api-contract');
                
                const sdkEnv = env === 'production' ? CFEnvironment.PRODUCTION : CFEnvironment.SANDBOX;
                
                // Create Session
                const session = new CFSession(
                    sessionId,
                    orderId,
                    sdkEnv
                );

                // Create Drop Checkout Payment Object
                const dropPayment = new CFDropCheckoutPayment(
                    session,
                    null, // component (payment modes) - null for all
                    null  // theme - null for default
                );

                // Initiate Native Payment
                console.log("[PayBooking] Launching CFPaymentGatewayService.doPayment...");
                CFPaymentGatewayService.doPayment(dropPayment);
                // Callback will handle success/failure
                return;
                
            } catch (nativeError: any) {
                console.error("[PayBooking] Native SDK Error:", nativeError);
                // Fallback to WebView
            }
        }

        // 2. Fallback to WebView Modal
        if (isWebViewAvailable && CashfreeCheckoutModal) {
            setCheckoutSessionId(sessionId);
            setCheckoutOrderId(orderId);
            setShowCheckoutModal(true);
            // isPaying stays true until modal closes
        } else {
            // 3. Last Resort: Fallback to browser
            try {
                const result = await initiateCashfreePayment(sessionId, orderId);
                if (result.success) {
                    Alert.alert(
                        'Payment Opened', 
                        'Complete payment in your browser, then tap below.',
                        [{ text: 'I have Paid', onPress: () => checkPaymentStatus(orderId) }]
                    );
                } else {
                    Alert.alert('Error', result.error || 'Failed to open payment');
                    setIsPaying(false);
                }
            } catch(e: any) {
                Alert.alert('Error', e.message);
                setIsPaying(false);
            }
        }
    };
    
    // ============================================================
    // CHECK PAYMENT STATUS
    // ============================================================
    const checkPaymentStatus = async (specificOrderId?: string) => {
        setIsLoading(true);
        try {
            // If we have a specific order ID (from callback), verify it specifically
            if (specificOrderId) {
                 const { data, error } = await supabase.functions.invoke('verify-payment', {
                    body: { order_id: specificOrderId }
                });
                
                if (data?.status === 'PAID') {
                     // If split payment, ensure we complete the wallet part
                     if (isSplitPayment) {
                        await completePartialPayment(booking!.id, specificOrderId, currentAmount);
                     }
                     
                     Alert.alert('Success', 'Payment Successful!', [
                        { text: 'OK', onPress: () => router.replace('/(tabs)/home') }
                    ]);
                    return;
                }
            }

            // Fallback: Check booking status directly
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
                Alert.alert('Not Confirmed', 'Payment status is still pending. Please try again.');
            }
        } catch (e: any) {
            console.error('[PayBooking] Verification error:', e);
            Alert.alert('Error', 'Failed to verify payment status');
        } finally {
            setIsLoading(false);
            setIsPaying(false);
        }
    };

    // ============================================================
    // LOADING STATE
    // ============================================================
    if (isLoading || !booking) {
        return (
            <SafeAreaView className="flex-1 bg-white items-center justify-center">
                <ActivityIndicator size="large" color="#FF9800" />
            </SafeAreaView>
        );
    }

    const amount = booking.driver_payout || booking.total_fare;
    const isAlreadyPartial = booking.payment_status === 'partial_paid';
    
    // In partial state, we only care about the remaining online amount
    const split = calculatePaymentSplit(walletBalance, amount);
    const walletAmount = isAlreadyPartial ? booking.wallet_amount_used : split.walletAmount;
    const onlineAmount = isAlreadyPartial ? (amount - (booking.wallet_amount_used || 0)) : split.onlineAmount;
    const needsOnlinePayment = isAlreadyPartial ? true : split.needsOnlinePayment;
    
    const canUseWalletOption = walletBalance > 0 || isAlreadyPartial;

    // ============================================================
    // RENDER
    // ============================================================
    return (
        <SafeAreaView className="flex-1 bg-white">
            <ScrollView 
                className="flex-1 px-5 pt-5"
                contentContainerStyle={{ paddingBottom: 100 }}
                showsVerticalScrollIndicator={false}
            >
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
                
                {/* Amount Display */}
                <View className="items-center py-5">
                    <Image source={images.onboarding2} className="w-32 h-32 mb-5" resizeMode="contain" />
                    <Text className="text-gray-500 font-JakartaMedium mb-2">Total Amount</Text>
                    <Text className="text-4xl font-JakartaBold text-primary-500">₹{amount}</Text>
                </View>

                {/* Sandbox Testing Helper */}
                {__DEV__ && (
                  <View className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 mx-1">
                    <Text className="text-xs font-JakartaBold text-amber-800 mb-1">🧪 SANDBOX MODE — Test Credentials</Text>
                    <Text className="text-[10px] text-amber-700">UPI: <Text className="font-JakartaBold">testsuccess@gocash</Text> (success) • <Text className="font-JakartaBold">testfailure@gocash</Text> (fail)</Text>
                    <Text className="text-[10px] text-amber-700">Card: <Text className="font-JakartaBold">4111 1111 1111 1111</Text> • CVV: 123 • OTP: <Text className="font-JakartaBold">111000</Text></Text>
                  </View>
                )}
                
                {/* Booking Info */}
                <View className="bg-gray-50 p-5 rounded-2xl mb-8">
                    <View className="flex-row justify-between mb-3">
                        <Text className="text-gray-500">Booking ID</Text>
                        <Text className="font-JakartaBold">{booking.booking_number}</Text>
                    </View>
                    <View className="flex-row justify-between mb-3">
                        <Text className="text-gray-500">Wallet Balance</Text>
                        <Text className={`font-JakartaBold ${walletBalance > 0 ? 'text-green-600' : 'text-gray-500'}`}>
                            ₹{walletBalance.toFixed(2)}
                        </Text>
                    </View>
                </View>

                {/* Payment Methods */}
                <Text className="text-lg font-JakartaBold mb-4">Select Payment Method</Text>

                {/* Option 1: Pay Full Online */}
                <TouchableOpacity 
                    onPress={() => setPaymentMethod('online')}
                    disabled={isAlreadyPartial}
                    className={`p-4 rounded-xl border mb-3 flex-row items-center justify-between ${
                        paymentMethod === 'online' ? 'bg-primary-50 border-primary-500' : 
                        isAlreadyPartial ? 'bg-gray-100 border-gray-200 opacity-60' : 'bg-white border-gray-200'
                    }`}
                >
                    <View className="flex-row items-center">
                        <Icon name="credit-card" />
                        <View className="ml-3">
                            <Text className="font-JakartaSemiBold text-base">Pay Full Online</Text>
                            <Text className="text-xs text-gray-500">Pay ₹{amount.toFixed(2)} via UPI/Card</Text>
                        </View>
                    </View>
                    {paymentMethod === 'online' && <Feather name="check-circle" size={20} color="#FF9800" />}
                </TouchableOpacity>

                {/* Option 2: Wallet or Split */}
                <TouchableOpacity 
                    onPress={() => setPaymentMethod('wallet')}
                    disabled={!canUseWalletOption}
                    className={`p-4 rounded-xl border mb-6 flex-row items-center justify-between ${
                        paymentMethod === 'wallet' 
                            ? 'bg-primary-50 border-primary-500' 
                            : !canUseWalletOption ? 'bg-gray-100 border-gray-200 opacity-60' : 'bg-white border-gray-200'
                    }`}
                >
                    <View className="flex-row items-center flex-1">
                        <Icon name="briefcase" />
                        <View className="ml-3 flex-1">
                            <Text className="font-JakartaSemiBold text-base">
                                {needsOnlinePayment ? 'Split Payment' : 'Pay via Wallet'}
                            </Text>
                             
                            {!canUseWalletOption && !isAlreadyPartial ? (
                                <Text className="text-xs text-red-500">Insufficient balance</Text>
                            ) : isAlreadyPartial ? (
                                <View>
                                    <Text className="text-xs text-green-600 font-JakartaBold">
                                        ₹{booking.wallet_amount_used} already paid from wallet
                                    </Text>
                                    <Text className="text-xs text-primary-500">
                                        Remaining to pay: ₹{onlineAmount.toFixed(2)}
                                    </Text>
                                </View>
                            ) : needsOnlinePayment ? (
                                <View>
                                    <Text className="text-xs text-gray-600">
                                        Use <Text className="font-JakartaBold text-green-600">₹{walletAmount}</Text> from Wallet
                                    </Text>
                                    <Text className="text-xs text-primary-500 font-JakartaBold">
                                        + Pay ₹{onlineAmount.toFixed(2)} Online
                                    </Text>
                                </View>
                            ) : (
                                <Text className="text-xs text-green-600">Available balance covers full amount</Text>
                            )}
                        </View>
                    </View>
                    {paymentMethod === 'wallet' && <Feather name="check-circle" size={20} color="#FF9800" />}
                </TouchableOpacity>
                
                {/* Pay Button */}
                <TouchableOpacity
                    onPress={handlePayment}
                    disabled={isPaying || (!isAlreadyPartial && paymentMethod === 'wallet' && !canUseWalletOption)}
                    className={`w-full py-4 rounded-full flex-row items-center justify-center shadow-md shadow-primary-300 ${
                        isPaying || (!isAlreadyPartial && paymentMethod === 'wallet' && !canUseWalletOption) ? 'bg-gray-400' : 'bg-primary-500'
                    }`}
                >
                    {isPaying ? (
                        <ActivityIndicator color="white" />
                    ) : (
                        <>
                            <Text className="text-white font-JakartaBold text-lg mr-2">
                                {paymentMethod === 'wallet' 
                                    ? (needsOnlinePayment ? `Pay ₹${onlineAmount.toFixed(2)}` : 'Pay Now') 
                                    : 'Pay Now'}
                            </Text>
                            <Feather name="arrow-right" size={20} color="white" />
                        </>
                    )}
                </TouchableOpacity>

            </ScrollView>

            {/* Cashfree WebView Modal (like Add Money) */}
            {isWebViewAvailable && CashfreeCheckoutModal && (
                <CashfreeCheckoutModal
                    visible={showCheckoutModal}
                    paymentSessionId={checkoutSessionId}
                    orderId={checkoutOrderId}
                    environment="sandbox"
                    onSuccess={async (orderId: string) => {
                        console.log("[PayBooking] Cashfree Success:", orderId);
                        setShowCheckoutModal(false);
                        // Verify against backend
                        checkPaymentStatus(orderId);
                    }}
                    onFailure={(error: string) => {
                        console.log("[PayBooking] Cashfree Failed:", error);
                        setShowCheckoutModal(false);
                        setIsPaying(false);
                        Alert.alert("Payment Failed", error);
                    }}
                    onClose={() => {
                        console.log("[PayBooking] Cashfree Modal Closed");
                        setShowCheckoutModal(false);
                        setIsPaying(false);
                    }}
                />
            )}
        </SafeAreaView>
    );
};

export default PayBooking;
