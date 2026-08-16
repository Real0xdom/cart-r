import { router, Redirect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import CustomButton from "@/components/CustomButton";
import InputField from "@/components/InputField";
import { icons } from "@/constants";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

const DUPLICATE_EMAIL_MESSAGE =
  "An account with this email already exists. Please log in instead.";

const PersonalInfo = () => {
  const { user, profile, driverProfile } = useAuth();
  const insets = useSafeAreaInsets();

  if (driverProfile?.verification_status === "approved") {
    console.log("[PersonalInfo] Driver is already approved - redirecting to home");
    return <Redirect href="/(tabs)/home" />;
  }

  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const snackbarOpacity = useRef(new Animated.Value(0)).current;
  const [form, setForm] = useState({
    fullName: profile?.name || "",
    email: profile?.email || "",
    phone: user?.phone || "",
  });

  useEffect(() => {
    if (!snackbarMessage) {
      return;
    }

    Animated.sequence([
      Animated.timing(snackbarOpacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.delay(2600),
      Animated.timing(snackbarOpacity, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start(() => setSnackbarMessage(""));
  }, [snackbarMessage, snackbarOpacity]);

  const showSnackbar = (message: string) => {
    snackbarOpacity.stopAnimation();
    snackbarOpacity.setValue(0);
    setSnackbarMessage(message);
  };

  const isDuplicateEmailError = (error: any) => {
    const combinedText = [
      error?.message,
      error?.details,
      error?.hint,
      error?.code,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return (
      error?.code === "23505" ||
      combinedText.includes("duplicate") ||
      combinedText.includes("already exists") ||
      combinedText.includes("already registered") ||
      combinedText.includes("unique constraint")
    );
  };

  const handleDuplicateEmail = () => {
    setEmailError(DUPLICATE_EMAIL_MESSAGE);
    showSnackbar("Email already registered. Please log in.");
  };

  const onContinue = async () => {
    if (!form.fullName.trim()) {
      return Alert.alert("Error", "Please enter your full name");
    }
    if (!form.email.trim() || !form.email.includes("@")) {
      return Alert.alert("Error", "Please enter a valid email address");
    }

    setEmailError("");
    setLoading(true);

    try {
      const { error } = await supabase.from("users").upsert({
        id: user?.id,
        name: form.fullName.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone,
        role: "driver",
      });

      if (error) {
        if (isDuplicateEmailError(error)) {
          handleDuplicateEmail();
          return;
        }

        Alert.alert("Error", error.message);
        return;
      }

      router.push("/onboarding/vehicle-info");
    } catch (err: any) {
      if (isDuplicateEmailError(err)) {
        handleDuplicateEmail();
        return;
      }

      Alert.alert("Error", err.message || "Something went wrong");
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
        <View className="flex-1 bg-white pb-10">
          <View
            className="w-full justify-end bg-green-500 px-5 pb-6"
            style={{ minHeight: 200, paddingTop: insets.top + 52 }}
          >
            <Pressable
              onPress={() => router.replace("/sign-in")}
              className="absolute left-5 flex-row items-center"
              style={{ top: insets.top + 12 }}
              accessibilityRole="button"
              accessibilityLabel="Back to login"
            >
              <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
              <Text className="ml-2 text-sm font-JakartaSemiBold text-white">
                Back to login
              </Text>
            </Pressable>

            <Text className="mb-2 text-sm font-Jakarta text-white">Step 1 of 3</Text>
            <Text className="text-2xl font-JakartaBold text-white">
              Personal Information
            </Text>
            <Text className="mt-2 text-green-100">Let's get to know you better</Text>
          </View>

          <View className="mt-4 px-5">
            <View className="h-2 flex-row overflow-hidden rounded-full bg-gray-200">
              <View className="w-1/3 rounded-full bg-green-500" />
            </View>
          </View>

          <View className="p-5">
            <InputField
              label="Full Name"
              placeholder="Enter your full name"
              icon={icons.person}
              value={form.fullName}
              onChangeText={(value) => setForm({ ...form, fullName: value })}
            />

            <InputField
              label="Email Address"
              placeholder="driver@example.com"
              icon={icons.email}
              value={form.email}
              onChangeText={(value) => {
                if (emailError) {
                  setEmailError("");
                }
                setForm({ ...form, email: value });
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              containerStyle="mt-4"
              error={!!emailError}
              errorMessage={emailError}
            />

            {!!emailError && (
              <View className="mt-1 rounded-2xl border border-red-200 bg-red-50 p-4">
                <View className="flex-row items-start">
                  <View className="mr-3 mt-0.5 h-8 w-8 items-center justify-center rounded-full bg-red-100">
                    <Ionicons name="alert-circle" size={18} color="#DC2626" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-JakartaSemiBold text-red-800">
                      Email already in use
                    </Text>
                    <Text className="mt-1 text-sm leading-5 text-red-700">
                      {DUPLICATE_EMAIL_MESSAGE}
                    </Text>
                    <Pressable
                      onPress={() => router.replace("/sign-in")}
                      className="mt-3 self-start"
                    >
                      <Text className="text-sm font-JakartaBold text-red-700 underline">
                        Go to login
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            )}

            <InputField
              label="Phone Number"
              placeholder="+91 9876543210"
              icon={icons.lock}
              value={form.phone}
              onChangeText={(value) => setForm({ ...form, phone: value })}
              keyboardType="phone-pad"
              containerStyle="mt-4"
              editable={false}
            />

            <CustomButton
              title={loading ? "Saving..." : "Continue"}
              onPress={onContinue}
              className="mt-8 bg-green-500"
              disabled={loading}
            />

            <View className="mt-6 rounded-xl bg-green-50 p-4">
              <Text className="text-center text-sm text-green-800">
                Your information is secure and will only be used to verify your
                identity as a CARTR driver partner.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {snackbarMessage ? (
        <Animated.View
          pointerEvents="none"
          style={{ opacity: snackbarOpacity }}
          className="absolute bottom-6 left-5 right-5 rounded-2xl bg-[#1F2937] px-4 py-3"
        >
          <View className="flex-row items-center">
            <Ionicons name="alert-circle-outline" size={18} color="#FCA5A5" />
            <Text className="ml-3 flex-1 text-sm font-JakartaMedium text-white">
              {snackbarMessage}
            </Text>
          </View>
        </Animated.View>
      ) : null}
    </KeyboardAvoidingView>
  );
};

export default PersonalInfo;
