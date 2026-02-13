import { router } from "expo-router";
import { useState } from "react";
import {
  Text,
  View,
  Image,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import CustomButton from "@/components/CustomButton";
import { images } from "@/constants";
import { useAuth } from "@/contexts/AuthContext";
import { recordExpansionInterest, getActiveServiceAreas } from "@/lib/serviceArea";
import { useLocationStore } from "@/store";

const ServiceNotAvailableScreen = () => {
  const { profile } = useAuth();
  const { userAddress, userLatitude, userLongitude } = useLocationStore();
  const [isNotifying, setIsNotifying] = useState(false);
  const [notificationRequested, setNotificationRequested] = useState(false);

  const handleNotifyMe = async () => {
    if (!profile?.id || !userLatitude || !userLongitude) {
      Alert.alert("Error", "Unable to record your location. Please try again.");
      return;
    }

    setIsNotifying(true);

    const { error } = await recordExpansionInterest(
      profile.id,
      userLatitude,
      userLongitude,
      userAddress || "Unknown location"
    );

    setIsNotifying(false);

    if (error) {
      Alert.alert("Error", "Failed to record your interest. Please try again.");
    } else {
      setNotificationRequested(true);
      Alert.alert(
        "Thank You!",
        "We've recorded your interest. We'll notify you as soon as we expand to your area."
      );
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-1 px-6 py-8">
          {/* Header with back button */}
          <TouchableOpacity
            onPress={() => router.back()}
            className="mb-6 flex-row items-center"
            activeOpacity={0.7}
          >
            <Feather name="arrow-left" size={24} color="#000" />
            <Text className="ml-2 text-base font-JakartaMedium">Back</Text>
          </TouchableOpacity>

          {/* Illustration */}
          <View className="items-center justify-center mb-8">
            <Image
              source={images.map}
              className="w-64 h-64"
              resizeMode="contain"
            />
          </View>

          {/* Message */}
          <View className="mb-8">
            <Text className="text-2xl font-JakartaBold text-gray-900 text-center mb-4">
              Service Not Available Yet
            </Text>
            <Text className="text-base text-gray-600 font-JakartaMedium text-center leading-6">
              We're not supporting this location at the current moment. We'll notify you as soon as we're available in your area!
            </Text>
          </View>

          {/* Current Location Display */}
          {userAddress && (
            <View className="bg-gray-50 rounded-2xl p-4 mb-6 border border-gray-200">
              <View className="flex-row items-center mb-2">
                <Feather name="map-pin" size={20} color="#666" />
                <Text className="ml-2 text-sm font-JakartaBold text-gray-700">
                  Your Location
                </Text>
              </View>
              <Text className="text-sm text-gray-600 font-JakartaMedium">
                {userAddress}
              </Text>
            </View>
          )}

          {/* Notify Me Button */}
          <CustomButton
            title={notificationRequested ? "Notification Requested ✓" : "Notify Me When Available"}
            onPress={handleNotifyMe}
            disabled={isNotifying || notificationRequested}
            className="mb-4"
            bgVariant={notificationRequested ? "success" : "primary"}
          />

          {isNotifying && (
            <View className="flex-row items-center justify-center mb-4">
              <ActivityIndicator size="small" color="#4CAF50" />
              <Text className="ml-2 text-sm text-gray-600 font-JakartaMedium">
                Recording your interest...
              </Text>
            </View>
          )}

          {/* Secondary Action */}
          <CustomButton
            title="Browse Service Areas"
            onPress={() => router.push("/(root)/service-areas")}
            bgVariant="outline"
          />

          {/* Help Text */}
          <View className="mt-8 p-4 bg-blue-50 rounded-xl border border-blue-100">
            <View className="flex-row items-start">
              <Feather name="info" size={18} color="#3B82F6" />
              <View className="flex-1 ml-3">
                <Text className="text-sm text-blue-900 font-JakartaBold mb-1">
                  Expanding Soon
                </Text>
                <Text className="text-xs text-blue-700 font-JakartaMedium leading-5">
                  We're actively working to expand our service areas. Your interest helps us prioritize new locations!
                </Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default ServiceNotAvailableScreen;
