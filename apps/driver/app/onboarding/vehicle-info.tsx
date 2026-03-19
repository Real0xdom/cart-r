import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Redirect, router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import CustomButton from "@/components/CustomButton";
import DateField from "@/components/DateField";
import DropdownField from "@/components/DropdownField";
import InputField from "@/components/InputField";
import { icons } from "@/constants";
import { useAuth } from "@/contexts/AuthContext";
import { getActiveVehicleTypes, VehicleType } from "@/lib/vehicleTypes";

const VEHICLE_COLORS = [
  { label: "White", value: "White" },
  { label: "Silver", value: "Silver" },
  { label: "Black", value: "Black" },
  { label: "Grey", value: "Grey" },
  { label: "Red", value: "Red" },
  { label: "Blue", value: "Blue" },
  { label: "Other", value: "Other" },
];

const OTHER_COLOR_OPTION = "Other";

const getVehicleTypeIcon = (vehicleType?: string, iconEmoji?: string) => {
  const normalized = `${vehicleType || ""} ${iconEmoji || ""}`.toLowerCase();

  if (normalized.includes("bike") || normalized.includes("scooter")) {
    return <MaterialCommunityIcons name="motorbike" size={26} color="#15803d" />;
  }

  if (normalized.includes("auto") || normalized.includes("rickshaw")) {
    return <MaterialCommunityIcons name="rickshaw" size={26} color="#15803d" />;
  }

  if (
    normalized.includes("truck") ||
    normalized.includes("pickup") ||
    normalized.includes("lorry") ||
    normalized.includes("van")
  ) {
    return (
      <MaterialCommunityIcons
        name="truck-delivery-outline"
        size={26}
        color="#15803d"
      />
    );
  }

  return <Ionicons name="car-sport-outline" size={26} color="#15803d" />;
};

