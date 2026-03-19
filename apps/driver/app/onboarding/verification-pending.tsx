import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Linking, Text, View } from "react-native";

import CustomButton from "@/components/CustomButton";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

const VerificationPending = () => {
  const { user } = useAuth();
  const [status, setStatus] = useState<"pending" | "approved" | "rejected">(
    "pending"
  );
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);

  useEffect(() => {
    checkVerificationStatus();

    const channel = supabase
      .channel("driver-verification")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "drivers",
          filter: `user_id=eq.${user?.id}`,
        },
        (payload) => {
          const newStatus = payload.new.verification_status;
          setStatus(newStatus);
          if (newStatus === "rejected") {
            setRejectionReason(payload.new.rejection_reason);
          }
          if (newStatus === "approved") {
            setTimeout(() => {
              router.replace("/(tabs)/home");
            }, 2000);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const checkVerificationStatus = async () => {
    try {
      const { data } = await supabase
        .from("drivers")
        .select("verification_status, rejection_reason")
        .eq("user_id", user?.id)
        .single();

      if (data) {
        setStatus(data.verification_status);
        if (data.verification_status === "rejected") {
          setRejectionReason(data.rejection_reason);
        }
        if (data.verification_status === "approved") {
          router.replace("/(tabs)/home");
        }
      }
    } catch (error) {
      console.error("Error checking status:", error);
    }
  };

  const onContactSupport = () => {
    const supportEmail = "support@cartr.com";
    const subject = "Driver Application Support";
    const url = `mailto:${supportEmail}?subject=${subject}`;
    Linking.openURL(url).catch(() =>
      Alert.alert(
        "Error",
        "Could not open email client. Please email support@cartr.com"
      )
    );
  };

  const onRetryApplication = () => {
    router.push("/onboarding/personal-info");
  };

  return (
    <View className="flex-1 items-center justify-center bg-white px-5">
      {status === "pending" ? (
        <>
          <View className="mb-6 h-32 w-32 items-center justify-center rounded-full bg-yellow-100">
            <Ionicons name="time-outline" size={56} color="#d97706" />
          </View>

          <Text className="mb-3 text-center text-2xl font-JakartaBold text-gray-800">
            Verification in Progress
          </Text>

          <Text className="mb-8 px-4 text-center text-gray-500">
            Our team is reviewing your documents. This usually takes 24-48
            hours. We'll notify you once your account is verified.
          </Text>

          <View className="mb-8 flex-row items-center">
            <ActivityIndicator color="#22c55e" size="small" />
            <Text className="ml-2 font-JakartaSemiBold text-green-600">
              Under Review
            </Text>
          </View>

          <View className="mb-6 w-full flex-row items-start rounded-xl bg-gray-50 p-5">
            <Ionicons name="notifications-outline" size={18} color="#4b5563" />
            <Text className="ml-2 flex-1 text-sm text-gray-600">
              You'll receive a notification when your account is approved. Make
              sure notifications are enabled.
            </Text>
          </View>

          <CustomButton
            title="Contact Support"
            onPress={onContactSupport}
            className="bg-gray-200"
            textVariant="secondary"
          />
        </>
      ) : status === "rejected" ? (
        <>
          <View className="mb-6 h-32 w-32 items-center justify-center rounded-full bg-red-100">
            <Ionicons
              name="close-circle-outline"
              size={56}
              color="#dc2626"
            />
          </View>

          <Text className="mb-3 text-center text-2xl font-JakartaBold text-gray-800">
            Verification Failed
          </Text>

          <Text className="mb-4 px-4 text-center text-gray-500">
            Unfortunately, we couldn't verify your documents.
          </Text>

          {rejectionReason && (
            <View className="mb-6 w-full rounded-xl bg-red-50 p-4">
              <Text className="mb-1 font-JakartaSemiBold text-red-800">
                Reason:
              </Text>
              <Text className="text-red-700">{rejectionReason}</Text>
            </View>
          )}

          <CustomButton
            title="Edit Application"
            onPress={onRetryApplication}
            className="mb-3 w-full bg-green-500"
          />

          <CustomButton
            title="Contact Support"
            onPress={onContactSupport}
            className="w-full bg-gray-200"
            textVariant="secondary"
          />
        </>
      ) : (
        <>
          <View className="mb-6 h-32 w-32 items-center justify-center rounded-full bg-green-100">
            <Ionicons
              name="checkmark-circle-outline"
              size={56}
              color="#16a34a"
            />
          </View>

          <Text className="mb-3 text-center text-2xl font-JakartaBold text-gray-800">
            You're Verified!
          </Text>

          <Text className="mb-8 px-4 text-center text-gray-500">
            Congratulations! Your account has been verified. You can now start
            accepting rides and earning.
          </Text>

          <View className="mb-8 flex-row items-center">
            <ActivityIndicator color="#22c55e" size="small" />
            <Text className="ml-2 text-green-600">Redirecting to home...</Text>
          </View>
        </>
      )}
    </View>
  );
};

export default VerificationPending;
