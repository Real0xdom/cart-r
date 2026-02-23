import { useState, useEffect, useRef } from "react";
import { ScrollView, Text, View, TouchableOpacity, TextInput, Alert, ActivityIndicator, AppState } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import Modal from "react-native-modal";
import * as Linking from 'expo-linking';

import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import CustomButton from "@/components/CustomButton";

// Wallet top-up uses browser checkout (Linking.openURL) for maximum compatibility
// No native SDK or WebView required

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
  const appState = useRef(AppState.currentState);

  // Listen for app state changes (when user returns from browser)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      console.log(`[WALLET] AppState changed: ${appState.current} -> ${nextAppState}`);
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        console.log("[WALLET] App returned to foreground. Pending order:", pendingOrderId);
        if (pendingOrderId) {
          console.log("[WALLET] 🔄 Auto-verifying payment for order:", pendingOrderId);
          verifyPaymentStatus(pendingOrderId);
        }
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [pendingOrderId]);

  // No native SDK callbacks needed - using browser checkout

  // Fetch data on mount
  useEffect(() => {
    if (user) {
      fetchBalance();
      fetchTransactions();
    }
  }, [user]);

  const fetchTransactions = async () => {
    if (!user) return;
    console.log("[WALLET] 📋 Fetching transactions...");
    try {
      const { data, error } = await supabase
        .from('wallet_transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (error) console.log("[WALLET] ⚠️ Transactions fetch error:", error.message);
      if (data) {
        console.log(`[WALLET] ✅ Fetched ${data.length} transactions`);
        setTransactions(data);
      }
    } catch (e) {
      console.log("[WALLET] ❌ Error fetching transactions:", e);
    }
  };

  const fetchBalance = async () => {
    if (!user) return;
    console.log("[WALLET] 💰 Fetching balance...");
    try {
        const { data, error } = await supabase
            .from('users')
            .select('balance')
            .eq('id', user.id)
            .single();
        
        if (error) console.log("[WALLET] ⚠️ Balance fetch error:", error.message);
        if (data) {
            console.log("[WALLET] ✅ Balance:", data.balance);
            setBalance(data.balance || 0);
        }
    } catch (e) {
        console.log("[WALLET] ❌ Error fetching balance:", e);
    }
  };

  const verifyPaymentStatus = async (orderId: string, forceFail: boolean = false) => {
    console.log("[WALLET] ====== VERIFY PAYMENT ======");
    console.log("[WALLET] Order ID:", orderId, "Force fail:", forceFail);
    try {
      console.log("[WALLET] 📡 Calling verify-payment edge function...");
      const { data, error } = await supabase.functions.invoke('verify-payment', {
        body: { 
            order_id: orderId,
            force_fail: forceFail
        }
      });

      if (error) {
        console.error("[WALLET] ❌ verify-payment error:", JSON.stringify(error, null, 2));
      }

      console.log("[WALLET] ✅ Verify response:", JSON.stringify(data, null, 2));

      // Always update history
      await fetchTransactions();

      if (data?.status === 'PAID') {
        console.log("[WALLET] 🎉 Payment PAID! Amount:", data.amount);
        await handlePaymentSuccess(orderId, data.amount);
      } else if (data?.status === 'FAILED' || data?.status === 'CANCELLED') {
        console.log("[WALLET] ❌ Payment", data?.status);
        setLoading(false);
        setStatusType('failure');
        setStatusMessage(
          data?.order_status === 'CANCELLED' 
            ? "Payment was cancelled." 
            : "Payment failed. Please try again."
        );
        setStatusModalVisible(true);
      } else {
        // PENDING — order is still active, user may not have completed checkout
        console.log("[WALLET] ⏳ Payment still PENDING (order_status:", data?.order_status, ")");
        setLoading(false);
        Alert.alert(
          "Payment Pending",
          "Your payment hasn't been completed yet. If you completed the payment, it may take a moment to process. You can check your balance shortly.",
          [{ text: "OK" }]
        );
      }
    } catch (e) {
      console.log("[WALLET] ❌ Error verifying payment:", e);
      setLoading(false);
    } finally {
      setPendingOrderId(null);
    }
  };

  const handlePaymentSuccess = async (orderId: string, confirmedAmount?: string | number) => {
    console.log("[WALLET] ====== PAYMENT SUCCESS ======");
    console.log("[WALLET] Order ID:", orderId, "Confirmed Amount:", confirmedAmount);
    const localAmount = amount;
    
    setModalVisible(false);
    setAmount("");
    setLoading(false);

    try {
      await fetchBalance(); 
      await fetchTransactions();
      
      const finalAmount = confirmedAmount ? parseFloat(confirmedAmount.toString()) : parseFloat(localAmount || "0");
      console.log("[WALLET] ✅ Final amount for display:", finalAmount);

      setStatusType('success');
      setStatusMessage("₹" + finalAmount.toFixed(2) + " added to wallet!");
      setStatusModalVisible(true);
    } catch (e) {
      console.error("[WALLET] ❌ Error post-payment:", e);
    }
  };

  const startPayment = async () => {
    const value = parseFloat(amount);
    console.log("[WALLET] ====== START PAYMENT ======");
    console.log("[WALLET] Amount entered:", amount, "Parsed:", value);
    console.log("[WALLET] User ID:", user?.id);
    console.log("[WALLET] Profile:", JSON.stringify({ name: profile?.name, email: profile?.email, phone: profile?.phone }));

    if (!value || value <= 0) {
      console.log("[WALLET] ❌ Invalid amount, aborting");
      Alert.alert("Invalid Amount", "Please enter a valid amount greater than 0.");
      return;
    }

    if (loading) {
      console.log("[WALLET] ⚠️ Already processing, ignoring duplicate click");
      return;
    }

    setLoading(true);

    // Idempotency: 60-second window
    const timestamp = Math.floor(Date.now() / 60000);
    const idempotencyKey = `wallet-${user?.id || 'unknown'}-${value}-${timestamp}`;
    console.log("[WALLET] Idempotency Key:", idempotencyKey);

    // Check for recent duplicate
    console.log("[WALLET] Checking for recent pending transactions...");
    const { data: existingOrder, error: checkError } = await supabase
      .from('wallet_transactions')
      .select('*')
      .eq('user_id', user!.id)
      .eq('amount', value)
      .eq('status', 'pending')
      .gte('created_at', new Date(Date.now() - 60000).toISOString())
      .maybeSingle();

    if (checkError) {
      console.log("[WALLET] ⚠️ Duplicate check error:", checkError.message);
    }

    if (existingOrder) {
      console.log("[WALLET] ❌ Found recent pending transaction, preventing duplicate:", existingOrder.id);
      setLoading(false);
      Alert.alert(
        "Payment in Progress",
        "You already have a pending payment for this amount. Please complete or wait for the previous transaction to finish."
      );
      return;
    }
    console.log("[WALLET] ✅ No duplicate found, proceeding...");

    try {
      // 1. Create Order via Supabase Edge Function
      const callbackUrl = __DEV__
        ? 'https://docs.cashfree.com/docs/payment-success'
        : 'carter://payment-callback';
      console.log("[WALLET] Callback URL:", callbackUrl);

      console.log("[WALLET] 📡 Calling create-payment-order edge function...");
      const { data, error } = await supabase.functions.invoke('create-payment-order', {
        body: {
          amount: value,
          customer_id: user?.id,
          customer_phone: profile?.phone || user?.phone || "9999999999",
          customer_name: profile?.name || "CartR User",
          customer_email: profile?.email || user?.email || "user@cartr.app",
          return_url: callbackUrl,
          idempotency_key: idempotencyKey,
        }
      });

      if (error) {
        console.error("[WALLET] ❌ Edge Function error:", JSON.stringify(error, null, 2));
        if (error && typeof error === 'object' && 'context' in error) {
          const context = (error as any).context;
          if (context && typeof context.json === 'function') {
            context.json().then((json: any) => console.error("[WALLET] Edge Function error details:", json));
          } else {
            console.error("[WALLET] Edge Function error context:", context);
          }
        }
        throw new Error("Failed to initiate payment session. Please check your network and try again.");
      }

      console.log("[WALLET] ✅ Edge Function response:", JSON.stringify(data, null, 2));

      if (!data || !data.payment_session_id || !data.order_id) {
        console.error("[WALLET] ❌ Invalid response - missing payment_session_id or order_id");
        throw new Error("Payment service returned invalid response. Please try again.");
      }

      const paymentOrderId = data.order_id;
      const paymentSessionId = data.payment_session_id;
      const env = data.environment || 'sandbox';
      const checkoutUrl = data.checkout_url;

      console.log("[WALLET] Order ID:", paymentOrderId);
      console.log("[WALLET] Session ID:", paymentSessionId);
      console.log("[WALLET] Environment:", env);
      console.log("[WALLET] Checkout URL:", checkoutUrl);

      // 2. Save pending order ID so AppState listener can verify on return
      setPendingOrderId(paymentOrderId);
      console.log("[WALLET] 💾 Saved pending order ID for AppState verification");

      // 3. Open checkout URL in the browser
      if (checkoutUrl) {
        console.log("[WALLET] 🌐 Opening checkout URL in browser...");
        await Linking.openURL(checkoutUrl);
        console.log("[WALLET] ✅ Browser opened. Waiting for user to complete payment...");
        console.log("[WALLET] ℹ️ Payment will be verified when app returns to foreground (AppState listener)");
        // Reset loading and close modal - payment is now in the browser
        setLoading(false);
        setModalVisible(false);
      } else {
        console.error("[WALLET] ❌ No checkout_url in response!");
        throw new Error("No checkout URL received from payment service.");
      }

    } catch (err: any) {
      console.error("[WALLET] ❌ startPayment error:", err.message || err);
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
              <View className="mt-3">
                <Text className="text-xs text-gray-400 text-center mb-2">
                  🌐 Browser Checkout (Sandbox)
                </Text>
                {/* Sandbox Testing Helper */}
                <View className="bg-amber-50 border border-amber-200 rounded-xl p-3 mt-1">
                  <Text className="text-xs font-JakartaBold text-amber-800 mb-1">🧪 SANDBOX MODE — Test Credentials</Text>
                  <Text className="text-[10px] text-amber-700">UPI: <Text className="font-JakartaBold">testsuccess@gocash</Text> (success)</Text>
                  <Text className="text-[10px] text-amber-700">UPI: <Text className="font-JakartaBold">testfailure@gocash</Text> (failure)</Text>
                  <Text className="text-[10px] text-amber-700 mt-1">Card: <Text className="font-JakartaBold">4111 1111 1111 1111</Text></Text>
                  <Text className="text-[10px] text-amber-700">Expiry: Any future • CVV: 123 • OTP: <Text className="font-JakartaBold">111000</Text></Text>
                </View>
              </View>
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