const VehicleInfo = () => {
  const { driverProfile } = useAuth();

  if (driverProfile?.verification_status === "approved") {
    console.log("[VehicleInfo] Driver is already approved - redirecting to home");
    return <Redirect href="/(tabs)/home" />;
  }

  const [selectedType, setSelectedType] = useState<string | null>(
    driverProfile?.vehicle_type || null
  );
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([]);
  const [loadingVehicles, setLoadingVehicles] = useState(true);

  useEffect(() => {
    const fetchVehicles = async () => {
      try {
        console.log("[VEHICLE INFO] Fetching admin-approved vehicle types...");
        const { data, error } = await getActiveVehicleTypes();
        if (error) {
          console.error("[VEHICLE INFO] Error fetching vehicles:", error);
          Alert.alert("Error", "Failed to load vehicle types. Please try again.");
          return;
        }
        if (data && data.length > 0) {
          console.log(
            "[VEHICLE INFO] Loaded vehicle types:",
            data.length,
            data.map((v) => v.vehicle_type).join(", ")
          );
          setVehicleTypes(data);
        } else {
          console.warn("[VEHICLE INFO] No vehicle types available");
          Alert.alert(
            "No Vehicles",
            "No vehicle types are currently available. Please contact support."
          );
        }
      } catch (err) {
        console.error("[VEHICLE INFO] Exception fetching vehicles:", err);
        Alert.alert("Error", "An error occurred while loading vehicles.");
      } finally {
        setLoadingVehicles(false);
      }
    };

    fetchVehicles();
  }, []);

  const [form, setForm] = useState({
    vehicleNumber: driverProfile?.vehicle_number || "",
    vehicleModel: driverProfile?.vehicle_model || "",
    vehicleColor: driverProfile?.vehicle_color || "",
    licenseNumber: driverProfile?.license_number || "",
    licenseExpiryDate: driverProfile?.license_expiry
      ? new Date(driverProfile.license_expiry)
      : null,
  });
  const [customVehicleColor, setCustomVehicleColor] = useState(
    driverProfile?.vehicle_color &&
      !VEHICLE_COLORS.some((option) => option.value === driverProfile.vehicle_color)
      ? driverProfile.vehicle_color
      : ""
  );

  const [errors, setErrors] = useState<{
    vehicleNumber?: string;
    vehicleModel?: string;
    vehicleColor?: string;
    licenseNumber?: string;
    licenseExpiryDate?: string;
  }>({});

  useEffect(() => {
    setErrors((prev) => ({ ...prev, vehicleNumber: undefined }));
  }, [form.vehicleNumber]);

  useEffect(() => {
    setErrors((prev) => ({ ...prev, vehicleModel: undefined }));
  }, [form.vehicleModel]);

  useEffect(() => {
    setErrors((prev) => ({ ...prev, vehicleColor: undefined }));
  }, [form.vehicleColor]);

  useEffect(() => {
    if (form.vehicleColor === OTHER_COLOR_OPTION) {
      setErrors((prev) => ({ ...prev, vehicleColor: undefined }));
    }
  }, [customVehicleColor, form.vehicleColor]);

  useEffect(() => {
    setErrors((prev) => ({ ...prev, licenseNumber: undefined }));
  }, [form.licenseNumber]);

  useEffect(() => {
    setErrors((prev) => ({ ...prev, licenseExpiryDate: undefined }));
  }, [form.licenseExpiryDate]);

  const validateVehicleNumber = (value: string): boolean => {
    const message = getVehicleNumberError(value);

    setErrors((prev) => ({ ...prev, vehicleNumber: message }));
    return !message;
  };

  const validateLicenseNumber = (value: string): boolean => {
    const message = getLicenseNumberError(value);

    setErrors((prev) => ({ ...prev, licenseNumber: message }));
    return !message;
  };

  const validateLicenseExpiry = (date: Date | null): boolean => {
    const message = getLicenseExpiryError(date);

    setErrors((prev) => ({ ...prev, licenseExpiryDate: message }));
    return !message;
  };

  const getVehicleNumberError = (value: string) => {
    const cleanValue = value.replace(/\s/g, "").toUpperCase();
    const vehicleNumberPattern = /^[A-Z]{2}[0-9]{1,2}[A-Z]{0,2}[0-9]{4}$/;

    if (!cleanValue) {
      return "Vehicle number is required";
    }

    if (!vehicleNumberPattern.test(cleanValue)) {
      return "Invalid format. Use format like KA01AB1234";
    }

    return undefined;
  };

  const getLicenseNumberError = (value: string) => {
    if (!value.trim()) {
      return "License number is required";
    }

    if (value.length < 6) {
      return "License number is too short";
    }

    return undefined;
  };

  const getLicenseExpiryError = (date: Date | null) => {
    if (!date) {
      return "Please select expiry date";
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (date < today) {
      return "Expiry date cannot be in the past. Please select a valid future date.";
    }

    const maxDate = new Date();
    maxDate.setFullYear(maxDate.getFullYear() + 20);

    if (date > maxDate) {
      return "Expiry date seems incorrect. Please verify.";
    }

    return undefined;
  };

  const onContinue = () => {
    let hasErrors = false;
    const validationMessages: string[] = [];

    if (!selectedType) {
      Alert.alert("Error", "Please select your vehicle type");
      return;
    }

    const isVehicleNumberValid = validateVehicleNumber(form.vehicleNumber);
    const isLicenseNumberValid = validateLicenseNumber(form.licenseNumber);
    const isLicenseExpiryValid = validateLicenseExpiry(form.licenseExpiryDate);

    const resolvedVehicleModel = form.vehicleModel.trim();
    const resolvedVehicleColor =
      form.vehicleColor === OTHER_COLOR_OPTION
        ? customVehicleColor.trim()
        : form.vehicleColor.trim();

    if (!resolvedVehicleModel) {
      setErrors((prev) => ({
        ...prev,
        vehicleModel: "Please enter your vehicle model",
      }));
      hasErrors = true;
      validationMessages.push("Vehicle model is required.");
    }

    if (!resolvedVehicleColor) {
      const vehicleColorMessage =
        form.vehicleColor === OTHER_COLOR_OPTION
          ? "Please enter your vehicle color"
          : "Please select a vehicle color";

      setErrors((prev) => ({
        ...prev,
        vehicleColor: vehicleColorMessage,
      }));
      hasErrors = true;
      validationMessages.push(`${vehicleColorMessage}.`);
    }

    const vehicleNumberError = getVehicleNumberError(form.vehicleNumber);
    const licenseNumberError = getLicenseNumberError(form.licenseNumber);
    const licenseExpiryError = getLicenseExpiryError(form.licenseExpiryDate);

    if (!isVehicleNumberValid && vehicleNumberError) {
      validationMessages.push(`Vehicle number: ${vehicleNumberError}.`);
    }

    if (!isLicenseNumberValid && licenseNumberError) {
      validationMessages.push(`License number: ${licenseNumberError}.`);
    }

    if (!isLicenseExpiryValid && licenseExpiryError) {
      validationMessages.push(`License expiry date: ${licenseExpiryError}.`);
    }

    if (
      !isVehicleNumberValid ||
      !isLicenseNumberValid ||
      !isLicenseExpiryValid ||
      hasErrors
    ) {
      Alert.alert(
        "Validation Error",
        validationMessages.join("\n")
      );
      return;
    }

    const cleanVehicleNumber = form.vehicleNumber.replace(/\s/g, "").toUpperCase();
    const formattedExpiry = `${form.licenseExpiryDate!
      .getDate()
      .toString()
      .padStart(2, "0")}/${(form.licenseExpiryDate!.getMonth() + 1)
      .toString()
      .padStart(2, "0")}/${form.licenseExpiryDate!.getFullYear()}`;

    router.push({
      pathname: "/onboarding/documents",
      params: {
        vehicleType: selectedType,
        vehicleNumber: cleanVehicleNumber,
        vehicleModel: resolvedVehicleModel,
        vehicleColor: resolvedVehicleColor,
        licenseNumber: form.licenseNumber,
        licenseExpiry: formattedExpiry,
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
          <View className="h-[180px] w-full justify-center bg-green-500 px-5">
            <Text className="mb-2 text-sm font-Jakarta text-white">
              Step 2 of 3
            </Text>
            <Text className="text-2xl font-JakartaBold text-white">
              Vehicle Information
            </Text>
            <Text className="mt-2 text-green-100">
              Tell us about your vehicle
            </Text>
          </View>

          <View className="mt-4 px-5">
            <View className="flex-row h-2 overflow-hidden rounded-full bg-gray-200">
              <View className="w-2/3 rounded-full bg-green-500" />
            </View>
          </View>

          <View className="p-5">
            <Text className="mb-3 font-JakartaSemiBold text-gray-800">
              Select Vehicle Type
            </Text>

            {loadingVehicles ? (
              <View className="items-center justify-center py-8">
                <ActivityIndicator size="large" color="#16a34a" />
                <Text className="mt-2 text-gray-500">
                  Loading available vehicles...
                </Text>
              </View>
            ) : vehicleTypes.length === 0 ? (
              <View className="items-center justify-center rounded-xl bg-red-50 py-8">
                <Text className="font-JakartaSemiBold text-red-600">
                  No vehicles available
                </Text>
                <Text className="mt-2 text-xs text-red-500">
                  Please contact support
                </Text>
              </View>
            ) : (
              <View className="flex-row flex-wrap justify-between">
                {vehicleTypes.map((type) => (
                  <TouchableOpacity
                    key={type.vehicle_type}
                    onPress={() => setSelectedType(type.vehicle_type)}
                    className={`mb-3 w-[48%] rounded-xl border-2 p-4 ${
                      selectedType === type.vehicle_type
                        ? "border-green-500 bg-green-50"
                        : "border-gray-200 bg-white"
                    }`}
                  >
                    <View className="mb-2 h-11 w-11 items-center justify-center rounded-full bg-green-100">
                      {getVehicleTypeIcon(type.vehicle_type, type.icon_emoji)}
                    </View>
                    <Text
                      className={`font-JakartaSemiBold ${
                        selectedType === type.vehicle_type
                          ? "text-green-700"
                          : "text-gray-800"
                      }`}
                    >
                      {type.display_name}
                    </Text>
                    <Text className="text-xs text-gray-500">
                      {type.description}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <Text className="mb-3 mt-4 font-JakartaSemiBold text-gray-800">
              Vehicle Details
            </Text>

            <InputField
              label="Vehicle Number *"
              placeholder="KA01AB1234"
              icon={icons.marker}
              value={form.vehicleNumber}
              onChangeText={(value) =>
                setForm({ ...form, vehicleNumber: value.toUpperCase() })
              }
              autoCapitalize="characters"
              error={!!errors.vehicleNumber}
              errorMessage={errors.vehicleNumber}
            />
            {errors.vehicleNumber && (
              <Text className="ml-2 mt-1 text-xs text-red-500">
                {errors.vehicleNumber}
              </Text>
            )}

            <InputField
              label="Vehicle Model *"
              placeholder="Type your vehicle model"
              icon={icons.marker}
              value={form.vehicleModel}
              onChangeText={(value) => setForm({ ...form, vehicleModel: value })}
              containerStyle="mt-4"
              error={!!errors.vehicleModel}
              errorMessage={errors.vehicleModel}
            />
            {errors.vehicleModel && (
              <Text className="ml-2 mt-1 text-xs text-red-500">
                {errors.vehicleModel}
              </Text>
            )}

            <DropdownField
              label="Vehicle Color *"
              placeholder="Select color"
              icon={icons.marker}
              options={VEHICLE_COLORS}
              value={form.vehicleColor}
              onSelect={(value) =>
                setForm({ ...form, vehicleColor: value })
              }
              containerStyle="mt-4"
              error={!!errors.vehicleColor}
            />
            {form.vehicleColor === OTHER_COLOR_OPTION ? (
              <InputField
                label="Enter Vehicle Color *"
                placeholder="Type your vehicle color"
                icon={icons.marker}
                value={customVehicleColor}
                onChangeText={setCustomVehicleColor}
                containerStyle="mt-3"
                error={!!errors.vehicleColor}
                errorMessage={errors.vehicleColor}
              />
            ) : null}
            {errors.vehicleColor && form.vehicleColor !== OTHER_COLOR_OPTION && (
              <Text className="ml-2 mt-1 text-xs text-red-500">
                {errors.vehicleColor}
              </Text>
            )}

            <Text className="mb-3 mt-6 font-JakartaSemiBold text-gray-800">
              Driving License
            </Text>

            <InputField
              label="License Number *"
              placeholder="DL Number"
              icon={icons.list}
              value={form.licenseNumber}
              onChangeText={(value) =>
                setForm({ ...form, licenseNumber: value.toUpperCase() })
              }
              autoCapitalize="characters"
              onBlur={() => validateLicenseNumber(form.licenseNumber)}
              error={!!errors.licenseNumber}
              errorMessage={errors.licenseNumber}
            />
            {errors.licenseNumber && (
              <Text className="ml-2 mt-1 text-xs text-red-500">
                {errors.licenseNumber}
              </Text>
            )}

            <DateField
              label="License Expiry Date *"
              placeholder="Select Date"
              icon={icons.list}
              value={form.licenseExpiryDate}
              onChange={(date) => {
                setForm({ ...form, licenseExpiryDate: date });
                validateLicenseExpiry(date);
              }}
              containerStyle="mt-4"
              minimumDate={new Date()}
              error={!!errors.licenseExpiryDate}
            />
            {errors.licenseExpiryDate && (
              <Text className="ml-2 mt-1 text-xs text-red-500">
                {errors.licenseExpiryDate}
              </Text>
            )}

            <CustomButton
              title="Continue to Documents"
              onPress={onContinue}
              className="mt-8 bg-green-500"
            />

            <TouchableOpacity
              onPress={() => router.back()}
              className="mt-4 items-center"
            >
              <Text className="text-gray-500">Back to Personal Info</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default VehicleInfo;
