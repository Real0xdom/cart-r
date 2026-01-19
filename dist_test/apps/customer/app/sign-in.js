"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const expo_router_1 = require("expo-router");
const react_1 = require("react");
const react_native_1 = require("react-native");
const react_native_safe_area_context_1 = require("react-native-safe-area-context");
const vector_icons_1 = require("@expo/vector-icons");
const constants_1 = require("@/constants");
const AuthContext_1 = require("@/contexts/AuthContext");
const supabase_1 = require("@/lib/supabase");
const { height: SCREEN_HEIGHT } = react_native_1.Dimensions.get('window');
const CustomerSignIn = () => {
    const { signInWithPhone, verifyOtp } = (0, AuthContext_1.useAuth)();
    const [phone, setPhone] = (0, react_1.useState)("");
    const [otp, setOtp] = (0, react_1.useState)("");
    const [countryCode, setCountryCode] = (0, react_1.useState)("+91");
    const [step, setStep] = (0, react_1.useState)('phone');
    const [loading, setLoading] = (0, react_1.useState)(false);
    const [checkingUser, setCheckingUser] = (0, react_1.useState)(false);
    const [formattedPhoneNumber, setFormattedPhoneNumber] = (0, react_1.useState)("");
    const phoneInputRef = (0, react_1.useRef)(null);
    const otpInputRef = (0, react_1.useRef)(null);
    const formatPhone = (phoneNumber) => {
        const cleaned = phoneNumber.replace(/\s+/g, '').replace(/[^0-9]/g, '');
        return `${countryCode}${cleaned}`;
    };
    // Check if user exists by phone number using RPC function (bypasses RLS)
    const checkUserExists = async (formattedPhone) => {
        try {
            console.log('[SignIn] Checking if user exists for phone:', formattedPhone);
            // Use RPC function that bypasses RLS
            const { data, error } = await supabase_1.supabase.rpc('check_phone_exists', {
                phone_number: formattedPhone
            });
            console.log('[SignIn] RPC check_phone_exists result:', { data, error });
            if (error) {
                console.error('Error checking user:', error);
                return false;
            }
            return data === true;
        }
        catch (err) {
            console.error('Error in checkUserExists:', err);
            return false;
        }
    };
    // Step 1: Check if user exists, then either send OTP or go to registration
    const onLoginPress = async () => {
        if (!phone || phone.length < 10) {
            return react_native_1.Alert.alert("Error", "Please enter a valid 10-digit phone number");
        }
        const formatted = formatPhone(phone);
        setFormattedPhoneNumber(formatted);
        setCheckingUser(true);
        try {
            const userExists = await checkUserExists(formatted);
            console.log('[SignIn] User exists:', userExists);
            if (userExists) {
                // Existing user - send OTP
                setLoading(true);
                const { error } = await signInWithPhone(formatted);
                if (error) {
                    react_native_1.Alert.alert("Error", error.message);
                }
                else {
                    react_native_1.Alert.alert("OTP Sent", `We've sent a verification code to ${formatted}`);
                    setStep('otp');
                }
            }
            else {
                // New user - go to registration screen
                expo_router_1.router.push({
                    pathname: "/register",
                    params: { phone: formatted }
                });
            }
        }
        catch (err) {
            react_native_1.Alert.alert("Error", err.message || "Something went wrong");
        }
        finally {
            setLoading(false);
            setCheckingUser(false);
        }
    };
    // Step 2: Verify OTP for existing users
    const onVerifyOtpPress = async () => {
        if (!otp || otp.length !== 6) {
            return react_native_1.Alert.alert("Error", "Please enter the 6-digit OTP");
        }
        setLoading(true);
        try {
            const { error } = await verifyOtp(formattedPhoneNumber, otp);
            if (error) {
                react_native_1.Alert.alert("Error", error.message);
            }
            else {
                expo_router_1.router.replace("/(tabs)/home");
            }
        }
        catch (err) {
            react_native_1.Alert.alert("Error", err.message || "Invalid OTP");
        }
        finally {
            setLoading(false);
        }
    };
    const renderPhoneStep = () => (<react_native_1.View className="flex-1">
            {/* Hero Image - Centered in upper portion */}
            <react_native_1.View className="items-center justify-center" style={{ height: SCREEN_HEIGHT * 0.35 }}>
                <react_native_1.Image source={constants_1.images.loginHero} className="w-64 h-64 rounded-3xl" resizeMode="cover"/>
            </react_native_1.View>

            {/* Welcome Text */}
            <react_native_1.View className="items-center px-6 mt-4">
                <react_native_1.Text className="text-3xl font-JakartaBold text-gray-900 mb-2">
                    Welcome to CartR
                </react_native_1.Text>
                <react_native_1.Text className="text-base text-gray-500 text-center font-JakartaMedium">
                    Log in with your valid phone number
                </react_native_1.Text>
            </react_native_1.View>

            {/* Login Form at Bottom */}
            <react_native_1.View className="flex-1 justify-end px-6 pb-8">
                {/* Country Code & Phone Input */}
                <react_native_1.View className="mb-4">
                    <react_native_1.Text className="text-sm font-JakartaSemiBold text-gray-600 mb-2 ml-1">
                        Mobile Number
                    </react_native_1.Text>
                    <react_native_1.View className="flex-row items-center bg-gray-100 rounded-2xl overflow-hidden border border-gray-200">
                        {/* Country Code Selector */}
                        <react_native_1.TouchableOpacity className="flex-row items-center px-4 py-4 bg-gray-50 border-r border-gray-200" onPress={() => {
            react_native_1.Alert.alert("Country", "Currently only India (+91) is supported");
        }}>
                            <react_native_1.Text className="text-lg mr-1">🇮🇳</react_native_1.Text>
                            <react_native_1.Text className="font-JakartaSemiBold text-gray-700">{countryCode}</react_native_1.Text>
                            <vector_icons_1.Feather name="chevron-down" size={16} color="#666" className="ml-1"/>
                        </react_native_1.TouchableOpacity>

                        {/* Phone Number Input */}
                        <react_native_1.TextInput ref={phoneInputRef} className="flex-1 px-4 py-4 text-lg font-JakartaSemiBold" placeholder="Enter phone number" placeholderTextColor="#9CA3AF" value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={10}/>
                    </react_native_1.View>
                </react_native_1.View>

                {/* Login Button */}
                <react_native_1.TouchableOpacity onPress={onLoginPress} disabled={loading || checkingUser || phone.length < 10} className={`py-4 rounded-2xl items-center justify-center ${phone.length >= 10 ? 'bg-success-500' : 'bg-gray-300'}`} activeOpacity={0.8}>
                    {loading || checkingUser ? (<react_native_1.View className="flex-row items-center">
                            <react_native_1.ActivityIndicator color="#fff" size="small"/>
                            <react_native_1.Text className="text-white font-JakartaBold text-lg ml-2">
                                {checkingUser ? "Checking..." : "Sending OTP..."}
                            </react_native_1.Text>
                        </react_native_1.View>) : (<react_native_1.Text className="text-white font-JakartaBold text-lg">
                            Continue
                        </react_native_1.Text>)}
                </react_native_1.TouchableOpacity>

                <react_native_1.Text className="text-center text-gray-400 text-xs mt-4 font-Jakarta">
                    By continuing, you agree to our Terms of Service and Privacy Policy
                </react_native_1.Text>
            </react_native_1.View>
        </react_native_1.View>);
    const renderOtpStep = () => (<react_native_1.View className="flex-1 px-6">
            {/* OTP Icon */}
            <react_native_1.View className="items-center mt-16 mb-8">
                <react_native_1.View className="w-24 h-24 bg-success-100 rounded-full items-center justify-center">
                    <vector_icons_1.MaterialIcons name="sms" size={48} color="#4CAF50"/>
                </react_native_1.View>
            </react_native_1.View>

            {/* Title */}
            <react_native_1.Text className="text-2xl font-JakartaBold text-gray-900 text-center mb-2">
                Verify your number
            </react_native_1.Text>
            <react_native_1.Text className="text-gray-500 text-center font-JakartaMedium mb-8">
                Enter the 6-digit code sent to{'\n'}
                <react_native_1.Text className="font-JakartaBold text-gray-700">{formattedPhoneNumber}</react_native_1.Text>
            </react_native_1.Text>

            {/* OTP Input */}
            <react_native_1.View className="mb-6">
                <react_native_1.TextInput ref={otpInputRef} className="bg-gray-100 rounded-2xl px-6 py-4 text-center text-2xl font-JakartaBold tracking-widest border border-gray-200" placeholder="• • • • • •" placeholderTextColor="#9CA3AF" value={otp} onChangeText={setOtp} keyboardType="number-pad" maxLength={6} autoFocus/>
            </react_native_1.View>

            {/* Verify Button */}
            <react_native_1.TouchableOpacity onPress={onVerifyOtpPress} disabled={loading || otp.length !== 6} className={`py-4 rounded-2xl items-center justify-center ${otp.length === 6 ? 'bg-success-500' : 'bg-gray-300'}`} activeOpacity={0.8}>
                {loading ? (<react_native_1.View className="flex-row items-center">
                        <react_native_1.ActivityIndicator color="#fff" size="small"/>
                        <react_native_1.Text className="text-white font-JakartaBold text-lg ml-2">
                            Verifying...
                        </react_native_1.Text>
                    </react_native_1.View>) : (<react_native_1.Text className="text-white font-JakartaBold text-lg">
                        Verify & Continue
                    </react_native_1.Text>)}
            </react_native_1.TouchableOpacity>

            {/* Resend OTP */}
            <react_native_1.View className="flex-row justify-center mt-6">
                <react_native_1.Text className="text-gray-500 font-Jakarta">
                    Didn't receive code?{" "}
                </react_native_1.Text>
                <react_native_1.TouchableOpacity onPress={() => {
            setLoading(true);
            signInWithPhone(formattedPhoneNumber)
                .then(({ error }) => {
                if (error)
                    react_native_1.Alert.alert("Error", error.message);
                else
                    react_native_1.Alert.alert("OTP Sent", "New code sent!");
            })
                .finally(() => setLoading(false));
        }} disabled={loading}>
                    <react_native_1.Text className="text-success-500 font-JakartaSemiBold">
                        Resend OTP
                    </react_native_1.Text>
                </react_native_1.TouchableOpacity>
            </react_native_1.View>
        </react_native_1.View>);
    return (<react_native_safe_area_context_1.SafeAreaView className="flex-1 bg-white">
            <react_native_1.KeyboardAvoidingView behavior={react_native_1.Platform.OS === "ios" ? "padding" : "height"} className="flex-1">
                <react_native_1.ScrollView className="flex-1" contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
                    {step === 'phone' ? renderPhoneStep() : renderOtpStep()}
                </react_native_1.ScrollView>
            </react_native_1.KeyboardAvoidingView>
        </react_native_safe_area_context_1.SafeAreaView>);
};
exports.default = CustomerSignIn;
