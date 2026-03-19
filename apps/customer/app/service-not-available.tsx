import { router } from "expo-router";
import { useState, useEffect } from "react";
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
import { Feather, MaterialIcons } from "@expo/vector-icons";
import CustomButton from "@/components/CustomButton";
import { images, icons } from "@/constants";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { recordExpansionInterest, getActiveServiceAreas, ServiceArea } from "@/lib/serviceArea";
import { useLocationStore } from "@/store";

const ServiceNotAvailableScreen = () => {
  const { profile } = useAuth();
  const { t } = useLanguage();
  const { userAddress, userLatitude, userLongitude } = useLocationStore();
  const [isNotifying, setIsNotifying] = useState(false);
  const [notificationRequested, setNotificationRequested] = useState(false);
  const [serviceAreas, setServiceAreas] = useState<ServiceArea[]>([]);

  useEffect(() => {
    getActiveServiceAreas().then(({ data }) => {
      if (data) setServiceAreas(data);
    });
  }, []);

  const handleNotifyMe = async () => {
    if (!profile?.id || !userLatitude || !userLongitude) {
      Alert.alert(t("error"), t("unableToRecordLocation"));
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
      Alert.alert(t("error"), t("failedToRecordInterest"));
    } else {
      setNotificationRequested(true);
      Alert.alert(t("thankYou"), t("interestRecorded"));
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-1 px-6 py-8">
          {/* Illustration */}
          <View className="items-center justify-center mb-6">
            <Image
              source={icons.map}
              className="w-52 h-52"
              resizeMode="contain"
            />
          </View>

          {/* Message */}
          <View className="mb-6">
            <Text className="text-2xl font-JakartaBold text-gray-900 text-center mb-3">
              {t("serviceNotAvailableTitle") || "Service Not Available Yet"}
            </Text>
            <Text className="text-base text-gray-600 font-JakartaMedium text-center leading-6">
              {t("serviceNotAvailableDescription") || "Your current GPS location is outside our service zones. You can still book by manually selecting a supported pickup location."}
            </Text>
          </View>

          {/* Current Location Display */}
          {userAddress && (
            <View className="bg-red-50 rounded-2xl p-4 mb-5 border border-red-100">
              <View className="flex-row items-center mb-2">
                <MaterialIcons name="location-off" size={18} color="#EF4444" />
                <Text className="ml-2 text-sm font-JakartaBold text-red-700">
                  {t("yourGPSLocation") || "Your GPS Location (Not Supported)"}
                </Text>
              </View>
              <Text className="text-sm text-red-600 font-JakartaMedium">
                {userAddress}
              </Text>
            </View>
          )}

          {/* Available Service Areas */}
          {serviceAreas.length > 0 && (
            <View className="bg-green-50 rounded-2xl p-4 mb-5 border border-green-100">
              <View className="flex-row items-center mb-3">
                <MaterialIcons name="place" size={18} color="#16A34A" />
                <Text className="ml-2 text-sm font-JakartaBold text-green-800">
                  {t("weCurrentlyServe")}
                </Text>
              </View>
              <View className="flex-row flex-wrap gap-2">
                {serviceAreas.map(area => (
                  <View key={area.id} className="bg-green-100 px-3 py-1.5 rounded-full flex-row items-center">
                    <View className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1.5" />
                    <Text className="text-green-700 text-xs font-JakartaMedium">
                      {area.city}, {area.state}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Primary CTA: Select location manually */}
          <TouchableOpacity
            onPress={() => router.push("/find-ride")}
            className="bg-orange-500 rounded-2xl py-4 px-6 mb-3 flex-row items-center justify-center shadow-sm"
            activeOpacity={0.85}
          >
            <MaterialIcons name="edit-location" size={20} color="white" />
            <Text className="text-white font-JakartaBold ml-2 text-base">
              {t("selectSupportedLocation") || "Select a Supported Location"}
            </Text>
          </TouchableOpacity>

          {/* Secondary CTA: Go back home */}
          <TouchableOpacity
            onPress={() => router.back()}
            className="bg-gray-100 rounded-2xl py-4 px-6 mb-5 flex-row items-center justify-center"
            activeOpacity={0.85}
          >
            <Feather name="arrow-left" size={18} color="#555" />
            <Text className="text-gray-700 font-JakartaMedium ml-2">
              {t("goBack") || "Go Back"}
            </Text>
          </TouchableOpacity>

          {/* Divider */}
          <View className="flex-row items-center mb-5">
            <View className="flex-1 h-px bg-gray-200" />
            <Text className="mx-3 text-gray-400 text-xs font-JakartaMedium">{t("or") || "OR"}</Text>
            <View className="flex-1 h-px bg-gray-200" />
          </View>

          {/* Notify Me */}
          <CustomButton
            title={notificationRequested ? "Notification Requested ✓" : "Notify Me When Available Here"}
            onPress={handleNotifyMe}
            disabled={isNotifying || notificationRequested}
            className="mb-4"
            bgVariant={notificationRequested ? "success" : "secondary"}
          />

          {isNotifying && (
            <View className="flex-row items-center justify-center mb-4">
              <ActivityIndicator size="small" color="#4CAF50" />
              <Text className="ml-2 text-sm text-gray-600 font-JakartaMedium">
                {t("recordingInterest")}
              </Text>
            </View>
          )}

          {/* Help Text */}
          <View className="mt-4 p-4 bg-blue-50 rounded-xl border border-blue-100">
            <View className="flex-row items-start">
              <Feather name="info" size={18} color="#3B82F6" />
              <View className="flex-1 ml-3">
                <Text className="text-sm text-blue-900 font-JakartaBold mb-1">
                  {t("tipYouCanBook")}
                </Text>
                <Text className="text-xs text-blue-700 font-JakartaMedium leading-5">
                  {t("tipManualSearch")}
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
