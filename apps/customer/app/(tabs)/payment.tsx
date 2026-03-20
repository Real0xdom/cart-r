import { useState, useEffect, useRef } from "react";
import { ScrollView, Text, View, TouchableOpacity, TextInput, Alert, ActivityIndicator, AppState, Platform, Modal, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as WebBrowser from 'expo-web-browser';
import CashfreeCheckoutModal from "@/components/CashfreeCheckoutModal";
import { router, useLocalSearchParams } from "expo-router";

import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

const Payment = () => {
  const { user, profile } = useAuth();
  const { suggestedAmount, returnTo } = useLocalSearchParams<{
    suggestedAmount?: string;
    returnTo?: string;
  }>();
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
  
  // Cashfree SDK Modal State
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [paymentSessionId, setPaymentSessionId] = useState("");
  const [environment, setEnvironment] = useState<'sandbox' | 'production'>('sandbox');
  
  const appState = useRef(AppState.currentState);

  // Listen for app state changes (when user returns from browser)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
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

  // Fetch data on mount
  useEffect(() => {
    if (user) {
      fetchBalance();
      fetchTransactions();
    }
  }, [user]);

  useEffect(() => {
    if (typeof suggestedAmount === 'string' && suggestedAmount.length > 0) {
      setAmount(suggestedAmount);
      setModalVisible(true);
    }
  }, [suggestedAmount]);

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
            setBalance(Number(data.balance) || 0);
        }
    } catch (e) {
        console.log("Error fetching balance:", e);
    }
  };

  const verifyPaymentStatus = async (orderId: string, forceFail: boolean = false) => {
    try {
      const { data, error } = await supabase.functions.invoke('verify-payment', {
        body: { 
            order_id: orderId,
            force_fail: forceFail
        }
      });

      await fetchTransactions();

      if (data?.status === 'PAID') {
        await handlePaymentSuccess(orderId, data.amount);
      } else if (data?.status === 'FAILED' || data?.status === 'CANCELLED') {
        setLoading(false);
        setStatusType('failure');
        setStatusMessage(data?.order_status === 'CANCELLED' ? "Payment Cancelled" : "Payment Failed");
        setStatusModalVisible(true);
      } else {
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
    const localAmount = amount;
    
    setModalVisible(false);
    setAmount("");
    setLoading(false);

    try {
      await fetchBalance(); 
      await fetchTransactions();
      
      const finalAmount = confirmedAmount ? parseFloat(confirmedAmount.toString()) : parseFloat(localAmount || "0");

      setStatusType('success');
      setStatusMessage("₹" + finalAmount.toFixed(2) + " added to wallet!");
      setStatusModalVisible(true);

      if (typeof returnTo === 'string' && returnTo.length > 0) {
        setTimeout(() => {
          setStatusModalVisible(false);
          router.replace(returnTo as any);
        }, 1200);
      }
    } catch (e) {
      console.error("Error post-payment:", e);
    }
  };

  const handleStatusDismiss = () => {
    if (statusType === 'success' && typeof returnTo === 'string' && returnTo.length > 0) {
      setStatusModalVisible(false);
      router.replace(returnTo as any);
      return;
    }

    setStatusModalVisible(false);
  };

  const startPayment = async () => {
    try {
      console.log("[PAYMENT] startPayment called");
      const value = parseFloat(amount);
      if (!value || value <= 0) {
        Alert.alert("Invalid Amount", "Please enter a valid amount greater than 0.");
        return;
      }

      if (loading) {
        console.log("[PAYMENT] Already processing, ignoring duplicate click");
        return;
      }

      setLoading(true);

      const timestamp = Math.floor(Date.now() / 60000);
      const idempotencyKey = `wallet-${user?.id || 'unknown'}-${value}-${timestamp}`;
      
      console.log("[PAYMENT] Idempotency Key:", idempotencyKey);

      if (!user?.id) {
        Alert.alert("Error", "No user ID found. Please log in again.");
        setLoading(false);
        return;
      }

      console.log("[PAYMENT] Checking for existing orders...");
      const { data: existingOrder, error: checkError } = await supabase
        .from('wallet_transactions')
        .select('*')
        .eq('user_id', user.id)
        .eq('amount', value)
        .eq('status', 'pending')
        .gte('created_at', new Date(Date.now() - 60000).toISOString())
        .maybeSingle();

      if (checkError) {
        console.error("[PAYMENT] Check existing order error:", checkError);
        Alert.alert("Database Error", "Failed to check existing transactions: " + checkError.message);
        setLoading(false);
        return;
      }

      if (existingOrder) {
        setLoading(false);
        Alert.alert(
          "Payment in Progress",
          "You already have a pending payment for this amount. Please complete or wait for the previous transaction to finish."
        );
        return;
      }
      
      console.log("[PAYMENT] Creating payment order...");
      const callbackUrl = __DEV__ 
        ? 'https://docs.cashfree.com/docs/payment-success'
        : 'carter://payment-callback';
        
      const { data, error } = await supabase.functions.invoke('create-payment-order', {
        body: {
          amount: value,
          customer_id: user?.id,
          customer_phone: profile?.phone || user?.phone || "9999999999",
          customer_name: profile?.name || "CartR User",
          customer_email: profile?.email || user?.email || "user@cartr.app",
          return_url: callbackUrl,
          idempotency_key: idempotencyKey
        }
      });

      if (error) {
        let errorDetails = "";
        try {
          if (error && typeof error === 'object' && 'context' in error) {
            const context = (error as any).context;
            if (context && typeof context.json === 'function') {
              const json = await context.json();
              errorDetails = JSON.stringify(json);
            } else {
              errorDetails = String(context);
            }
          }
        } catch(e) { errorDetails = "Failed to parse context"; }
        
        console.error("[PAYMENT] Edge Function error:", error.message, errorDetails);
        Alert.alert("Payment Error", "Error: " + (error.message || "Unknown error") + "\nDetails: " + errorDetails);
        setLoading(false);
        return;
      }
      
      if (!data || !data.payment_session_id || !data.order_id) {
        console.error("[PAYMENT] Invalid response:", data);
        Alert.alert("Payment Error", "Payment service returned invalid response. Please try again.");
        setLoading(false);
        return;
      }

      const paymentOrderId = data.order_id;
      const paymentSessionId = data.payment_session_id;
      const env = data.environment || 'sandbox';
      
      // Build Cashfree's own hosted checkout URL directly
      // This bypasses our self-hosted checkout-page Edge Function which has Content-Type issues
      const cashfreeBaseUrl = env === 'production' 
        ? 'https://api.cashfree.com' 
        : 'https://sandbox.cashfree.com';
      const directCheckoutUrl = `${cashfreeBaseUrl}/pg/orders/sessions/pay?payment_session_id=${paymentSessionId}`;
      
      console.log("[PAYMENT] Order created:", paymentOrderId);
      console.log("[PAYMENT] Environment:", env);

      if (paymentSessionId) {
        console.log("[PAYMENT] Opening Cashfree Checkout Modal...");
        setPendingOrderId(paymentOrderId);
        setPaymentSessionId(paymentSessionId);
        setEnvironment(env as 'sandbox' | 'production');
        setModalVisible(false);
        setShowCheckoutModal(true);
      } else {
        Alert.alert("Payment Error", "No payment session received.");
        setLoading(false);
      }

    } catch (err: any) {
      console.error("[PAYMENT] FATAL ERROR:", err);
      Alert.alert("Error", err.message || "Failed to start payment");
      setLoading(false);
      setPendingOrderId(null);
    }
  };

  const predefinedAmounts = [500, 1000, 2000];

  const handleAddMoneyPress = () => {
    console.log("[UI] Add Money button pressed");
    setModalVisible(true);
  };

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
                        onPress={handleAddMoneyPress}
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
                🌐 Browser Checkout (Expo Go)
              </Text>
            )}
        </View>

        {/* Transactions list */}
        <View className="px-5 mt-2">
            <Text className="text-lg font-JakartaBold mb-4">Recent Transactions</Text>
            
            {transactions.length === 0 ? (
              <View className="items-center justify-center py-10 opacity-50">
                  <View className="bg-gray-200 w-16 h-16 rounded-full items-center justify-center mb-3">
                      <Feather name="list" size={24} color="gray" />
                  </View>
                  <Text className="text-gray-500 font-JakartaMedium">No recent transactions</Text>
              </View>
            ) : (
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

      {/* Add Money Modal - Using CORE React Native Modal */}
      <Modal 
        visible={isModalVisible} 
        transparent={true}
        animationType="slide"
        onRequestClose={() => !loading && setModalVisible(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => !loading && setModalVisible(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.modalContent}>
            <View className="flex-row items-center justify-between mb-6">
                <View className="w-10" />
                <View className="w-12 h-1 bg-gray-300 rounded-full" />
                <TouchableOpacity 
                    onPress={() => !loading && setModalVisible(false)}
                    className="w-10 h-10 rounded-full bg-gray-50 items-center justify-center"
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <Feather name="x" size={20} color="#94A3B8" />
                </TouchableOpacity>
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
                    <TouchableOpacity
                        onPress={startPayment}
                        disabled={loading || !amount || parseFloat(amount) <= 0}
                        className={`py-4 rounded-2xl items-center justify-center mb-4 ${
                          amount && parseFloat(amount) > 0 ? 'bg-yellow-500' : 'bg-gray-300'
                        }`}
                        activeOpacity={0.8}
                    >
                        <Text className="text-black font-JakartaBold text-lg">Add Money</Text>
                    </TouchableOpacity>
                    
                    <View className="flex-row justify-center items-center mb-4">
                        <Feather name="lock" size={12} color="#A0A0A0" />
                        <Text className="text-xs text-gray-400 ml-1">Secured by Cashfree Payments</Text>
                    </View>
                </>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Status Modal (Success/Failure) */}
      <Modal 
        visible={statusModalVisible} 
        transparent={true}
        animationType="slide"
        onRequestClose={handleStatusDismiss}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={handleStatusDismiss}
        >
          <TouchableOpacity activeOpacity={1} style={styles.statusModalContent}>
              <TouchableOpacity 
                  onPress={handleStatusDismiss}
                  className="absolute right-5 top-5 w-9 h-9 rounded-full bg-gray-100 items-center justify-center"
                  style={{ zIndex: 10 }}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                  <Feather name="x" size={20} color="#6B7280" />
              </TouchableOpacity>

              <View className="w-12 h-1 bg-gray-300 rounded-full mb-6" />

              <View className={`w-20 h-20 rounded-full items-center justify-center mb-5 ${
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
              
              <Text className="text-gray-500 text-center font-JakartaMedium mb-4 px-4">
                  {statusMessage}
              </Text>

              {statusType === 'failure' && (
                  <View className="bg-red-50 rounded-xl px-4 py-3 mb-6 w-full flex-row items-center">
                      <Feather name="info" size={16} color="#EF4444" />
                      <Text className="text-red-600 text-xs font-JakartaMedium ml-2 flex-1">
                          No amount was deducted. You can safely retry.
                      </Text>
                  </View>
              )}

              {statusType === 'success' && <View className="mb-4" />}

              <TouchableOpacity
                  onPress={handleStatusDismiss}
                  className={`w-full py-4 rounded-2xl items-center justify-center mb-4 ${
                    statusType === 'success' ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  activeOpacity={0.8}
              >
                  <Text className={`font-JakartaBold text-lg ${statusType === 'success' ? 'text-black' : 'text-white'}`}>
                    {statusType === 'success'
                      ? typeof returnTo === 'string' && returnTo.length > 0
                        ? "Back to Booking"
                        : "Done"
                      : "Try Again"}
                  </Text>
              </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Cashfree Checkout Modal */}
      {showCheckoutModal && (
        <CashfreeCheckoutModal
            visible={showCheckoutModal}
            paymentSessionId={paymentSessionId}
            orderId={pendingOrderId || ""}
            environment={environment}
            onSuccess={async (orderId) => {
                console.log("[PAYMENT] SDK Success for order:", orderId);
                setShowCheckoutModal(false);
                setLoading(true);
                await verifyPaymentStatus(orderId);
            }}
            onFailure={async (errorMsg, orderId) => {
                console.log("[PAYMENT] SDK Failure:", errorMsg);
                setShowCheckoutModal(false);
                setLoading(true);
                // Also verify in case it actually succeeded despite error callback
                await verifyPaymentStatus(orderId, true);
            }}
            onClose={() => {
                console.log("[PAYMENT] Checkout Modal closed by user");
                setShowCheckoutModal(false);
                if (pendingOrderId) {
                     verifyPaymentStatus(pendingOrderId);
                }
            }}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
  },
  statusModalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 32,
    alignItems: 'center',
    minHeight: 320,
  },
});

export default Payment;
