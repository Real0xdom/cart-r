import { router } from "expo-router";
import { useState, useRef } from "react";
import { 
    Image, 
    ScrollView, 
    Text, 
    View, 
    Alert, 
    TouchableOpacity, 
    KeyboardAvoidingView, 
    Platform,
    TextInput,
    Dimensions,
    ActivityIndicator
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather, MaterialIcons } from "@expo/vector-icons";

import CustomButton from "@/components/CustomButton";
import { images } from "@/constants";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const CustomerSignIn = () => {
    const { signInWithPhone, verifyOtp } = useAuth();

    const [phone, setPhone] = useState("");
    const [otp, setOtp] = useState("");
    const [countryCode, setCountryCode] = useState("+91");
    const [step, setStep] = useState<'phone' | 'otp'>('phone');
    const [loading, setLoading] = useState(false);
    const [checkingUser, setCheckingUser] = useState(false);
    const [formattedPhoneNumber, setFormattedPhoneNumber] = useState("");

    const phoneInputRef = useRef<TextInput>(null);
    const otpInputRef = useRef<TextInput>(null);

    const formatPhone = (phoneNumber: string) => {
        const cleaned = phoneNumber.replace(/\s+/g, '').replace(/[^0-9]/g, '');
        return `${countryCode}${cleaned}`;
    };

    // Check if user exists by phone number using RPC function (bypasses RLS)
    const checkUserExists = async (formattedPhone: string): Promise<boolean> => {
        try {
            console.log('[SignIn] Checking if user exists for phone:', formattedPhone);
            
            // Use RPC function that bypasses RLS
            const { data, error } = await supabase.rpc('check_phone_exists', {
                phone_number: formattedPhone
            });

            console.log('[SignIn] RPC check_phone_exists result:', { data, error });

            if (error) {
                console.error('Error checking user:', error);
                return false;
            }

            return data === true;
        } catch (err) {
            console.error('Error in checkUserExists:', err);
            return false;
        }
    };

    // Step 1: Check if user exists, then either send OTP or go to registration
    const onLoginPress = async () => {
        if (!phone || phone.length < 10) {
            return Alert.alert("Error", "Please enter a valid 10-digit phone number");
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
                    Alert.alert("Error", error.message);
                } else {
                    Alert.alert("OTP Sent", `We've sent a verification code to ${formatted}`);
                    setStep('otp');
                }
            } else {
                // New user - go to registration screen
                router.push({
                    pathname: "/register",
                    params: { phone: formatted }
                });
            }
        } catch (err: any) {
            Alert.alert("Error", err.message || "Something went wrong");
        } finally {
            setLoading(false);
            setCheckingUser(false);
        }
    };

    // Step 2: Verify OTP for existing users
    const onVerifyOtpPress = async () => {
        if (!otp || otp.length !== 6) {
            return Alert.alert("Error", "Please enter the 6-digit OTP");
        }

        setLoading(true);

        try {
            const { error } = await verifyOtp(formattedPhoneNumber, otp);
            if (error) {
                Alert.alert("Error", error.message);
            } else {
                router.replace("/(tabs)/home");
            }
        } catch (err: any) {
            Alert.alert("Error", err.message || "Invalid OTP");
        } finally {
            setLoading(false);
        }
    };

    const renderPhoneStep = () => (
        <View className="flex-1">
            {/* Hero Image - Centered in upper portion */}
            <View className="items-center justify-center" style={{ height: SCREEN_HEIGHT * 0.35 }}>
                <Image 
                    source={images.loginHero} 
                    className="w-64 h-64 rounded-3xl"
                    resizeMode="cover"
                />
            </View>

            {/* Welcome Text */}
            <View className="items-center px-6 mt-4">
                <Text className="text-3xl font-JakartaBold text-gray-900 mb-2">
                    Welcome to CartR
                </Text>
                <Text className="text-base text-gray-500 text-center font-JakartaMedium">
                    Log in with your valid phone number
                </Text>
            </View>

            {/* Login Form at Bottom */}
            <View className="flex-1 justify-end px-6 pb-8">
                {/* Country Code & Phone Input */}
                <View className="mb-4">
                    <Text className="text-sm font-JakartaSemiBold text-gray-600 mb-2 ml-1">
                        Mobile Number
                    </Text>
                    <View className="flex-row items-center bg-gray-100 rounded-2xl overflow-hidden border border-gray-200">
                        {/* Country Code Selector */}
                        <TouchableOpacity 
                            className="flex-row items-center px-4 py-4 bg-gray-50 border-r border-gray-200"
                            onPress={() => {
                                Alert.alert("Country", "Currently only India (+91) is supported");
                            }}
                        >
                            <Text className="text-lg mr-1">🇮🇳</Text>
                            <Text className="font-JakartaSemiBold text-gray-700">{countryCode}</Text>
                            <Feather name="chevron-down" size={16} color="#666" className="ml-1" />
                        </TouchableOpacity>

                        {/* Phone Number Input */}
                        <TextInput
                            ref={phoneInputRef}
                            className="flex-1 px-4 py-4 text-lg font-JakartaSemiBold"
                            placeholder="Enter phone number"
                            placeholderTextColor="#9CA3AF"
                            value={phone}
                            onChangeText={setPhone}
                            keyboardType="phone-pad"
                            maxLength={10}
                        />
                    </View>
                </View>

                {/* Login Button */}
                <TouchableOpacity
                    onPress={onLoginPress}
                    disabled={loading || checkingUser || phone.length < 10}
                    className={`py-4 rounded-2xl items-center justify-center ${
                        phone.length >= 10 ? 'bg-success-500' : 'bg-gray-300'
                    }`}
                    activeOpacity={0.8}
                >
                    {loading || checkingUser ? (
                        <View className="flex-row items-center">
                            <ActivityIndicator color="#fff" size="small" />
                            <Text className="text-white font-JakartaBold text-lg ml-2">
                                {checkingUser ? "Checking..." : "Sending OTP..."}
                            </Text>
                        </View>
                    ) : (
                        <Text className="text-white font-JakartaBold text-lg">
                            Continue
                        </Text>
                    )}
                </TouchableOpacity>

                <Text className="text-center text-gray-400 text-xs mt-4 font-Jakarta">
                    By continuing, you agree to our Terms of Service and Privacy Policy
                </Text>
            </View>
        </View>
    );

    const renderOtpStep = () => (
        <View className="flex-1 px-6">
            {/* OTP Icon */}
            <View className="items-center mt-16 mb-8">
                <View className="w-24 h-24 bg-success-100 rounded-full items-center justify-center">
                    <MaterialIcons name="sms" size={48} color="#4CAF50" />
                </View>
            </View>

            {/* Title */}
            <Text className="text-2xl font-JakartaBold text-gray-900 text-center mb-2">
                Verify your number
            </Text>
            <Text className="text-gray-500 text-center font-JakartaMedium mb-8">
                Enter the 6-digit code sent to{'\n'}
                <Text className="font-JakartaBold text-gray-700">{formattedPhoneNumber}</Text>
            </Text>

            {/* OTP Input */}
            <View className="mb-6">
                <TextInput
                    ref={otpInputRef}
                    className="bg-gray-100 rounded-2xl px-6 py-4 text-center text-2xl font-JakartaBold tracking-widest border border-gray-200"
                    placeholder="• • • • • •"
                    placeholderTextColor="#9CA3AF"
                    value={otp}
                    onChangeText={setOtp}
                    keyboardType="number-pad"
                    maxLength={6}
                    autoFocus
                />
            </View>

            {/* Verify Button */}
            <TouchableOpacity
                onPress={onVerifyOtpPress}
                disabled={loading || otp.length !== 6}
                className={`py-4 rounded-2xl items-center justify-center ${
                    otp.length === 6 ? 'bg-success-500' : 'bg-gray-300'
                }`}
                activeOpacity={0.8}
            >
                {loading ? (
                    <View className="flex-row items-center">
                        <ActivityIndicator color="#fff" size="small" />
                        <Text className="text-white font-JakartaBold text-lg ml-2">
                            Verifying...
                        </Text>
                    </View>
                ) : (
                    <Text className="text-white font-JakartaBold text-lg">
                        Verify & Continue
                    </Text>
                )}
            </TouchableOpacity>

            {/* Resend OTP */}
            <View className="flex-row justify-center mt-6">
                <Text className="text-gray-500 font-Jakarta">
                    Didn't receive code?{" "}
                </Text>
                <TouchableOpacity 
                    onPress={() => {
                        setLoading(true);
                        signInWithPhone(formattedPhoneNumber)
                            .then(({ error }) => {
                                if (error) Alert.alert("Error", error.message);
                                else Alert.alert("OTP Sent", "New code sent!");
                            })
                            .finally(() => setLoading(false));
                    }}
                    disabled={loading}
                >
                    <Text className="text-success-500 font-JakartaSemiBold">
                        Resend OTP
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
        <SafeAreaView className="flex-1 bg-white">
            <KeyboardAvoidingView 
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                className="flex-1"
            >
                <ScrollView 
                    className="flex-1"
                    contentContainerStyle={{ flexGrow: 1 }}
                    keyboardShouldPersistTaps="handled"
                >
                    {step === 'phone' ? renderPhoneStep() : renderOtpStep()}
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

export default CustomerSignIn;
