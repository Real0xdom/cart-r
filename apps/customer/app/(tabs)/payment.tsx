import { useState, useEffect, useRef } from "react";
import { ScrollView, Text, View, TouchableOpacity, TextInput, Alert, ActivityIndicator, AppState } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import Modal from "react-native-modal";
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import CustomButton from "@/components/CustomButton";
import { Platform } from "react-native";

// Check if native SDK is available (only works in dev builds, not Expo Go or Web)
let CFPaymentGatewayService: any = null;
let isNativeSDKAvailable = false;

// Only try to load native SDK on mobile platforms (not web)
if (Platform.OS !== 'web') {
  try {
    // Dynamic import - will fail gracefully in Expo Go
    const cashfreeModule = require('react-native-cashfree-pg-sdk');
    CFPaymentGatewayService = cashfreeModule.CFPaymentGatewayService;
    isNativeSDKAvailable = !!CFPaymentGatewayService;
  } catch (e) {
    console.log("Cashfree native SDK not available, using browser fallback");
    isNativeSDKAvailable = false;
  }
}

const Payment = () => {
  const { user, profile } = useAuth();
  const [balance, setBalance] = useState(0);
  const [isModalVisible, setModalVisible] = useState(false);
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
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
            await handlePaymentSuccess(orderID);
          },
          onError: (error: any, orderID: string) => {
            console.log("Payment Failed:", error, orderID);
            Alert.alert("Payment Failed", error?.message || "Something went wrong");
            setLoading(false);
          },
        });
      } catch (e) {
        console.log("Error setting up native SDK callbacks:", e);
        isNativeSDKAvailable = false;
      }
    }
  }, []);

  // Fetch balance on mount
  useEffect(() => {
    fetchBalance();
  }, [user]);

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

  const verifyPaymentStatus = async (orderId: string) => {
    try {
      // Call backend to verify payment status
      const { data, error } = await supabase.functions.invoke('verify-payment', {
        body: { order_id: orderId }
      });

      if (data?.status === 'PAID') {
        await handlePaymentSuccess(orderId);
      } else if (data?.status === 'FAILED' || data?.status === 'CANCELLED') {
        Alert.alert("Payment Failed", "The payment was not completed. Please try again.");
        setLoading(false);
      }
      // If PENDING or other status, do nothing - user might still be completing payment
    } catch (e) {
      console.log("Error verifying payment:", e);
    } finally {
      setPendingOrderId(null);
    }
  };

  const handlePaymentSuccess = async (orderId: string) => {
    setModalVisible(false);
    setAmount("");
    
    try {
      // Refetch balance from server (backend webhook should have updated it)
      await fetchBalance(); 
      Alert.alert("Success", "Payment successful! Wallet updated.");
    } catch (e) {
      console.error("Error post-payment:", e);
    } finally {
      setLoading(false);
    }
  };

  const startPayment = async () => {
    const value = parseFloat(amount);
    if (!value || value <= 0) {
      Alert.alert("Invalid Amount", "Please enter a valid amount greater than 0.");
      return;
    }

    setLoading(true);
    
    try {
      // 1. Create Order Session via Backend
      const { data, error } = await supabase.functions.invoke('create-payment-order', {
        body: {
          amount: value,
          customer_id: user?.id,
          customer_phone: profile?.phone || user?.phone || "9999999999",
          customer_name: profile?.name || "CartR User",
          customer_email: profile?.email || user?.email || "user@cartr.app",
          return_url: Linking.createURL('/payment-callback') // Deep link for return
        }
      });

      if (error) {
        console.error("Session creation error:", error);
        throw new Error("Failed to initiate payment session. Please try again.");
      }
      
      if (!data || (!data.checkout_url && !data.link_url)) {
        console.error("Invalid response from payment service:", data);
        throw new Error("Payment service returned invalid response. Please try again.");
      }

      // Edge Function returns: link_id, link_url, checkout_url, order_status
      const paymentOrderId = data.link_id;
      const paymentLink = data.checkout_url || data.link_url; // Hosted checkout URL
      const paymentSessionId = data.link_id; // Use link_id as session ID for native SDK

      console.log("Payment order created:", { paymentOrderId, paymentLink });

      // Store order ID for verification when user returns
      setPendingOrderId(paymentOrderId);

      // 2. Try native SDK first, fallback to browser (only on mobile)
      if (Platform.OS !== 'web' && isNativeSDKAvailable && CFPaymentGatewayService) {
        try {
          const { CFDropCheckoutPayment, CFEnvironment, CFPaymentComponentBuilder, CFPaymentModes, CFSession, CFThemeBuilder } = require('react-native-cashfree-pg-sdk');
          
          const session = new CFSession(
            paymentSessionId,
            paymentOrderId,
            CFEnvironment.SANDBOX
          );

          const paymentModes = new CFPaymentComponentBuilder()
            .add(CFPaymentModes.UPI)
            .add(CFPaymentModes.CARD)
            .add(CFPaymentModes.NB)
            .add(CFPaymentModes.WALLET)
            .build();

          const theme = new CFThemeBuilder()
            .setNavigationBarBackgroundColor('#F5B800')
            .setNavigationBarTextColor('#000000')
            .setButtonBackgroundColor('#F5B800')
            .setButtonTextColor('#000000')
            .build();

          const dropPayment = new CFDropCheckoutPayment(session, paymentModes, theme);
          CFPaymentGatewayService.doPayment(dropPayment);
          return;
        } catch (nativeError) {
          console.log("Native SDK failed, falling back to browser:", nativeError);
        }
      }

      // 3. Browser-based fallback (works in Expo Go and production)
      // Use the Cashfree JS Drop-in checkout URL
      const checkoutUrl = paymentLink || `https://sandbox.cashfree.com/pg/orders/${paymentOrderId}`;
      
      console.log("Opening payment URL:", checkoutUrl);
      
      const result = await WebBrowser.openBrowserAsync(checkoutUrl, {
        dismissButtonStyle: 'close',
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
        toolbarColor: '#F5B800',
        controlsColor: '#000000',
      });

      // When browser closes, verify payment status
      if (result.type === 'cancel' || result.type === 'dismiss') {
        // User closed browser - check status
        setTimeout(() => verifyPaymentStatus(paymentOrderId), 1000);
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
                        className="bg-brand-500 px-4 py-2 rounded-full flex-row items-center"
                    >
                        <Feather name="plus" size={16} color="black" />
                        <Text className="font-JakartaBold text-black ml-1 text-sm">Add Money</Text>
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

        {/* Transactions Placeholder */}
        <View className="px-5 mt-2">
            <Text className="text-lg font-JakartaBold mb-4">Recent Transactions</Text>
            
            {/* Empty State */}
            <View className="items-center justify-center py-10 opacity-50">
                <View className="bg-gray-200 w-16 h-16 rounded-full items-center justify-center mb-3">
                    <Feather name="list" size={24} color="gray" />
                </View>
                <Text className="text-gray-500 font-JakartaMedium">No recent transactions</Text>
            </View>
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
    </SafeAreaView>
  );
};

export default Payment;