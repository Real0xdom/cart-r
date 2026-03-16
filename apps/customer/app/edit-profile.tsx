import { useEffect, useMemo, useState } from "react";
import { Alert, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, router } from "expo-router";

import CustomButton from "@/components/CustomButton";
import InputField from "@/components/InputField";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

const isValidEmail = (email: string) => {
  const value = email.trim();
  if (!value) return false;
  return value.includes("@") && value.includes(".");
};

const EditProfile = () => {
  const { profile, refreshProfile } = useAuth();

  const initialName = useMemo(() => profile?.name ?? "", [profile?.name]);
  const initialEmail = useMemo(() => profile?.email ?? "", [profile?.email]);
  const initialPhone = useMemo(() => profile?.phone ?? "", [profile?.phone]);

  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(initialName);
    setEmail(initialEmail);
  }, [initialName, initialEmail]);

  const onSave = async () => {
    if (!profile?.id) {
      Alert.alert("Error", "Profile not loaded");
      return;
    }

    const nextName = name.trim();
    const nextEmail = email.trim().toLowerCase();

    if (!nextName) {
      Alert.alert("Error", "Please enter your name");
      return;
    }
    if (!isValidEmail(nextEmail)) {
      Alert.alert("Error", "Please enter a valid email");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("users")
        .update({ name: nextName, email: nextEmail })
        .eq("id", profile.id);

      if (error) {
        Alert.alert("Error", error.message);
        return;
      }

      await refreshProfile();
      Alert.alert("Success", "Profile updated");
      router.back();
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white px-5">
      <Stack.Screen options={{ title: "Edit Profile" }} />

      <View className="bg-gray-50 rounded-xl p-4 mt-4">
        <InputField
          label="Name"
          placeholder="Your name"
          value={name}
          onChangeText={setName}
          containerStyle="w-full"
          inputStyle="p-3"
        />

        <InputField
          label="Email"
          placeholder="you@example.com"
          value={email}
          onChangeText={setEmail}
          containerStyle="w-full"
          inputStyle="p-3"
          keyboardType="email-address"
        />

        <InputField
          label="Phone"
          placeholder={initialPhone || "Not Found"}
          containerStyle="w-full"
          inputStyle="p-3"
          editable={false}
        />
      </View>

      <CustomButton
        title={saving ? "Saving..." : "Save Changes"}
        onPress={onSave}
        // @ts-ignore
        disabled={saving}
        className="mt-6"
      />
    </SafeAreaView>
  );
};

export default EditProfile;
