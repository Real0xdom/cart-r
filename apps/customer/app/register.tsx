import { router, useLocalSearchParams } from "expo-router";
import { useState, useRef } from "react";
import { 
    Text, 
    View, 
    Alert, 
    TouchableOpacity, 
    KeyboardAvoidingView, 
    Platform,
    TextInput,
    ScrollView,
    ActivityIndicator
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather, MaterialIcons } from "@expo/vector-icons";

import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { TermsCheckbox } from "@/components/TermsCheckbox";

const RegisterScreen = () => {
    const params = useLocalSearchParams<{ phone: string }>();
    const phoneNumber = params.phone || "";
    
    const { signInWithPhone, verifyOtp } = useAuth();

    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [email, setEmail] = useState("");
    const [termsAccepted, setTermsAccepted] = useState(false);
    const [whatsappUpdates, setWhatsappUpdates] = useState(true);
    const [otp, setOtp] = useState("");
    const [step, setStep] = useState<'register' | 'otp'>('register');
    const [loading, setLoading] = useState(false);

    const otpInputRef = useRef<TextInput>(null);

    const isFormValid = () => {
        return firstName.trim().length > 0 && 
               lastName.trim().length > 0 && 
               email.trim().length > 0 &&
               email.includes('@') &&
               termsAccepted; // Must accept terms
    };

    const onRegisterPress = async () => {
        if (!isFormValid()) {
            return Alert.alert("Error", "Please fill in all required fields");
        }

        setLoading(true);
        
        try {
            // Send OTP to the phone number
            const { error } = await signInWithPhone(phoneNumber);
            if (error) {
                Alert.alert("Error", error.message);
            } else {
                Alert.alert("OTP Sent", `We've sent a verification code to ${phoneNumber}`);
                setStep('otp');
            }
        } catch (err: any) {
            Alert.alert("Error", err.message || "Failed to send OTP");
        } finally {
            setLoading(false);
        }
    };

    const onVerifyOtpPress = async () => {
        if (!otp || otp.length !== 6) {
            return Alert.alert("Error", "Please enter the 6-digit OTP");
        }

        setLoading(true);

        try {
            // First verify the OTP
            const { error, data } = await supabase.auth.verifyOtp({
                phone: phoneNumber,
                token: otp,
                type: 'sms',
            });

            if (error) {
                Alert.alert("Error", error.message);
                setLoading(false);
                return;
            }

            // OTP verified - now create or update the user profile
            if (data?.user) {
                const userEmail = email.trim() || `${phoneNumber.replace('+', '')}@phone.carter.app`;
                const fullName = `${firstName.trim()} ${lastName.trim()}`;

                // Try to insert first
                const { error: profileError } = await supabase
                    .from('users')
                    .insert({
                        id: data.user.id,
                        email: userEmail,
                        name: fullName,
                        phone: phoneNumber,
                        role: 'customer',
                    });

                if (profileError) {
                    // If duplicate key error, profile already exists - UPDATE it with real data
                    if (profileError.code === '23505') {
                        console.log('Profile already exists, updating with real data...');
                        const { error: updateError } = await supabase
                            .from('users')
                            .update({
                                email: userEmail,
                                name: fullName,
                                phone: phoneNumber,
                            })
                            .eq('id', data.user.id);
                        
                        if (updateError) {
                            console.error('Error updating profile:', updateError);
                        } else {
                            console.log('Profile updated successfully with registration data');
                        }
                    } else {
                        console.error('Error creating profile:', profileError);
                        Alert.alert("Error", "Failed to create profile. Please try again.");
                        setLoading(false);
                        return;
                    }
                }

                // Record terms acceptance
                try {
                    const { error: termsError } = await supabase.rpc('record_terms_acceptance', {
                        p_user_id: data.user.id,
                        p_terms_version: 'v1.0',
                        p_ip_address: null, // IP tracking optional
                        p_user_agent: null, // User agent optional  
                        p_device_info: null // Device info optional
                    });

                    if (termsError) {
                        console.error('Error recording terms acceptance:', termsError);
                        // Don't block signup if this fails, just log it
                    } else {
                        console.log('Terms acceptance recorded successfully');
                    }
                } catch (termsErr: any) {
                    console.error('Exception recording terms:', termsErr);
                    // Non-blocking
                }

                // Success - navigate directly to home (no alert)
                router.replace("/(tabs)/home");
            }
        } catch (err: any) {
            Alert.alert("Error", err.message || "Invalid OTP");
        } finally {
            setLoading(false);
        }
    };

    const renderRegisterStep = () => (
        <ScrollView 
            className="flex-1 px-6"
            contentContainerStyle={{ paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled"
        >
            {/* Header */}
            <View className="mt-8 mb-8">
                <Text className="text-3xl font-JakartaBold text-gray-900 mb-2">
                    Create Account
                </Text>
                <Text className="text-gray-500 font-JakartaMedium">
                    Complete your registration for{'\n'}
                    <Text className="font-JakartaBold text-gray-700">{phoneNumber}</Text>
                </Text>
            </View>

            {/* Form Fields */}
            <View className="space-y-4">
                {/* First Name */}
                <View className="mb-4">
                    <Text className="text-sm font-JakartaSemiBold text-gray-600 mb-2 ml-1">
                        First Name <Text className="text-danger-500">*</Text>
                    </Text>
                    <TextInput
                        className="bg-gray-100 rounded-2xl px-4 py-4 text-base font-JakartaSemiBold border border-gray-200"
                        placeholder="Enter your first name"
                        placeholderTextColor="#9CA3AF"
                        value={firstName}
                        onChangeText={setFirstName}
                        autoCapitalize="words"
                    />
                </View>

                {/* Last Name */}
                <View className="mb-4">
                    <Text className="text-sm font-JakartaSemiBold text-gray-600 mb-2 ml-1">
                        Last Name <Text className="text-danger-500">*</Text>
                    </Text>
                    <TextInput
                        className="bg-gray-100 rounded-2xl px-4 py-4 text-base font-JakartaSemiBold border border-gray-200"
                        placeholder="Enter your last name"
                        placeholderTextColor="#9CA3AF"
                        value={lastName}
                        onChangeText={setLastName}
                        autoCapitalize="words"
                    />
                </View>

                {/* Email */}
                <View className="mb-4">
                    <Text className="text-sm font-JakartaSemiBold text-gray-600 mb-2 ml-1">
                        Email Address <Text className="text-danger-500">*</Text>
                    </Text>
                    <TextInput
                        className="bg-gray-100 rounded-2xl px-4 py-4 text-base font-JakartaSemiBold border border-gray-200"
                        placeholder="Enter your email address"
                        placeholderTextColor="#9CA3AF"
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                    />
                </View>

                {/* Terms & Conditions Checkbox */}
                <TermsCheckbox
                    checked={termsAccepted}
                    onCheckedChange={setTermsAccepted}
                    className="mb-4"
                />

                {/* WhatsApp Updates Checkbox */}
                <TouchableOpacity 
                    onPress={() => setWhatsappUpdates(!whatsappUpdates)}
                    className="flex-row items-center mb-6"
                >
                    <View className={`w-6 h-6 rounded-md border-2 items-center justify-center mr-3 ${
                        whatsappUpdates ? 'bg-success-500 border-success-500' : 'border-gray-300'
                    }`}>
                        {whatsappUpdates && (
                            <Feather name="check" size={14} color="#fff" />
                        )}
                    </View>
                    <Text className="flex-1 text-gray-600 font-JakartaMedium">
                        Allow CartR to send updates on WhatsApp
                    </Text>
                </TouchableOpacity>

                {/* OTP Note */}
                <View className="bg-blue-50 rounded-2xl p-4 flex-row items-start mb-6">
                    <MaterialIcons name="info-outline" size={20} color="#3B82F6" />
                    <Text className="flex-1 ml-3 text-blue-700 font-Jakarta text-sm">
                        One-time password (OTP) will be sent to this number for verification
                    </Text>
                </View>

                {/* Register Button */}
                <TouchableOpacity
                    onPress={onRegisterPress}
                    disabled={loading || !isFormValid()}
                    className={`py-4 rounded-2xl items-center justify-center ${
                        isFormValid() ? 'bg-success-500' : 'bg-gray-300'
                    }`}
                    activeOpacity={0.8}
                >
                    {loading ? (
                        <View className="flex-row items-center">
                            <ActivityIndicator color="#fff" size="small" />
                            <Text className="text-white font-JakartaBold text-lg ml-2">
                                Sending OTP...
                            </Text>
                        </View>
                    ) : (
                        <Text className="text-white font-JakartaBold text-lg">
                            Register
                        </Text>
                    )}
                </TouchableOpacity>
            </View>
        </ScrollView>
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
                <Text className="font-JakartaBold text-gray-700">{phoneNumber}</Text>
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
                            Creating Account...
                        </Text>
                    </View>
                ) : (
                    <Text className="text-white font-JakartaBold text-lg">
                        Verify & Create Account
                    </Text>
                )}
            </TouchableOpacity>

            {/* Resend OTP */}
            <View className="flex-row justify-center mt-6">
                <Text className="text-gray-500 font-Jakarta">
                    Didn't receive code?{" "}
                </Text>
                <TouchableOpacity 
                    onPress={onRegisterPress}
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
                {step === 'register' ? renderRegisterStep() : renderOtpStep()}
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

export default RegisterScreen;
