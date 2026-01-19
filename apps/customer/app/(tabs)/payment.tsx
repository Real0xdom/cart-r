import { useState, useEffect, useRef } from "react";
import { ScrollView, Text, View, TouchableOpacity, TextInput, Alert, ActivityIndicator, AppState, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import Modal from "react-native-modal";
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import CustomButton from "@/components/CustomButton";

// Check if WebView is available (only works in dev builds, not Expo Go)
let CashfreeCheckoutModal: any = null;
let isWebViewAvailable = false;

if (Platform.OS !== 'web') {
  try {
    // This will fail in Expo Go since WebView requires native code
    require('react-native-webview');
    CashfreeCheckoutModal = require('@/components/CashfreeCheckoutModal').default;
    isWebViewAvailable = true;
    console.log("WebView available - popup checkout enabled");
  } catch (e: any) {
    console.log("WebView not available (Expo Go?) - using browser checkout fallback");
    isWebViewAvailable = false;
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
      console.log("Cashfree native SDK loaded successfully");
    }
  } catch (e: any) {
    console.log("Cashfree native SDK not available:", e?.message || e);
    isNativeSDKAvailable = false;
  }
}

const Payment = () => {
  const { user, profile } = useAuth();
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isModalVisible, setModalVisible] = useState(false);
  
  // Status Modal State
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [statusType, setStatusType] = useState<'success' | 'failure'>('success');
  const [statusMessage, setStatusMessage] = useState("");

  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
  
  // Popup checkout state
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [checkoutSessionId, setCheckoutSessionId] = useState<string>("");
  const [checkoutOrderId, setCheckoutOrderId] = useState<string>("");
  const [checkoutEnvironment, setCheckoutEnvironment] = useState<'sandbox' | 'production'>('sandbox');
  const appState = useRef(AppState.currentState);

  // Listen for app state changes (when user returns from browser)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        // App has come to foreground - check if we have a pending order
        if (pendingOrderId) {
          verifyPaymentStatus(pendingOrderId);
        }
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [pendingOrderId]);

  // Initialize native Cashfree SDK callbacks (only if available)
  useEffect(() => {
    if (isNativeSDKAvailable && CFPaymentGatewayService) {
      try {
        CFPaymentGatewayService.setCallback({
          onVerify: async (orderID: string) => {
            console.log("Order Verified:", orderID);
            // Verify against backend to ensure DB is updated (balance + transactions)
            await verifyPaymentStatus(orderID);
          },
          onError: async (error: any, orderID: string) => {
            console.log("Payment Failed:", error, orderID);
            // 1. Sync DB status (Mark as Failed explicitly via cancel function)
            try {
                await supabase.functions.invoke('cancel-payment-order', {
                    body: { order_id: orderID, reason: error?.message }
                });
                // Force refresh list to show "Failed"
                await fetchTransactions();
            } catch (e) {
                console.log("Error cancelling order:", e);
            }
            
            // 2. Force show failure UI
            setLoading(false);
            setStatusType('failure');
            setStatusMessage(error?.message || "Payment could not be completed.");
            setStatusModalVisible(true);
          },
        });
      } catch (e) {
        console.log("Error setting up native SDK callbacks:", e);
        isNativeSDKAvailable = false;
      }
    }
    
    // Cleanup: Remove callbacks when component unmounts (per official Cashfree docs)
    return () => {
      if (isNativeSDKAvailable && CFPaymentGatewayService) {
        try {
          CFPaymentGatewayService.removeCallback();
        } catch (e) {
          console.log("Error removing SDK callbacks:", e);
        }
      }
    };
  }, [user]);

  // Fetch data on mount
  useEffect(() => {
    if (user) {
      fetchBalance();
      fetchTransactions();
    }
  }, [user]);

  const fetchTransactions = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('wallet_transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (data) {
        setTransactions(data);
      }
    } catch (e) {
      console.log("Error fetching transactions:", e);
    }
  };

  const fetchBalance = async () => {
    if (!user) return;
    try {
        const { data, error } = await supabase
            .from('users')
            .select('balance')
            .eq('id', user.id)
            .single();
        
        if (data) {
            setBalance(data.balance || 0);
        }
    } catch (e) {
        console.log("Error fetching balance:", e);
    }
  };

  const verifyPaymentStatus = async (orderId: string, forceFail: boolean = false) => {
    try {
      // Call backend to verify payment status
      const { data, error } = await supabase.functions.invoke('verify-payment', {
        body: { 
            order_id: orderId,
            force_fail: forceFail // Signal backend to mark as failed if currently pending
        }
      });

      // Always update history so "Pending" changes to "Failed" or "Completed"
      await fetchTransactions();

      if (data?.status === 'PAID') {
        await handlePaymentSuccess(orderId, data.amount);
      } else if (data?.status === 'FAILED' || data?.status === 'CANCELLED') {
        setLoading(false);
        setStatusType('failure');
        setStatusMessage(data?.order_status === 'CANCELLED' ? "Payment Cancelled" : "Payment Failed");
        setStatusModalVisible(true);
      } else {
        // Still Pending
        setLoading(false);
      }
    } catch (e) {
      console.log("Error verifying payment:", e);
      setLoading(false);
    } finally {
      setPendingOrderId(null);
    }
  };

  const handlePaymentSuccess = async (orderId: string, confirmedAmount?: string | number) => {
    // Capture local amount before clearing, as fallback
    const localAmount = amount;
    
    setModalVisible(false);
    setAmount("");
    setLoading(false); // Stop loading spinner

    try {
      // Refetch balance and transactions
      await fetchBalance(); 
      await fetchTransactions();
      
      // Determine amount to show: prefer backend confirmed amount, else fallback to local input
      const finalAmount = confirmedAmount ? parseFloat(confirmedAmount.toString()) : parseFloat(localAmount || "0");

      // Show Success Modal
      setStatusType('success');
      setStatusMessage("₹" + finalAmount.toFixed(2) + " added to wallet!");
      setStatusModalVisible(true);
    } catch (e) {
      console.error("Error post-payment:", e);
    }
  };

  const startPayment = async () => {
    const value = parseFloat(amount);
    if (!value || value <= 0) {
      Alert.alert("Invalid Amount", "Please enter a valid amount greater than 0.");
      return;
    }

    // Prevent multiple clicks by checking loading state
    if (loading) {
      console.log("[PAYMENT] Already processing, ignoring duplicate click");
      return;
    }

    // Generate idempotency key - unique per user+amount+time window
    // Time window: 60 seconds (prevents duplicate within 1 minute)
    // This allows user to add same amount again after 1 minute if they want
    const timestamp = Math.floor(Date.now() / 60000); // Round to minute
    const idempotencyKey = `wallet-${user?.id || 'unknown'}-${value}-${timestamp}`;
    
    console.log("[PAYMENT] Idempotency Key:", idempotencyKey);

    // Check if we already have a pending order with this exact key
    const { data: existingOrder, error: checkError } = await supabase
      .from('wallet_transactions')
      .select('*')
      .eq('user_id', user?.id)
      .eq('amount', value)
      .eq('status', 'pending')
      .gte('created_at', new Date(Date.now() - 60000).toISOString()) // Last 60 seconds
      .maybeSingle();

    if (existingOrder) {
      console.log("[PAYMENT] Found recent pending transaction, preventing duplicate");
      Alert.alert(
        "Payment in Progress",
        "You already have a pending payment for this amount. Please complete or wait for the previous transaction to finish."
      );
      return;
    }

    setLoading(true);
    
    try {
      // 1. Create Order Session via Backend
      // Use the registered app scheme 'carter://' for proper deep linking in Production
      // In DEV (Expo Go), use a dummy HTTPS URL because 'exp://' is often rejected by Cashfree
      // causing "Authentication Error". We rely on AppState polling to verify payment.
      const callbackUrl = __DEV__ 
        ? 'https://docs.cashfree.com/docs/payment-success' // Valid HTTPS URL for testing
        : 'carter://payment-callback'; // Production app scheme
        
      const { data, error } = await supabase.functions.invoke('create-payment-order', {
        body: {
          amount: value,
          customer_id: user?.id,
          customer_phone: profile?.phone || user?.phone || "9999999999",
          customer_name: profile?.name || "CartR User",
          customer_email: profile?.email || user?.email || "user@cartr.app",
          return_url: callbackUrl,
          idempotency_key: idempotencyKey // Send to backend
        }
      });

      if (error) {
        // Detailed logging for FunctionsHttpError
        if (error && typeof error === 'object' && 'context' in error) {
             const context = (error as any).context;
             if (context && typeof context.json === 'function') {
                context.json().then((json: any) => console.error("Edge Function Error Details:", json));
             } else {
                console.error("Edge Function Error Context:", context);
             }
        }
        console.error("Session creation error (Full):", JSON.stringify(error, null, 2));
        throw new Error("Failed to initiate payment session. Please check your network and try again.");
      }
      
      if (!data || !data.payment_session_id || !data.order_id) {
        console.error("Invalid response from payment service:", data);
        throw new Error("Payment service returned invalid response. Please try again.");
      }

      // Edge Function now returns standard Orders API fields
      const paymentOrderId = data.order_id;
      const paymentSessionId = data.payment_session_id;
      const env = data.environment; // 'sandbox' | 'production'
      let paymentLink = data.checkout_url; 

      console.log("Payment order created:", { paymentOrderId, paymentSessionId, env });

      // 2. Initiate Payment via Native SDK
      // This requires a Development Build (APK) to work. 
      // It will NOT work in standard Expo Go.
      
      if (Platform.OS !== 'web' && isNativeSDKAvailable && CFPaymentGatewayService) {
        try {
          console.log("Attempting native SDK payment...");
          
          // Import from contract package
          const { CFSession, CFEnvironment, CFDropCheckoutPayment, CFThemeBuilder, CFTheme } = require('cashfree-pg-api-contract');
          
          const sdkEnv = env === 'production' ? CFEnvironment.PRODUCTION : CFEnvironment.SANDBOX;
          
          // Create Session
          const session = new CFSession(
            paymentSessionId,
            paymentOrderId,
            sdkEnv
          );

          // Create Theme (Optional but good practice)
          // const theme = new CFThemeBuilder()
          //   .setNavigationBarBackgroundColor("#ffffff")
          //   .setNavigationBarTextColor("#111111")
          //   .setButtonBackgroundColor("#FF9800")
          //   .setButtonTextColor("#ffffff")
          //   .setPrimaryTextColor("#111111")
          //   .setSecondaryTextColor("#111111")
          //   .build();

          // Create Drop Checkout Payment Object
          const dropPayment = new CFDropCheckoutPayment(
            session,
            null, // component (payment modes) - null for all
            null  // theme - null for default
          );

          // Initiate Native Payment
          console.log("Launching CFPaymentGatewayService.doPayment...");
          CFPaymentGatewayService.doPayment(dropPayment);
          console.log("Native Payment Initiated");
          
        } catch (nativeError: any) {
          console.error("Native SDK Error:", nativeError);
          Alert.alert("Payment Error", "Could not initialize payment SDK: " + nativeError.message);
        }
      } else {
        // Fallback for when SDK is missing (e.g. running in Expo Go by mistake)
        Alert.alert(
          "Development Build Required", 
          "Cashfree Native SDK is not installed. You are likely running in Expo Go.\n\nPlease run this in the Development Build APK."
        );
      }

    } catch (err: any) {
      console.error("Start payment error:", err);
      Alert.alert("Error", err.message || "Failed to start payment");
      setLoading(false);
      setPendingOrderId(null);
    }
  };

  const predefinedAmounts = [500, 1000, 2000];

  return (
    <SafeAreaView className="flex-1 bg-general-900">
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Header */}
        <View className="p-5">
            <Text className="text-2xl font-JakartaBold mb-5">Payment</Text>
            
            {/* Wallet Card */}
            <View className="bg-black rounded-[24px] p-6 shadow-lg relative overflow-hidden">
                <View className="absolute right-0 top-0 w-32 h-32 bg-gray-800 rounded-full -mr-10 -mt-10 opacity-20" />
                <View className="absolute left-0 bottom-0 w-24 h-24 bg-brand-500 rounded-full -ml-8 -mb-8 opacity-20" />
                
                <Text className="text-gray-400 font-JakartaMedium text-sm">CartR Credit Balance</Text>
                <Text className="text-white font-JakartaExtraBold text-4xl mt-2">
                    ₹ {balance.toFixed(2)}
                </Text>

                <View className="mt-8 flex-row items-center justify-between">
                    <View className="flex-row items-center">
                        <View className="bg-gray-800 w-8 h-8 rounded-full items-center justify-center mr-2">
                            <Feather name="shield" size={14} color="#F5B800" />
                        </View>
                        <Text className="text-gray-400 text-xs">Secure & Encrypted</Text>
                    </View>
                    
                    <TouchableOpacity 
                        onPress={() => setModalVisible(true)}
                        className="bg-green-500 px-4 py-2 rounded-full flex-row items-center"
                    >
                        <Feather name="plus" size={16} color="white" />
                        <Text className="font-JakartaBold text-white ml-1 text-sm">Add Money</Text>
                    </TouchableOpacity>
                </View>
            </View>
            
            {/* SDK Status Indicator (for debugging) */}
            {__DEV__ && (
              <Text className="text-xs text-gray-400 mt-2 text-center">
                {isNativeSDKAvailable ? "🟢 Native SDK" : "🌐 Browser Checkout"}
              </Text>
            )}
        </View>

        {/* Transactions list */}
        <View className="px-5 mt-2">
            <Text className="text-lg font-JakartaBold mb-4">Recent Transactions</Text>
            
            {transactions.length === 0 ? (
              /* Empty State */
              <View className="items-center justify-center py-10 opacity-50">
                  <View className="bg-gray-200 w-16 h-16 rounded-full items-center justify-center mb-3">
                      <Feather name="list" size={24} color="gray" />
                  </View>
                  <Text className="text-gray-500 font-JakartaMedium">No recent transactions</Text>
              </View>
            ) : (
              /* Transaction List */
              <View>
                {transactions.map((txn) => (
                  <View key={txn.id} className="flex-row items-center justify-between py-4 border-b border-gray-100">
                    <View className="flex-row items-center flex-1">
                      <View className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${
                        txn.type === 'credit' ? 'bg-green-100' : 'bg-red-100'
                      }`}>
                        <Feather 
                          name={txn.type === 'credit' ? 'arrow-down-left' : 'arrow-up-right'} 
                          size={18} 
                          color={txn.type === 'credit' ? '#10B981' : '#EF4444'} 
                        />
                      </View>
                      <View className="flex-1">
                        <Text className="font-JakartaBold text-gray-800 text-sm">
                          {txn.description || (txn.type === 'credit' ? 'Wallet Top-up' : 'Payment')}
                        </Text>
                        <Text className="text-xs text-gray-500">
                          {new Date(txn.created_at).toLocaleDateString()} • {new Date(txn.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </Text>
                      </View>
                    </View>
                    <View className="items-end">
                      <Text className={`font-JakartaBold ${
                        txn.type === 'credit' ? 'text-green-600' : 'text-gray-900'
                      }`}>
                        {txn.type === 'credit' ? '+' : '-'} ₹{parseFloat(txn.amount).toFixed(2)}
                      </Text>
                      <Text className={`text-[10px] uppercase font-JakartaBold ${
                        txn.status === 'completed' ? 'text-green-600' : 
                        txn.status === 'failed' ? 'text-red-500' : 'text-orange-500'
                      }`}>
                        {txn.status}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
        </View>
      </ScrollView>

      {/* Add Money Modal */}
      <Modal 
        isVisible={isModalVisible} 
        onBackdropPress={() => !loading && setModalVisible(false)}
        style={{ margin: 0, justifyContent: 'flex-end' }}
        onSwipeComplete={() => !loading && setModalVisible(false)}
        swipeDirection={['down']}
      >
        <View className="bg-white rounded-t-[32px] p-6 h-auto">
            <View className="items-center mb-6">
                <View className="w-12 h-1 bg-gray-300 rounded-full" />
            </View>

            {loading ? (
                 <View className="py-10 items-center">
                    <ActivityIndicator size="large" color="#F5B800" />
                    <Text className="mt-4 font-JakartaMedium text-gray-600">Opening Payment Gateway...</Text>
                 </View>
            ) : (
                <>
                    <Text className="text-xl font-JakartaBold text-center mb-2">Add Money to Wallet</Text>
                    <Text className="text-gray-500 text-center text-sm mb-8">Enter amount to top up your CartR balance</Text>

                    <View className="items-center mb-8">
                        <View className="flex-row items-center">
                            <Text className="text-4xl font-JakartaExtraBold">₹ </Text>
                            <TextInput 
                                value={amount}
                                onChangeText={setAmount}
                                keyboardType="numeric"
                                placeholder="0"
                                placeholderTextColor="#E2E8F0"
                                autoFocus
                                className="text-4xl font-JakartaExtraBold text-black min-w-[100px]"
                                style={{ height: 60 }}
                            />
                        </View>
                    </View>

                    {/* Quick Select Chips */}
                    <View className="flex-row justify-between mb-8">
                        {predefinedAmounts.map((val) => (
                            <TouchableOpacity 
                                key={val}
                                onPress={() => setAmount(val.toString())}
                                className={`flex-1 py-3 rounded-xl border mx-2 items-center ${amount === val.toString() ? 'bg-brand-100 border-brand-500' : 'bg-white border-gray-200'}`}
                            >
                                <Text className={`font-JakartaBold ${amount === val.toString() ? 'text-black' : 'text-gray-600'}`}>₹{val}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Action Button */}
                    <CustomButton 
                        title="Add Money"
                        onPress={startPayment}
                        disabled={loading || !amount || parseFloat(amount) <= 0}
                        className="w-full bg-brand-500 mb-4"
                        textVariant="primary"
                    />
                    
                    <View className="flex-row justify-center items-center mb-4">
                        <Feather name="lock" size={12} color="#A0A0A0" />
                        <Text className="text-xs text-gray-400 ml-1">Secured by Cashfree Payments</Text>
                    </View>
                </>
            )}
        </View>
      </Modal>

      {/* Cashfree Popup Checkout Modal - Only render when WebView is available */}
      {isWebViewAvailable && CashfreeCheckoutModal && (
        <CashfreeCheckoutModal
          visible={showCheckoutModal}
          paymentSessionId={checkoutSessionId}
          orderId={checkoutOrderId}
          environment={checkoutEnvironment}
          onSuccess={async (orderId: string, paymentDetails: any) => {
            console.log("Payment successful:", orderId, paymentDetails);
            setShowCheckoutModal(false);
            // Verify against backend to ensure DB is updated
            await verifyPaymentStatus(orderId);
          }}
          onFailure={(error: string, orderId: string) => {
            console.log("Payment failed:", error, orderId);
            setShowCheckoutModal(false);
            setLoading(false);
            Alert.alert(
              "Payment Failed", 
              error || "The payment could not be completed. Please try again."
            );
          }}
          onClose={() => {
            console.log("Checkout modal closed by user");
            setShowCheckoutModal(false);
            setLoading(false);
            // Optionally verify payment status in case user completed payment
            if (checkoutOrderId) {
              setTimeout(() => verifyPaymentStatus(checkoutOrderId), 500);
            }
          }}
        />
      )}
      {/* Status Modal (Success/Failure) */}
      <Modal 
        isVisible={statusModalVisible} 
        onBackdropPress={() => setStatusModalVisible(false)}
        animationIn="fadeInUp"
        animationOut="fadeOutDown"
        className="m-0 justify-end"
      >
        <View className="bg-white rounded-t-[32px] p-8 items-center h-auto min-h-[300px]">
            <View className={`w-20 h-20 rounded-full items-center justify-center mb-6 ${
                statusType === 'success' ? 'bg-green-100' : 'bg-red-100'
            }`}>
                <Feather 
                    name={statusType === 'success' ? 'check' : 'x'} 
                    size={40} 
                    color={statusType === 'success' ? '#10B981' : '#EF4444'} 
                />
            </View>
            
            <Text className="text-2xl font-JakartaBold mb-2 text-center text-gray-900">
                {statusType === 'success' ? 'Payment Successful' : 'Payment Failed'}
            </Text>
            
            <Text className="text-gray-500 text-center font-JakartaMedium mb-8">
                {statusMessage}
            </Text>

            <CustomButton 
                title={statusType === 'success' ? "Done" : "Try Again"}
                onPress={() => setStatusModalVisible(false)}
                className={`w-full ${statusType === 'success' ? 'bg-brand-500' : 'bg-gray-200'} mb-4`}
                textVariant={statusType === 'success' ? 'primary' : 'secondary'}
            />
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default Payment;
