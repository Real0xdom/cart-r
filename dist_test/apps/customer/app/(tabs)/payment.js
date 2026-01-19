"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = require("react");
const react_native_1 = require("react-native");
const react_native_safe_area_context_1 = require("react-native-safe-area-context");
const vector_icons_1 = require("@expo/vector-icons");
const react_native_modal_1 = __importDefault(require("react-native-modal"));
const AuthContext_1 = require("@/contexts/AuthContext");
const supabase_1 = require("@/lib/supabase");
const CustomButton_1 = __importDefault(require("@/components/CustomButton"));
// Check if WebView is available (only works in dev builds, not Expo Go)
let CashfreeCheckoutModal = null;
let isWebViewAvailable = false;
if (react_native_1.Platform.OS !== 'web') {
    try {
        // This will fail in Expo Go since WebView requires native code
        require('react-native-webview');
        CashfreeCheckoutModal = require('@/components/CashfreeCheckoutModal').default;
        isWebViewAvailable = true;
        console.log("WebView available - popup checkout enabled");
    }
    catch (e) {
        console.log("WebView not available (Expo Go?) - using browser checkout fallback");
        isWebViewAvailable = false;
    }
}
// Check if native SDK is available (only works in dev builds, not Expo Go or Web)
let CFPaymentGatewayService = null;
let isNativeSDKAvailable = false;
// Only try to load native SDK on mobile platforms (not web)
if (react_native_1.Platform.OS !== 'web') {
    try {
        // Dynamic import - will fail gracefully in Expo Go or if not linked
        const cashfreeModule = require('react-native-cashfree-pg-sdk');
        if (cashfreeModule && cashfreeModule.CFPaymentGatewayService) {
            CFPaymentGatewayService = cashfreeModule.CFPaymentGatewayService;
            isNativeSDKAvailable = true;
            console.log("Cashfree native SDK loaded successfully");
        }
    }
    catch (e) {
        console.log("Cashfree native SDK not available:", (e === null || e === void 0 ? void 0 : e.message) || e);
        isNativeSDKAvailable = false;
    }
}
const Payment = () => {
    const { user, profile } = (0, AuthContext_1.useAuth)();
    const [balance, setBalance] = (0, react_1.useState)(0);
    const [transactions, setTransactions] = (0, react_1.useState)([]);
    const [isModalVisible, setModalVisible] = (0, react_1.useState)(false);
    // Status Modal State
    const [statusModalVisible, setStatusModalVisible] = (0, react_1.useState)(false);
    const [statusType, setStatusType] = (0, react_1.useState)('success');
    const [statusMessage, setStatusMessage] = (0, react_1.useState)("");
    const [amount, setAmount] = (0, react_1.useState)("");
    const [loading, setLoading] = (0, react_1.useState)(false);
    const [pendingOrderId, setPendingOrderId] = (0, react_1.useState)(null);
    // Popup checkout state
    const [showCheckoutModal, setShowCheckoutModal] = (0, react_1.useState)(false);
    const [checkoutSessionId, setCheckoutSessionId] = (0, react_1.useState)("");
    const [checkoutOrderId, setCheckoutOrderId] = (0, react_1.useState)("");
    const [checkoutEnvironment, setCheckoutEnvironment] = (0, react_1.useState)('sandbox');
    const appState = (0, react_1.useRef)(react_native_1.AppState.currentState);
    // Listen for app state changes (when user returns from browser)
    (0, react_1.useEffect)(() => {
        const subscription = react_native_1.AppState.addEventListener('change', nextAppState => {
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
    (0, react_1.useEffect)(() => {
        if (isNativeSDKAvailable && CFPaymentGatewayService) {
            try {
                CFPaymentGatewayService.setCallback({
                    onVerify: async (orderID) => {
                        console.log("Order Verified:", orderID);
                        // Verify against backend to ensure DB is updated (balance + transactions)
                        await verifyPaymentStatus(orderID);
                    },
                    onError: async (error, orderID) => {
                        console.log("Payment Failed:", error, orderID);
                        // 1. Sync DB status (Mark as Failed explicitly via cancel function)
                        try {
                            await supabase_1.supabase.functions.invoke('cancel-payment-order', {
                                body: { order_id: orderID, reason: error === null || error === void 0 ? void 0 : error.message }
                            });
                            // Force refresh list to show "Failed"
                            await fetchTransactions();
                        }
                        catch (e) {
                            console.log("Error cancelling order:", e);
                        }
                        // 2. Force show failure UI
                        setLoading(false);
                        setStatusType('failure');
                        setStatusMessage((error === null || error === void 0 ? void 0 : error.message) || "Payment could not be completed.");
                        setStatusModalVisible(true);
                    },
                });
            }
            catch (e) {
                console.log("Error setting up native SDK callbacks:", e);
                isNativeSDKAvailable = false;
            }
        }
        // Cleanup: Remove callbacks when component unmounts (per official Cashfree docs)
        return () => {
            if (isNativeSDKAvailable && CFPaymentGatewayService) {
                try {
                    CFPaymentGatewayService.removeCallback();
                }
                catch (e) {
                    console.log("Error removing SDK callbacks:", e);
                }
            }
        };
    }, [user]);
    // Fetch data on mount
    (0, react_1.useEffect)(() => {
        if (user) {
            fetchBalance();
            fetchTransactions();
        }
    }, [user]);
    const fetchTransactions = async () => {
        if (!user)
            return;
        try {
            const { data, error } = await supabase_1.supabase
                .from('wallet_transactions')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(10);
            if (data) {
                setTransactions(data);
            }
        }
        catch (e) {
            console.log("Error fetching transactions:", e);
        }
    };
    const fetchBalance = async () => {
        if (!user)
            return;
        try {
            const { data, error } = await supabase_1.supabase
                .from('users')
                .select('balance')
                .eq('id', user.id)
                .single();
            if (data) {
                setBalance(data.balance || 0);
            }
        }
        catch (e) {
            console.log("Error fetching balance:", e);
        }
    };
    const verifyPaymentStatus = async (orderId, forceFail = false) => {
        try {
            // Call backend to verify payment status
            const { data, error } = await supabase_1.supabase.functions.invoke('verify-payment', {
                body: {
                    order_id: orderId,
                    force_fail: forceFail // Signal backend to mark as failed if currently pending
                }
            });
            // Always update history so "Pending" changes to "Failed" or "Completed"
            await fetchTransactions();
            if ((data === null || data === void 0 ? void 0 : data.status) === 'PAID') {
                await handlePaymentSuccess(orderId, data.amount);
            }
            else if ((data === null || data === void 0 ? void 0 : data.status) === 'FAILED' || (data === null || data === void 0 ? void 0 : data.status) === 'CANCELLED') {
                setLoading(false);
                setStatusType('failure');
                setStatusMessage((data === null || data === void 0 ? void 0 : data.order_status) === 'CANCELLED' ? "Payment Cancelled" : "Payment Failed");
                setStatusModalVisible(true);
            }
            else {
                // Still Pending
                setLoading(false);
            }
        }
        catch (e) {
            console.log("Error verifying payment:", e);
            setLoading(false);
        }
        finally {
            setPendingOrderId(null);
        }
    };
    const handlePaymentSuccess = async (orderId, confirmedAmount) => {
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
        }
        catch (e) {
            console.error("Error post-payment:", e);
        }
    };
    const startPayment = async () => {
        const value = parseFloat(amount);
        if (!value || value <= 0) {
            react_native_1.Alert.alert("Invalid Amount", "Please enter a valid amount greater than 0.");
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
            const { data, error } = await supabase_1.supabase.functions.invoke('create-payment-order', {
                body: {
                    amount: value,
                    customer_id: user === null || user === void 0 ? void 0 : user.id,
                    customer_phone: (profile === null || profile === void 0 ? void 0 : profile.phone) || (user === null || user === void 0 ? void 0 : user.phone) || "9999999999",
                    customer_name: (profile === null || profile === void 0 ? void 0 : profile.name) || "CartR User",
                    customer_email: (profile === null || profile === void 0 ? void 0 : profile.email) || (user === null || user === void 0 ? void 0 : user.email) || "user@cartr.app",
                    return_url: callbackUrl
                }
            });
            if (error) {
                // Detailed logging for FunctionsHttpError
                if (error && typeof error === 'object' && 'context' in error) {
                    const context = error.context;
                    if (context && typeof context.json === 'function') {
                        context.json().then((json) => console.error("Edge Function Error Details:", json));
                    }
                    else {
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
            if (react_native_1.Platform.OS !== 'web' && isNativeSDKAvailable && CFPaymentGatewayService) {
                try {
                    console.log("Attempting native SDK payment...");
                    // Import from contract package
                    const { CFSession, CFEnvironment, CFDropCheckoutPayment, CFThemeBuilder, CFTheme } = require('cashfree-pg-api-contract');
                    const sdkEnv = env === 'production' ? CFEnvironment.PRODUCTION : CFEnvironment.SANDBOX;
                    // Create Session
                    const session = new CFSession(paymentSessionId, paymentOrderId, sdkEnv);
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
                    const dropPayment = new CFDropCheckoutPayment(session, null, // component (payment modes) - null for all
                    null // theme - null for default
                    );
                    // Initiate Native Payment
                    console.log("Launching CFPaymentGatewayService.doPayment...");
                    CFPaymentGatewayService.doPayment(dropPayment);
                    console.log("Native Payment Initiated");
                }
                catch (nativeError) {
                    console.error("Native SDK Error:", nativeError);
                    react_native_1.Alert.alert("Payment Error", "Could not initialize payment SDK: " + nativeError.message);
                }
            }
            else {
                // Fallback for when SDK is missing (e.g. running in Expo Go by mistake)
                react_native_1.Alert.alert("Development Build Required", "Cashfree Native SDK is not installed. You are likely running in Expo Go.\n\nPlease run this in the Development Build APK.");
            }
        }
        catch (err) {
            console.error("Start payment error:", err);
            react_native_1.Alert.alert("Error", err.message || "Failed to start payment");
            setLoading(false);
            setPendingOrderId(null);
        }
    };
    const predefinedAmounts = [500, 1000, 2000];
    return (<react_native_safe_area_context_1.SafeAreaView className="flex-1 bg-general-900">
      <react_native_1.ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Header */}
        <react_native_1.View className="p-5">
            <react_native_1.Text className="text-2xl font-JakartaBold mb-5">Payment</react_native_1.Text>
            
            {/* Wallet Card */}
            <react_native_1.View className="bg-black rounded-[24px] p-6 shadow-lg relative overflow-hidden">
                <react_native_1.View className="absolute right-0 top-0 w-32 h-32 bg-gray-800 rounded-full -mr-10 -mt-10 opacity-20"/>
                <react_native_1.View className="absolute left-0 bottom-0 w-24 h-24 bg-brand-500 rounded-full -ml-8 -mb-8 opacity-20"/>
                
                <react_native_1.Text className="text-gray-400 font-JakartaMedium text-sm">CartR Credit Balance</react_native_1.Text>
                <react_native_1.Text className="text-white font-JakartaExtraBold text-4xl mt-2">
                    ₹ {balance.toFixed(2)}
                </react_native_1.Text>

                <react_native_1.View className="mt-8 flex-row items-center justify-between">
                    <react_native_1.View className="flex-row items-center">
                        <react_native_1.View className="bg-gray-800 w-8 h-8 rounded-full items-center justify-center mr-2">
                            <vector_icons_1.Feather name="shield" size={14} color="#F5B800"/>
                        </react_native_1.View>
                        <react_native_1.Text className="text-gray-400 text-xs">Secure & Encrypted</react_native_1.Text>
                    </react_native_1.View>
                    
                    <react_native_1.TouchableOpacity onPress={() => setModalVisible(true)} className="bg-green-500 px-4 py-2 rounded-full flex-row items-center">
                        <vector_icons_1.Feather name="plus" size={16} color="white"/>
                        <react_native_1.Text className="font-JakartaBold text-white ml-1 text-sm">Add Money</react_native_1.Text>
                    </react_native_1.TouchableOpacity>
                </react_native_1.View>
            </react_native_1.View>
            
            {/* SDK Status Indicator (for debugging) */}
            {__DEV__ && (<react_native_1.Text className="text-xs text-gray-400 mt-2 text-center">
                {isNativeSDKAvailable ? "🟢 Native SDK" : "🌐 Browser Checkout"}
              </react_native_1.Text>)}
        </react_native_1.View>

        {/* Transactions list */}
        <react_native_1.View className="px-5 mt-2">
            <react_native_1.Text className="text-lg font-JakartaBold mb-4">Recent Transactions</react_native_1.Text>
            
            {transactions.length === 0 ? (
        /* Empty State */
        <react_native_1.View className="items-center justify-center py-10 opacity-50">
                  <react_native_1.View className="bg-gray-200 w-16 h-16 rounded-full items-center justify-center mb-3">
                      <vector_icons_1.Feather name="list" size={24} color="gray"/>
                  </react_native_1.View>
                  <react_native_1.Text className="text-gray-500 font-JakartaMedium">No recent transactions</react_native_1.Text>
              </react_native_1.View>) : (
        /* Transaction List */
        <react_native_1.View>
                {transactions.map((txn) => (<react_native_1.View key={txn.id} className="flex-row items-center justify-between py-4 border-b border-gray-100">
                    <react_native_1.View className="flex-row items-center flex-1">
                      <react_native_1.View className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${txn.type === 'credit' ? 'bg-green-100' : 'bg-red-100'}`}>
                        <vector_icons_1.Feather name={txn.type === 'credit' ? 'arrow-down-left' : 'arrow-up-right'} size={18} color={txn.type === 'credit' ? '#10B981' : '#EF4444'}/>
                      </react_native_1.View>
                      <react_native_1.View className="flex-1">
                        <react_native_1.Text className="font-JakartaBold text-gray-800 text-sm">
                          {txn.description || (txn.type === 'credit' ? 'Wallet Top-up' : 'Payment')}
                        </react_native_1.Text>
                        <react_native_1.Text className="text-xs text-gray-500">
                          {new Date(txn.created_at).toLocaleDateString()} • {new Date(txn.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </react_native_1.Text>
                      </react_native_1.View>
                    </react_native_1.View>
                    <react_native_1.View className="items-end">
                      <react_native_1.Text className={`font-JakartaBold ${txn.type === 'credit' ? 'text-green-600' : 'text-gray-900'}`}>
                        {txn.type === 'credit' ? '+' : '-'} ₹{parseFloat(txn.amount).toFixed(2)}
                      </react_native_1.Text>
                      <react_native_1.Text className={`text-[10px] uppercase font-JakartaBold ${txn.status === 'completed' ? 'text-green-600' :
                    txn.status === 'failed' ? 'text-red-500' : 'text-orange-500'}`}>
                        {txn.status}
                      </react_native_1.Text>
                    </react_native_1.View>
                  </react_native_1.View>))}
              </react_native_1.View>)}
        </react_native_1.View>
      </react_native_1.ScrollView>

      {/* Add Money Modal */}
      <react_native_modal_1.default isVisible={isModalVisible} onBackdropPress={() => !loading && setModalVisible(false)} style={{ margin: 0, justifyContent: 'flex-end' }} onSwipeComplete={() => !loading && setModalVisible(false)} swipeDirection={['down']}>
        <react_native_1.View className="bg-white rounded-t-[32px] p-6 h-auto">
            <react_native_1.View className="items-center mb-6">
                <react_native_1.View className="w-12 h-1 bg-gray-300 rounded-full"/>
            </react_native_1.View>

            {loading ? (<react_native_1.View className="py-10 items-center">
                    <react_native_1.ActivityIndicator size="large" color="#F5B800"/>
                    <react_native_1.Text className="mt-4 font-JakartaMedium text-gray-600">Opening Payment Gateway...</react_native_1.Text>
                 </react_native_1.View>) : (<>
                    <react_native_1.Text className="text-xl font-JakartaBold text-center mb-2">Add Money to Wallet</react_native_1.Text>
                    <react_native_1.Text className="text-gray-500 text-center text-sm mb-8">Enter amount to top up your CartR balance</react_native_1.Text>

                    <react_native_1.View className="items-center mb-8">
                        <react_native_1.View className="flex-row items-center">
                            <react_native_1.Text className="text-4xl font-JakartaExtraBold">₹ </react_native_1.Text>
                            <react_native_1.TextInput value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder="0" placeholderTextColor="#E2E8F0" autoFocus className="text-4xl font-JakartaExtraBold text-black min-w-[100px]" style={{ height: 60 }}/>
                        </react_native_1.View>
                    </react_native_1.View>

                    {/* Quick Select Chips */}
                    <react_native_1.View className="flex-row justify-between mb-8">
                        {predefinedAmounts.map((val) => (<react_native_1.TouchableOpacity key={val} onPress={() => setAmount(val.toString())} className={`flex-1 py-3 rounded-xl border mx-2 items-center ${amount === val.toString() ? 'bg-brand-100 border-brand-500' : 'bg-white border-gray-200'}`}>
                                <react_native_1.Text className={`font-JakartaBold ${amount === val.toString() ? 'text-black' : 'text-gray-600'}`}>₹{val}</react_native_1.Text>
                            </react_native_1.TouchableOpacity>))}
                    </react_native_1.View>

                    {/* Action Button */}
                    <CustomButton_1.default title="Add Money" onPress={startPayment} className="w-full bg-brand-500 mb-4" textVariant="primary"/>
                    
                    <react_native_1.View className="flex-row justify-center items-center mb-4">
                        <vector_icons_1.Feather name="lock" size={12} color="#A0A0A0"/>
                        <react_native_1.Text className="text-xs text-gray-400 ml-1">Secured by Cashfree Payments</react_native_1.Text>
                    </react_native_1.View>
                </>)}
        </react_native_1.View>
      </react_native_modal_1.default>

      {/* Cashfree Popup Checkout Modal - Only render when WebView is available */}
      {isWebViewAvailable && CashfreeCheckoutModal && (<CashfreeCheckoutModal visible={showCheckoutModal} paymentSessionId={checkoutSessionId} orderId={checkoutOrderId} environment={checkoutEnvironment} onSuccess={async (orderId, paymentDetails) => {
                console.log("Payment successful:", orderId, paymentDetails);
                setShowCheckoutModal(false);
                // Verify against backend to ensure DB is updated
                await verifyPaymentStatus(orderId);
            }} onFailure={(error, orderId) => {
                console.log("Payment failed:", error, orderId);
                setShowCheckoutModal(false);
                setLoading(false);
                react_native_1.Alert.alert("Payment Failed", error || "The payment could not be completed. Please try again.");
            }} onClose={() => {
                console.log("Checkout modal closed by user");
                setShowCheckoutModal(false);
                setLoading(false);
                // Optionally verify payment status in case user completed payment
                if (checkoutOrderId) {
                    setTimeout(() => verifyPaymentStatus(checkoutOrderId), 500);
                }
            }}/>)}
      {/* Status Modal (Success/Failure) */}
      <react_native_modal_1.default isVisible={statusModalVisible} onBackdropPress={() => setStatusModalVisible(false)} animationIn="fadeInUp" animationOut="fadeOutDown" className="m-0 justify-end">
        <react_native_1.View className="bg-white rounded-t-[32px] p-8 items-center h-auto min-h-[300px]">
            <react_native_1.View className={`w-20 h-20 rounded-full items-center justify-center mb-6 ${statusType === 'success' ? 'bg-green-100' : 'bg-red-100'}`}>
                <vector_icons_1.Feather name={statusType === 'success' ? 'check' : 'x'} size={40} color={statusType === 'success' ? '#10B981' : '#EF4444'}/>
            </react_native_1.View>
            
            <react_native_1.Text className="text-2xl font-JakartaBold mb-2 text-center text-gray-900">
                {statusType === 'success' ? 'Payment Successful' : 'Payment Failed'}
            </react_native_1.Text>
            
            <react_native_1.Text className="text-gray-500 text-center font-JakartaMedium mb-8">
                {statusMessage}
            </react_native_1.Text>

            <CustomButton_1.default title={statusType === 'success' ? "Done" : "Try Again"} onPress={() => setStatusModalVisible(false)} className={`w-full ${statusType === 'success' ? 'bg-brand-500' : 'bg-gray-200'} mb-4`} textVariant={statusType === 'success' ? 'primary' : 'secondary'}/>
        </react_native_1.View>
      </react_native_modal_1.default>
    </react_native_safe_area_context_1.SafeAreaView>);
};
exports.default = Payment;
