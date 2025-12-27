import { router } from "expo-router";
import { useState } from "react";
import { Image, ScrollView, Text, View, Alert, TouchableOpacity } from "react-native";

import CustomButton from "@/components/CustomButton";
import InputField from "@/components/InputField";
import { icons, images } from "@/constants";
import { useAuth } from "@/contexts/AuthContext";

const DriverSignIn = () => {
    const { signInWithWhatsApp, verifyWhatsAppOtp } = useAuth();

    const [form, setForm] = useState({
        phone: "",
        otp: "",
    });

    const [step, setStep] = useState<'phone' | 'otp'>('phone');
    const [loading, setLoading] = useState(false);

    const onSignInPress = async () => {
        if (!form.phone) return Alert.alert("Error", "Please enter phone number");

        setLoading(true);
        try {
            const { error } = await signInWithWhatsApp(form.phone);
            if (error) {
                Alert.alert("Error", error.message);
            } else {
                setStep('otp');
            }
        } catch (err: any) {
            Alert.alert("Error", err.message);
        } finally {
            setLoading(false);
        }
    };

    const onVerifyPress = async () => {
        if (!form.otp) return Alert.alert("Error", "Please enter OTP");

        setLoading(true);
        const targetRole = 'driver';

        try {
            const { error } = await verifyWhatsAppOtp(form.phone, form.otp, targetRole);
            if (error) {
                Alert.alert("Error", error.message);
            } else {
                // Success
                // Check if driver logic needs additional steps, otherwise _layout redirect handles it
            }
        } catch (err: any) {
            Alert.alert("Error", err.message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <ScrollView className="flex-1 bg-white">
            <View className="flex-1 bg-white">
                <View className="relative w-full h-[250px]">
                    {/* Use existing image or different one if available. Could use onboarding images */}
                    <Image source={images.signUpCar} className="z-0 w-full h-[250px]" />
                    <Text className="text-2xl text-black font-JakartaSemiBold absolute bottom-5 left-5">
                        Welcome Driver 👋
                    </Text>
                </View>

                <View className="p-5">
                    {step === 'phone' ? (
                        <>
                            <View className="mb-6">
                                <Text className="text-gray-500 mb-2">Login or Register with WhatsApp to start earning.</Text>
                            </View>

                            <InputField
                                label="WhatsApp Number"
                                placeholder="Enter phone: +91 98765 43210"
                                icon={icons.email}
                                value={form.phone}
                                onChangeText={(value) => setForm({ ...form, phone: value })}
                                keyboardType="phone-pad"
                            />
                            <CustomButton
                                title={loading ? "Sending..." : "Continue as Driver"}
                                onPress={onSignInPress}
                                className="mt-6 bg-general-500" // Different color for Driver?
                                disabled={loading}
                            />
                        </>
                    ) : (
                        <>
                            <InputField
                                label="OTP Code"
                                placeholder="Enter 6-digit code"
                                icon={icons.lock}
                                value={form.otp}
                                onChangeText={(value) => setForm({ ...form, otp: value })}
                                keyboardType="number-pad"
                            />
                            <View className="mt-6 gap-2">
                                <CustomButton
                                    title={loading ? "Verifying..." : "Verify & Start Driving"}
                                    onPress={onVerifyPress}
                                    className="bg-general-500"
                                    disabled={loading}
                                />
                                <CustomButton
                                    title="Change Number"
                                    onPress={() => setStep('phone')}
                                    className="bg-gray-100"
                                    textVariant="secondary"
                                    disabled={loading}
                                />
                            </View>
                        </>
                    )}

                    <TouchableOpacity onPress={() => router.replace('/')} className="mt-10 items-center">
                        <Text className="text-gray-400">Back to Role Selection</Text>
                    </TouchableOpacity>

                </View>
            </View>
        </ScrollView>
    );
};

export default DriverSignIn;
