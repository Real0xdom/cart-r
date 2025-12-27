import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Text, View, Image, ActivityIndicator } from "react-native";

import CustomButton from "@/components/CustomButton";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

const VerificationPending = () => {
  const { user } = useAuth();
  const [status, setStatus] = useState<"pending" | "approved" | "rejected">(
    "pending"
  );
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);

  useEffect(() => {
    checkVerificationStatus();

    // Subscribe to real-time updates
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
            // Redirect to home after approval
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
      const { data, error } = await supabase
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
    // Open email or support page
    router.push("/(tabs)/profile");
  };

  const onRetryApplication = () => {
    // Go back to documents to re-upload
    router.push("/onboarding/documents");
  };

  return (
    <View className="flex-1 bg-white justify-center items-center px-5">
      {status === "pending" ? (
        <>
          {/* Pending State */}
          <View className="w-32 h-32 bg-yellow-100 rounded-full items-center justify-center mb-6">
            <Text className="text-6xl">⏳</Text>
          </View>

          <Text className="text-2xl font-JakartaBold text-gray-800 text-center mb-3">
            Verification in Progress
          </Text>

          <Text className="text-gray-500 text-center mb-8 px-4">
            Our team is reviewing your documents. This usually takes 24-48 hours.
            We'll notify you once your account is verified.
          </Text>

          <View className="flex-row items-center mb-8">
            <ActivityIndicator color="#22c55e" size="small" />
            <Text className="text-green-600 ml-2 font-JakartaSemiBold">
              Under Review
            </Text>
          </View>

          <View className="w-full p-5 bg-gray-50 rounded-xl mb-6">
            <Text className="text-gray-600 text-center text-sm">
              📱 You'll receive a notification when your account is approved.
              Make sure notifications are enabled.
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
          {/* Rejected State */}
          <View className="w-32 h-32 bg-red-100 rounded-full items-center justify-center mb-6">
            <Text className="text-6xl">❌</Text>
          </View>

          <Text className="text-2xl font-JakartaBold text-gray-800 text-center mb-3">
            Verification Failed
          </Text>

          <Text className="text-gray-500 text-center mb-4 px-4">
            Unfortunately, we couldn't verify your documents.
          </Text>

          {rejectionReason && (
            <View className="w-full p-4 bg-red-50 rounded-xl mb-6">
              <Text className="text-red-800 font-JakartaSemiBold mb-1">
                Reason:
              </Text>
              <Text className="text-red-700">{rejectionReason}</Text>
            </View>
          )}

          <CustomButton
            title="Re-upload Documents"
            onPress={onRetryApplication}
            className="bg-green-500 w-full mb-3"
          />

          <CustomButton
            title="Contact Support"
            onPress={onContactSupport}
            className="bg-gray-200 w-full"
            textVariant="secondary"
          />
        </>
      ) : (
        <>
          {/* Approved State */}
          <View className="w-32 h-32 bg-green-100 rounded-full items-center justify-center mb-6">
            <Text className="text-6xl">✅</Text>
          </View>

          <Text className="text-2xl font-JakartaBold text-gray-800 text-center mb-3">
            You're Verified!
          </Text>

          <Text className="text-gray-500 text-center mb-8 px-4">
            Congratulations! Your account has been verified. You can now start
            accepting rides and earning.
          </Text>

          <View className="flex-row items-center mb-8">
            <ActivityIndicator color="#22c55e" size="small" />
            <Text className="text-green-600 ml-2">Redirecting to home...</Text>
          </View>
        </>
      )}
    </View>
  );
};

export default VerificationPending;
