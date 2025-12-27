import { router } from "expo-router";
import { useState } from "react";
import { ScrollView, Text, View, Alert, TouchableOpacity, KeyboardAvoidingView, Platform } from "react-native";

import CustomButton from "@/components/CustomButton";
import InputField from "@/components/InputField";
import { icons } from "@/constants";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

const DriverSignIn = () => {
    const { signInWithPhone, verifyOtp } = useAuth();

    const [form, setForm] = useState({
        phone: "+91",
        otp: "",
    });

    const [step, setStep] = useState<'phone' | 'otp'>('phone');
    const [loading, setLoading] = useState(false);

    const formatPhone = (phone: string) => {
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
            const { error, data } = await verifyOtp(formattedPhone, form.otp);
            if (error) {
                Alert.alert("Error", error.message);
            } else {
                // Check if driver record exists
                const { data: driverData } = await supabase
                    .from("drivers")
                    .select("id, verification_status")
                    .eq("user_id", data?.user?.id)
                    .single();

                if (!driverData) {
                    // New driver - go to onboarding
                    router.replace("/onboarding/personal-info");
                } else if (driverData.verification_status === "pending") {
                    // Pending verification
                    router.replace("/onboarding/verification-pending");
                } else if (driverData.verification_status === "rejected") {
                    // Rejected - allow re-upload
                    router.replace("/onboarding/verification-pending");
                } else {
                    // Approved - go to home
                    router.replace("/(tabs)/home");
                }
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
                    {/* Green Header for Driver App */}
                    <View className="w-full h-[220px] bg-green-500 justify-center items-center">
                        <Text className="text-6xl mb-3">🚗</Text>
                        <Text className="text-white text-2xl font-JakartaBold">
                            Carter Driver
                        </Text>
                        <Text className="text-green-100 mt-2">
                            Partner App for Drivers
                        </Text>
                    </View>

                    <View className="p-5">
                        {step === 'phone' ? (
                            <>
                                <View className="mb-6">
                                    <Text className="text-lg font-JakartaSemiBold text-gray-800 mb-2">
                                        Driver Login
                                    </Text>
                                    <Text className="text-gray-500">
                                        Enter your registered mobile number
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
                                    className="mt-6 bg-green-500"
                                    disabled={loading}
                                />

                                <View className="mt-8 p-4 bg-gray-50 rounded-xl">
                                    <Text className="text-gray-600 text-center text-sm">
                                        🚗 Want to become a Carter driver?{"\n"}
                                        Contact us at{" "}
                                        <Text className="text-green-600 font-JakartaSemiBold">
                                            drivers@cart-r.com
                                        </Text>
                                    </Text>
                                </View>
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
                                    title={loading ? "Verifying..." : "Verify & Start Driving"}
                                    onPress={onVerifyOtpPress}
                                    className="mt-6 bg-green-500"
                                    disabled={loading}
                                />

                                <TouchableOpacity 
                                    onPress={() => setStep('phone')} 
                                    className="mt-4 items-center"
                                >
                                    <Text className="text-green-500 font-JakartaSemiBold">
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
                    </View>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
};

export default DriverSignIn;
