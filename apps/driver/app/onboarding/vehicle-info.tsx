import { router, Redirect } from "expo-router";
import { useState } from "react";
import {
  ScrollView,
  Text,
  View,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from "react-native";

import CustomButton from "@/components/CustomButton";
import InputField from "@/components/InputField";
import { icons } from "@/constants";

const VEHICLE_TYPES = [
  { id: "bike", name: "Bike", icon: "🏍️", description: "2-wheeler delivery" },
  { id: "tempo", name: "Tempo", icon: "🛺", description: "Three-wheeler cargo" },
  { id: "sedan", name: "Sedan", icon: "🚗", description: "Mini car/Sedan" },
  { id: "truck", name: "Truck", icon: "🚚", description: "Pickup/Truck" },
];

import { useAuth } from "@/contexts/AuthContext";

const VehicleInfo = () => {
  const { driverProfile } = useAuth();
  
  // ROUTE GUARD: Approved drivers should NOT see onboarding - redirect to home
  if (driverProfile?.verification_status === 'approved') {
    console.log('[VehicleInfo] Driver is already approved - redirecting to home');
    return <Redirect href="/(tabs)/home" />;
  }
  
  const [selectedType, setSelectedType] = useState<string | null>(driverProfile?.vehicle_type || null);
  
  // Format date to DD/MM/YYYY for display
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "";
    try {
      const date = new Date(dateStr);
      return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
    } catch (e) {
      return "";
    }
  };

  const [form, setForm] = useState({
    vehicleNumber: driverProfile?.vehicle_number || "",
    vehicleModel: driverProfile?.vehicle_model || "",
    vehicleColor: driverProfile?.vehicle_color || "",
    licenseNumber: driverProfile?.license_number || "",
    licenseExpiry: formatDate(driverProfile?.license_expiry ?? undefined),
  });

  const onContinue = () => {
    if (!selectedType) {
      return Alert.alert("Error", "Please select your vehicle type");
    }
    if (!form.vehicleNumber.trim()) {
      return Alert.alert("Error", "Please enter your vehicle number");
    }
    if (!form.vehicleModel.trim()) {
      return Alert.alert("Error", "Please enter your vehicle model");
    }
    if (!form.licenseNumber.trim()) {
      return Alert.alert("Error", "Please enter your driving license number");
    }
    if (!form.licenseExpiry.trim()) {
      return Alert.alert("Error", "Please enter your license expiry date");
    }

    // Store in navigation params or context for next screen
    router.push({
      pathname: "/onboarding/documents",
      params: {
        vehicleType: selectedType,
        vehicleNumber: form.vehicleNumber,
        vehicleModel: form.vehicleModel,
        vehicleColor: form.vehicleColor,
        licenseNumber: form.licenseNumber,
        licenseExpiry: form.licenseExpiry,
      },
    });
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
              Step 2 of 3
            </Text>
            <Text className="text-white text-2xl font-JakartaBold">
              Vehicle Information
            </Text>
            <Text className="text-green-100 mt-2">
              Tell us about your vehicle
            </Text>
          </View>

          {/* Progress Bar */}
          <View className="px-5 mt-4">
            <View className="flex-row h-2 bg-gray-200 rounded-full overflow-hidden">
              <View className="w-2/3 bg-green-500 rounded-full" />
            </View>
          </View>

          {/* Vehicle Type Selection */}
          <View className="p-5">
            <Text className="text-gray-800 font-JakartaSemiBold mb-3">
              Select Vehicle Type
            </Text>
            <View className="flex-row flex-wrap justify-between">
              {VEHICLE_TYPES.map((type) => (
                <TouchableOpacity
                  key={type.id}
                  onPress={() => setSelectedType(type.id)}
                  className={`w-[48%] p-4 mb-3 rounded-xl border-2 ${
                    selectedType === type.id
                      ? "border-green-500 bg-green-50"
                      : "border-gray-200 bg-white"
                  }`}
                >
                  <Text className="text-2xl mb-1">{type.icon}</Text>
                  <Text
                    className={`font-JakartaSemiBold ${
                      selectedType === type.id
                        ? "text-green-700"
                        : "text-gray-800"
                    }`}
                  >
                    {type.name}
                  </Text>
                  <Text className="text-gray-500 text-xs">{type.description}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Vehicle Details */}
            <Text className="text-gray-800 font-JakartaSemiBold mt-4 mb-3">
              Vehicle Details
            </Text>

            <InputField
              label="Vehicle Number"
              placeholder="KA01AB1234"
              icon={icons.marker}
              value={form.vehicleNumber}
              onChangeText={(value) =>
                setForm({ ...form, vehicleNumber: value.toUpperCase() })
              }
              autoCapitalize="characters"
            />

            <InputField
              label="Vehicle Model"
              placeholder="e.g., Maruti Swift, Toyota Innova"
              icon={icons.marker}
              value={form.vehicleModel}
              onChangeText={(value) => setForm({ ...form, vehicleModel: value })}
              containerStyle="mt-4"
            />

            <InputField
              label="Vehicle Color"
              placeholder="e.g., White, Silver, Black"
              icon={icons.marker}
              value={form.vehicleColor}
              onChangeText={(value) => setForm({ ...form, vehicleColor: value })}
              containerStyle="mt-4"
            />

            {/* License Details */}
            <Text className="text-gray-800 font-JakartaSemiBold mt-6 mb-3">
              Driving License
            </Text>

            <InputField
              label="License Number"
              placeholder="DL Number"
              icon={icons.list}
              value={form.licenseNumber}
              onChangeText={(value) =>
                setForm({ ...form, licenseNumber: value.toUpperCase() })
              }
              autoCapitalize="characters"
            />

            <InputField
              label="License Expiry Date"
              placeholder="DD/MM/YYYY"
              icon={icons.list}
              value={form.licenseExpiry}
              onChangeText={(value) => setForm({ ...form, licenseExpiry: value })}
              containerStyle="mt-4"
            />

            <CustomButton
              title="Continue to Documents"
              onPress={onContinue}
              className="mt-8 bg-green-500"
            />

            <TouchableOpacity
              onPress={() => router.back()}
              className="mt-4 items-center"
            >
              <Text className="text-gray-500">← Back to Personal Info</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default VehicleInfo;
