import { router } from "expo-router";
import { useState } from "react";
import { Image, ScrollView, Text, View, Alert, TouchableOpacity, KeyboardAvoidingView, Platform } from "react-native";

import CustomButton from "@/components/CustomButton";
import InputField from "@/components/InputField";
import { icons, images } from "@/constants";
import { useAuth } from "@/contexts/AuthContext";

const CustomerSignIn = () => {
    const { signInWithPhone, verifyOtp } = useAuth();

    const [form, setForm] = useState({
        phone: "+91",
        otp: "",
        name: "",
    });

    const [step, setStep] = useState<'phone' | 'otp'>('phone');
    const [loading, setLoading] = useState(false);

    const formatPhone = (phone: string) => {
        // Ensure phone starts with +
        if (!phone.startsWith('+')) {
            return '+' + phone;
        }
        return phone;
    };

    const onSendOtpPress = async () => {
        if (!form.phone || form.phone.length < 10) {
            return Alert.alert("Error", "Please enter a valid phone number with country code (e.g., +919876543210)");
        }

        const formattedPhone = formatPhone(form.phone);
        setLoading(true);
        
        try {
            const { error } = await signInWithPhone(formattedPhone);
            if (error) {
                Alert.alert("Error", error.message);
            } else {
                Alert.alert("OTP Sent", `We've sent a verification code to ${formattedPhone}`);
                setStep('otp');
            }
        } catch (err: any) {
            Alert.alert("Error", err.message || "Failed to send OTP");
        } finally {
            setLoading(false);
        }
    };

    const onVerifyOtpPress = async () => {
        if (!form.otp || form.otp.length !== 6) {
            return Alert.alert("Error", "Please enter the 6-digit OTP");
        }

        const formattedPhone = formatPhone(form.phone);
        setLoading(true);

        try {
            const { error } = await verifyOtp(formattedPhone, form.otp);
            if (error) {
                Alert.alert("Error", error.message);
            } else {
                // Success - AuthContext will handle navigation
                router.replace("/(tabs)/home");
            }
        } catch (err: any) {
            Alert.alert("Error", err.message || "Invalid OTP");
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView 
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            className="flex-1"
        >
            <ScrollView className="flex-1 bg-white">
                <View className="flex-1 bg-white">
                    <View className="relative w-full h-[220px]">
                        <Image source={images.onboarding2} className="z-0 w-full h-[220px]" />
                        <View className="absolute bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-black/50">
                            <Text className="text-2xl text-black font-JakartaBold">
                                Welcome to Carter
                            </Text>
                            <Text className="text-gray-600 mt-1">
                                Pune's trusted logistics partner
                            </Text>
                        </View>
                    </View>

                    <View className="p-5">
                        {step === 'phone' ? (
                            <>
                                <View className="mb-6">
                                    <Text className="text-lg font-JakartaSemiBold text-gray-800 mb-2">
                                        Enter your mobile number
                                    </Text>
                                    <Text className="text-gray-500">
                                        We'll send you a verification code via SMS
                                    </Text>
                                </View>

                                <InputField
                                    label="Mobile Number"
                                    placeholder="+91 9876543210"
                                    icon={icons.email}
                                    value={form.phone}
                                    onChangeText={(value) => setForm({ ...form, phone: value })}
                                    keyboardType="phone-pad"
                                />

                                <CustomButton
                                    title={loading ? "Sending OTP..." : "Get OTP"}
                                    onPress={onSendOtpPress}
                                    className="mt-6"
                                    disabled={loading}
                                />
                            </>
                        ) : (
                            <>
                                <View className="mb-6">
                                    <Text className="text-lg font-JakartaSemiBold text-gray-800 mb-2">
                                        Verify your number
                                    </Text>
                                    <Text className="text-gray-500">
                                        Enter the 6-digit code sent to {form.phone}
                                    </Text>
                                </View>

                                <InputField
                                    label="Verification Code"
                                    placeholder="Enter 6-digit OTP"
                                    icon={icons.lock}
                                    value={form.otp}
                                    onChangeText={(value) => setForm({ ...form, otp: value })}
                                    keyboardType="number-pad"
                                    maxLength={6}
                                />

                                <CustomButton
                                    title={loading ? "Verifying..." : "Verify & Continue"}
                                    onPress={onVerifyOtpPress}
                                    className="mt-6"
                                    disabled={loading}
                                />

                                <TouchableOpacity 
                                    onPress={() => setStep('phone')} 
                                    className="mt-4 items-center"
                                >
                                    <Text className="text-primary-500 font-JakartaSemiBold">
                                        Change phone number
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity 
                                    onPress={onSendOtpPress} 
                                    className="mt-2 items-center"
                                    disabled={loading}
                                >
                                    <Text className="text-gray-400">
                                        Resend OTP
                                    </Text>
                                </TouchableOpacity>
                            </>
                        )}

                        <TouchableOpacity 
                            onPress={() => router.replace('/welcome')} 
                            className="mt-10 items-center"
                        >
                            <Text className="text-gray-400">Back to home</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
};

export default CustomerSignIn;
