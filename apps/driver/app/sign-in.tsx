import { Feather, MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { images } from "@/constants";
import { TermsCheckbox } from "@/components/TermsCheckbox";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/lib/supabase";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const DRIVER_PRIMARY = "#355A31";
const DRIVER_PRIMARY_SOFT = "#E8F0E6";
const DRIVER_PRIMARY_MUTED = "#CFE0CB";
const OTP_RESEND_COOLDOWN_SECONDS = 30;

const DriverSignIn = () => {
  const { signInWithPhone, verifyOtp, refreshProfile } = useAuth();
  const { t } = useLanguage();

  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [countryCode] = useState("+91");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formattedPhoneNumber, setFormattedPhoneNumber] = useState("");
  const [resendCountdown, setResendCountdown] = useState(0);

  const phoneInputRef = useRef<TextInput>(null);
  const otpInputRef = useRef<TextInput>(null);

  const canRequestOtp = termsAccepted && phone.length >= 10;
  const canResendOtp = resendCountdown === 0 && !loading;

  useEffect(() => {
    if (resendCountdown <= 0) {
      return;
    }

    const timer = setTimeout(() => {
      setResendCountdown((current) => Math.max(0, current - 1));
    }, 1000);

    return () => clearTimeout(timer);
  }, [resendCountdown]);

  const formatPhone = (phoneNumber: string) => {
    const cleaned = phoneNumber.replace(/\s+/g, "").replace(/[^0-9]/g, "");
    return `${countryCode}${cleaned}`;
  };

  const onSendOtpPress = async () => {
    if (!phone || phone.length < 10) {
      return Alert.alert(t("error"), t("enterValidPhone"));
    }

    if (!termsAccepted) {
      return Alert.alert(
        t("error"),
        t("pleaseAcceptTerms") || "Please accept the Terms & Conditions."
      );
    }

    const formattedPhone = formatPhone(phone);
    setFormattedPhoneNumber(formattedPhone);
    setLoading(true);

    try {
      const { error } = await signInWithPhone(formattedPhone);

      if (error) {
        Alert.alert(t("error"), error.message);
        return;
      }

      setOtp("");
      setResendCountdown(OTP_RESEND_COOLDOWN_SECONDS);
      setStep("otp");
      Alert.alert(t("otpSent"), `${t("otpSentTo")} ${formattedPhone}`);
    } catch (err: any) {
      Alert.alert(t("error"), err.message || t("sendingOtp"));
    } finally {
      setLoading(false);
    }
  };

  const onVerifyOtpPress = async () => {
    if (!otp || otp.length !== 6) {
      return Alert.alert(t("error"), t("enterSixDigitOtp"));
    }

    const formattedPhone = formattedPhoneNumber || formatPhone(phone);
    setLoading(true);

    try {
      const { error, data } = await verifyOtp(formattedPhone, otp);

      if (error) {
        Alert.alert(t("error"), error.message);
        return;
      }

      if (!data?.user?.id) {
        Alert.alert(t("error"), "Could not verify user. Please try again.");
        return;
      }

      const normalizedPhone = data.user.phone || formattedPhone;

      const { data: existingUser } = await supabase
        .from("users")
        .select("name,email")
        .eq("id", data.user.id)
        .maybeSingle();

      const { error: roleError } = await supabase.from("users").upsert({
        id: data.user.id,
        email:
          existingUser?.email ||
          data.user.email ||
          `${normalizedPhone}@driver.cart-r.app`,
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
        .maybeSingle();

      try {
        await supabase.rpc("record_terms_acceptance", {
          p_user_id: data.user.id,
          p_terms_version: "v1.0",
          p_ip_address: undefined,
          p_user_agent: undefined,
          p_device_info: undefined,
        });
      } catch (termsError) {
        console.log("Failed to record terms acceptance:", termsError);
      }

      await refreshProfile();

      if (!driverData) {
        router.replace("/onboarding/personal-info");
      } else if (driverData.verification_status === "approved") {
        router.replace("/(tabs)/home");
      } else if (
        driverData.verification_status === "pending" ||
        driverData.verification_status === "rejected"
      ) {
        router.replace("/onboarding/verification-pending");
      } else {
        router.replace("/(tabs)/home");
      }
    } catch (err: any) {
      Alert.alert(t("error"), err.message || "Invalid OTP");
    } finally {
      setLoading(false);
    }
  };

  const renderPhoneStep = () => (
    <View className="flex-1">
      <View
        className="items-center justify-center"
        style={{ height: SCREEN_HEIGHT * 0.35 }}
      >
        <Image
          source={images.splash1}
          className="h-64 w-64 rounded-3xl"
          resizeMode="contain"
        />
      </View>

      <View className="mt-4 items-center px-6">
        <Text className="mb-2 text-2xl font-JakartaBold text-gray-900">
          {t("welcomeToCartr")}
        </Text>
        <Text className="text-center font-JakartaMedium text-base text-gray-500">
          {t("loginWithPhone")}
        </Text>
      </View>

      <View className="flex-1 justify-end px-6 pb-8">
        <View className="mb-4">
          <Text className="ml-1 mb-2 text-sm font-JakartaSemiBold text-gray-600">
            {t("mobileNumber")}
          </Text>
          <View className="flex-row items-center overflow-hidden rounded-2xl border border-gray-200 bg-gray-100">
            <TouchableOpacity
              className="flex-row items-center border-r border-gray-200 bg-gray-50 px-4 py-4"
              onPress={() => Alert.alert("Country", t("countryIndiaOnly"))}
            >
              <Text className="mr-1 font-JakartaSemiBold text-gray-700">
                IN
              </Text>
              <Text className="font-JakartaSemiBold text-gray-700">
                {countryCode}
              </Text>
              <Feather name="chevron-down" size={16} color="#666" />
            </TouchableOpacity>

            <TextInput
              ref={phoneInputRef}
              testID="auth.phoneInput"
              accessibilityLabel="auth.phoneInput"
              className="flex-1 px-4 py-4 text-lg font-JakartaSemiBold"
              placeholder={t("enterPhoneNumber")}
              placeholderTextColor="#9CA3AF"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              maxLength={10}
            />
          </View>
        </View>

        <TermsCheckbox
          checked={termsAccepted}
          onCheckedChange={setTermsAccepted}
          checkboxTestId="auth.termsCheckbox"
          className="mb-6"
        />

        <TouchableOpacity
          onPress={onSendOtpPress}
          testID="auth.requestOtpButton"
          accessibilityLabel="auth.requestOtpButton"
          disabled={loading || !canRequestOtp}
          className={`mt-2 items-center justify-center rounded-2xl py-4 ${
            canRequestOtp ? "" : "bg-gray-300"
          }`}
          style={canRequestOtp ? { backgroundColor: DRIVER_PRIMARY } : undefined}
          activeOpacity={0.8}
        >
          {loading ? (
            <View className="flex-row items-center">
              <ActivityIndicator color="#fff" size="small" />
              <Text className="ml-2 text-lg font-JakartaBold text-white">
                {t("sendingOtp")}
              </Text>
            </View>
          ) : (
            <Text className="text-lg font-JakartaBold text-white">
              {t("continue")}
            </Text>
          )}
        </TouchableOpacity>

        <View
          className="mt-6 rounded-2xl p-4"
          style={{ backgroundColor: DRIVER_PRIMARY_SOFT }}
        >
          <View className="flex-row items-start">
            <View
              className="mr-3 mt-0.5 h-10 w-10 items-center justify-center rounded-full"
              style={{ backgroundColor: DRIVER_PRIMARY_MUTED }}
            >
              <MaterialIcons
                name="local-shipping"
                size={20}
                color={DRIVER_PRIMARY}
              />
            </View>
            <Text className="flex-1 text-sm text-gray-600">
              {t("wantToBecomeDriver")}
              {"\n"}
              {t("contactUsAt")}{" "}
              <Text
                className="font-JakartaSemiBold"
                style={{ color: DRIVER_PRIMARY }}
              >
                drivers@cart-r.com
              </Text>
            </Text>
          </View>
        </View>
      </View>
    </View>
  );

  const renderOtpStep = () => (
    <View className="flex-1 px-6">
      <View className="mb-8 mt-16 items-center">
        <View
          className="h-24 w-24 items-center justify-center rounded-full"
          style={{ backgroundColor: DRIVER_PRIMARY_SOFT }}
        >
          <MaterialIcons name="sms" size={48} color={DRIVER_PRIMARY} />
        </View>
      </View>

      <Text className="mb-2 text-center text-2xl font-JakartaBold text-gray-900">
        {t("verifyYourNumber")}
      </Text>
      <Text className="mb-8 text-center font-JakartaMedium text-gray-500">
        {t("enterCodeSentTo")}
        {"\n"}
        <Text className="font-JakartaBold text-gray-700">
          {formattedPhoneNumber}
        </Text>
      </Text>

      <View className="mb-6">
        <TextInput
          ref={otpInputRef}
          testID="auth.otpInput"
          accessibilityLabel="auth.otpInput"
          className="rounded-2xl border border-gray-200 bg-gray-100 px-6 py-4 text-center text-2xl font-JakartaBold tracking-widest"
          placeholder="Enter 6-digit OTP"
          placeholderTextColor="#9CA3AF"
          value={otp}
          onChangeText={setOtp}
          keyboardType="number-pad"
          maxLength={6}
          autoFocus
        />
      </View>

      <TouchableOpacity
        onPress={onVerifyOtpPress}
        testID="auth.verifyOtpButton"
        accessibilityLabel="auth.verifyOtpButton"
        disabled={loading || otp.length !== 6}
        className={`mt-2 items-center justify-center rounded-2xl py-4 ${
          otp.length === 6 ? "" : "bg-gray-300"
        }`}
        style={otp.length === 6 ? { backgroundColor: DRIVER_PRIMARY } : undefined}
        activeOpacity={0.8}
      >
        {loading ? (
          <View className="flex-row items-center">
            <ActivityIndicator color="#fff" size="small" />
            <Text className="ml-2 text-lg font-JakartaBold text-white">
              {t("verifying")}
            </Text>
          </View>
        ) : (
          <Text className="text-lg font-JakartaBold text-white">
            {t("verifyAndContinue")}
          </Text>
        )}
      </TouchableOpacity>

      <View className="mt-6 flex-row justify-center">
        <Text className="font-Jakarta text-gray-500">
          {t("didntReceiveCode")}{" "}
        </Text>
        <TouchableOpacity onPress={onSendOtpPress} disabled={!canResendOtp}>
          <Text
            className="font-JakartaSemiBold"
            style={{ color: canResendOtp ? DRIVER_PRIMARY : "#9CA3AF" }}
          >
            {canResendOtp ? t("resendOtp") : `${t("resendOtp")} (${resendCountdown}s)`}
          </Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity onPress={() => setStep("phone")} className="mt-5 items-center">
        <Text
          className="font-JakartaSemiBold"
          style={{ color: DRIVER_PRIMARY }}
        >
          {t("changePhoneNumber")}
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {step === "phone" ? renderPhoneStep() : renderOtpStep()}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default DriverSignIn;
