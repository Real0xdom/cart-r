import { router, Redirect } from "expo-router";
import { useState } from "react";
import {
  ScrollView,
  Text,
  View,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";

import CustomButton from "@/components/CustomButton";
import InputField from "@/components/InputField";
import { icons } from "@/constants";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

const PersonalInfo = () => {
  const { user, profile, driverProfile } = useAuth();
  
  // ROUTE GUARD: Approved drivers should NOT see onboarding - redirect to home
  if (driverProfile?.verification_status === 'approved') {
    console.log('[PersonalInfo] Driver is already approved - redirecting to home');
    return <Redirect href="/(tabs)/home" />;
  }
  
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    fullName: profile?.name || "",
    email: profile?.email || "",
    phone: user?.phone || "",
  });

  const onContinue = async () => {
    if (!form.fullName.trim()) {
      return Alert.alert("Error", "Please enter your full name");
    }
    if (!form.email.trim() || !form.email.includes("@")) {
      return Alert.alert("Error", "Please enter a valid email address");
    }

    setLoading(true);
    try {
      // Update user profile in users table
      const { error } = await supabase
        .from("users")
        .upsert({
          id: user?.id,
          name: form.fullName.trim(),
          email: form.email.trim().toLowerCase(),
          phone: form.phone,
          role: "driver",
        });

      if (error) {
        Alert.alert("Error", error.message);
        return;
      }

      router.push("/onboarding/vehicle-info");
    } catch (err: any) {
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
        <View className="flex-1 bg-white">
          {/* Header */}
          <View className="w-full h-[180px] bg-green-500 justify-center px-5">
            <Text className="text-white text-sm font-Jakarta mb-2">
              Step 1 of 3
            </Text>
            <Text className="text-white text-2xl font-JakartaBold">
              Personal Information
            </Text>
            <Text className="text-green-100 mt-2">
              Let's get to know you better
            </Text>
          </View>

          {/* Progress Bar */}
          <View className="px-5 mt-4">
            <View className="flex-row h-2 bg-gray-200 rounded-full overflow-hidden">
              <View className="w-1/3 bg-green-500 rounded-full" />
            </View>
          </View>

          {/* Form */}
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
              onChangeText={(value) => setForm({ ...form, email: value })}
              keyboardType="email-address"
              containerStyle="mt-4"
            />

            <InputField
              label="Phone Number"
              placeholder="+91 9876543210"
              icon={icons.phone}
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

            <View className="mt-6 p-4 bg-green-50 rounded-xl">
              <Text className="text-green-800 text-center text-sm">
                ℹ️ Your information is secure and will only be used to verify
                your identity as a CARTR driver partner.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default PersonalInfo;
