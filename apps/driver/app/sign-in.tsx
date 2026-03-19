import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import CustomButton from "@/components/CustomButton";
import InputField from "@/components/InputField";
import { icons } from "@/constants";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/lib/supabase";
import { TermsCheckbox } from "@/components/TermsCheckbox";

const DriverSignIn = () => {
  const { signInWithPhone, verifyOtp, refreshProfile } = useAuth();
  const { t } = useLanguage();

  const [form, setForm] = useState({
    phone: "+91",
    otp: "",
  });
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [loading, setLoading] = useState(false);

  const canRequestOtp = termsAccepted && form.phone.length >= 10;
  const otpButtonDisabled = loading || !canRequestOtp;

  const formatPhone = (phone: string) => {
    if (!phone.startsWith("+")) {
      return `+${phone}`;
    }
    return phone;
  };

  const onSendOtpPress = async () => {
    if (!form.phone || form.phone.length < 10) {
      return Alert.alert(t("error"), t("enterValidPhone"));
    }
    if (!termsAccepted) {
      return Alert.alert(t("error"), t("pleaseAcceptTerms") || "Please accept the Terms & Conditions.");
    }

    const formattedPhone = formatPhone(form.phone);
    setLoading(true);

    try {
      const { error } = await signInWithPhone(formattedPhone);
      if (error) {
        Alert.alert(t("error"), error.message);
      } else {
        Alert.alert(t("otpSent"), `${t("otpSentTo")} ${formattedPhone}`);
        setStep("otp");
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
      } else if (!data?.user?.id) {
        Alert.alert(t("error"), "Could not verify user. Please try again.");
      } else {
        const normalizedPhone = data.user.phone || formattedPhone;
        
        // Fetch existing user to preserve name if they already set it
        const { data: existingUser } = await supabase
          .from("users")
          .select("name,email")
          .eq("id", data.user.id)
          .single();

        const { error: roleError } = await supabase.from("users").upsert({
          id: data.user.id,
          email: existingUser?.email || data.user.email || `${normalizedPhone}@driver.cart-r.app`,
          name:
            existingUser?.name && existingUser?.name !== "Driver Partner"
              ? existingUser.name
              : data.user.user_metadata?.name ||
                data.user.user_metadata?.full_name ||
                "Driver Partner",
          phone: normalizedPhone,
          role: "driver",
        });

        if (roleError) {
          Alert.alert(t("error"), roleError.message);
          return;
        }

        const { data: driverData } = await supabase
          .from("drivers")
          .select("id, verification_status")
          .eq("user_id", data.user.id)
          .single();

        try {
          await supabase.rpc('record_terms_acceptance', {
            p_user_id: data.user.id,
            p_terms_version: 'v1.0',
            p_ip_address: undefined,
            p_user_agent: undefined,
            p_device_info: undefined
          });
        } catch (e) {
          console.log("Failed to record terms acceptance:", e);
        }

        await refreshProfile();

        if (!driverData) {
          router.replace("/onboarding/personal-info");
        } else if (driverData.verification_status === "approved") {
          router.replace("/(tabs)/home");
        } else if (driverData.verification_status === "pending") {
          router.replace("/onboarding/verification-pending");
        } else if (driverData.verification_status === "rejected") {
          router.replace("/onboarding/verification-pending");
        } else {
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
          <View className="h-[220px] w-full items-center justify-center bg-green-500">
            <View className="mb-3 h-20 w-20 items-center justify-center rounded-full bg-white/15">
              <Ionicons name="car-sport-outline" size={42} color="#ffffff" />
            </View>
            <Text className="text-2xl font-JakartaBold text-white">
              Carter Driver
            </Text>
            <Text className="mt-2 text-green-100">
              {t("partnerAppForDrivers")}
            </Text>
          </View>

          <View className="p-5">
            {step === "phone" ? (
              <>
                <View className="mb-6">
                  <Text className="mb-2 text-lg font-JakartaSemiBold text-gray-800">
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
                  testID="auth.phoneInput"
                  accessibilityLabel="auth.phoneInput"
                />

                <TermsCheckbox 
                  checked={termsAccepted}
                  onCheckedChange={setTermsAccepted}
                  checkboxTestId="auth.termsCheckbox"
                  className="mt-2 mb-4"
                />

                <CustomButton
                  title={loading ? t("sendingOtp") : t("getOtp")}
                  onPress={onSendOtpPress}
                  testID="auth.requestOtpButton"
                  accessibilityLabel="auth.requestOtpButton"
                  className={`mt-2 ${otpButtonDisabled ? "opacity-60" : ""}`}
                  bgVariant={canRequestOtp ? "success" : "secondary"}
                  disabled={otpButtonDisabled}
                />

                <View className="mt-8 rounded-xl bg-gray-50 p-4">
                  <View className="flex-row items-start">
                    <View className="mr-3 mt-0.5 h-9 w-9 items-center justify-center rounded-full bg-green-100">
                      <Ionicons
                        name="briefcase-outline"
                        size={18}
                        color="#16a34a"
                      />
                    </View>
                    <Text className="flex-1 text-sm text-gray-600">
                      {t("wantToBecomeDriver")}
                      {"\n"}
                      {t("contactUsAt")}{" "}
                      <Text className="font-JakartaSemiBold text-green-600">
                        drivers@cart-r.com
                      </Text>
                    </Text>
                  </View>
                </View>
              </>
            ) : (
              <>
                <View className="mb-6">
                  <Text className="mb-2 text-lg font-JakartaSemiBold text-gray-800">
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
                  testID="auth.otpInput"
                  accessibilityLabel="auth.otpInput"
                />

                <CustomButton
                  title={loading ? t("verifying") : t("verifyAndContinue")}
                  onPress={onVerifyOtpPress}
                  testID="auth.verifyOtpButton"
                  accessibilityLabel="auth.verifyOtpButton"
                  className="mt-6 bg-green-500"
                  disabled={loading}
                />

                <TouchableOpacity
                  onPress={() => setStep("phone")}
                  className="mt-4 items-center"
                >
                  <Text className="font-JakartaSemiBold text-green-500">
                    {t("changePhoneNumber")}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={onSendOtpPress}
                  testID="auth.requestOtpButton"
                  accessibilityLabel="auth.requestOtpButton"
                  className="mt-2 items-center"
                  disabled={loading}
                >
                  <Text className="text-gray-400">{t("resendOtp")}</Text>
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





