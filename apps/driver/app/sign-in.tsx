import { router } from "expo-router";
import { useState } from "react";
import { ScrollView, Text, View, Alert, TouchableOpacity, KeyboardAvoidingView, Platform } from "react-native";

import CustomButton from "@/components/CustomButton";
import InputField from "@/components/InputField";
import { icons } from "@/constants";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/lib/supabase";

const DriverSignIn = () => {
    const { signInWithPhone, verifyOtp, refreshProfile } = useAuth();
    const { t } = useLanguage();

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
            return Alert.alert(t("error"), t("enterValidPhone"));
        }

        const formattedPhone = formatPhone(form.phone);
        setLoading(true);
        
        try {
            const { error } = await signInWithPhone(formattedPhone);
            if (error) {
                Alert.alert(t("error"), error.message);
            } else {
                Alert.alert(t("otpSent"), `${t("otpSentTo")} ${formattedPhone}`);
                setStep('otp');
            }
        } catch (err: any) {
            Alert.alert(t("error"), err.message || t("sendingOtp"));
        } finally {
            setLoading(false);
        }
    };

    const onVerifyOtpPress = async () => {
        if (!form.otp || form.otp.length !== 6) {
            return Alert.alert(t("error"), t("enterSixDigitOtp"));
        }

        const formattedPhone = formatPhone(form.phone);
        setLoading(true);

        try {
            const { error, data } = await verifyOtp(formattedPhone, form.otp);
            if (error) {
                Alert.alert(t("error"), error.message);
            } else {
                // Check if driver record exists - DATABASE IS THE SINGLE SOURCE OF TRUTH
                const { data: driverData } = await supabase
                    .from("drivers")
                    .select("id, verification_status")
                    .eq("user_id", data?.user?.id)
                    .single();

                // Sync AuthContext with database BEFORE navigating
                await refreshProfile();

                if (!driverData) {
                    // New driver - go to onboarding form
                    router.replace("/onboarding/personal-info");
                } else if (driverData.verification_status === "approved") {
                    // ✅ Approved driver - go directly to main app
                    router.replace("/(tabs)/home");
                } else if (driverData.verification_status === "pending") {
                    // ⏳ Pending verification - show pending screen
                    router.replace("/onboarding/verification-pending");
                } else if (driverData.verification_status === "rejected") {
                    // ❌ Rejected - show rejection screen with option to resubmit
                    router.replace("/onboarding/verification-pending");
                } else {
                    // Fallback for any other status - go to home
                    router.replace("/(tabs)/home");
                }
            }
        } catch (err: any) {
            Alert.alert(t("error"), err.message || "Invalid OTP");
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
                            {t("partnerAppForDrivers")}
                        </Text>
                    </View>

                    <View className="p-5">
                        {step === 'phone' ? (
                            <>
                                <View className="mb-6">
                                    <Text className="text-lg font-JakartaSemiBold text-gray-800 mb-2">
                                        {t("driverLogin")}
                                    </Text>
                                    <Text className="text-gray-500">
                                        {t("enterRegisteredMobile")}
                                    </Text>
                                </View>

                                <InputField
                                    label={t("mobileNumber")}
                                    placeholder="+91 9876543210"
                                    icon={icons.email}
                                    value={form.phone}
                                    onChangeText={(value) => setForm({ ...form, phone: value })}
                                    keyboardType="phone-pad"
                                />

                                <CustomButton
                                    title={loading ? t("sendingOtp") : t("getOtp")}
                                    onPress={onSendOtpPress}
                                    className="mt-6 bg-green-500"
                                    disabled={loading}
                                />

                                <View className="mt-8 p-4 bg-gray-50 rounded-xl">
                                    <Text className="text-gray-600 text-center text-sm">
                                        🚗 {t("wantToBecomeDriver")}{"\n"}
                                        {t("contactUsAt")}{" "}
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
                                        {t("verifyYourNumber")}
                                    </Text>
                                    <Text className="text-gray-500">
                                        {t("enterCodeSentTo")} {form.phone}
                                    </Text>
                                </View>

                                <InputField
                                    label={t("verificationCode")}
                                    placeholder={t("enter6DigitOtpPlaceholder")}
                                    icon={icons.lock}
                                    value={form.otp}
                                    onChangeText={(value) => setForm({ ...form, otp: value })}
                                    keyboardType="number-pad"
                                    maxLength={6}
                                />

                                <CustomButton
                                    title={loading ? t("verifying") : t("verifyAndContinue")}
                                    onPress={onVerifyOtpPress}
                                    className="mt-6 bg-green-500"
                                    disabled={loading}
                                />

                                <TouchableOpacity 
                                    onPress={() => setStep('phone')} 
                                    className="mt-4 items-center"
                                >
                                    <Text className="text-green-500 font-JakartaSemiBold">
                                        {t("changePhoneNumber")}
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity 
                                    onPress={onSendOtpPress} 
                                    className="mt-2 items-center"
                                    disabled={loading}
                                >
                                    <Text className="text-gray-400">
                                        {t("resendOtp")}
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
