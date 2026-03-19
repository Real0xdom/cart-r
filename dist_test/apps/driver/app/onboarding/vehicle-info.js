"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const expo_router_1 = require("expo-router");
const react_1 = require("react");
const react_native_1 = require("react-native");
const CustomButton_1 = __importDefault(require("@/components/CustomButton"));
const InputField_1 = __importDefault(require("@/components/InputField"));
const constants_1 = require("@/constants");
const VEHICLE_TYPES = [
    { id: "bike", name: "Bike", icon: "🏍️", description: "2-wheeler delivery" },
    { id: "tempo", name: "Tempo", icon: "🛺", description: "Three-wheeler cargo" },
    { id: "sedan", name: "Sedan", icon: "🚗", description: "Mini car/Sedan" },
    { id: "truck", name: "Truck", icon: "🚚", description: "Pickup/Truck" },
];
const AuthContext_1 = require("@/contexts/AuthContext");
const VehicleInfo = () => {
    var _a;
    const { driverProfile } = (0, AuthContext_1.useAuth)();
    // ROUTE GUARD: Approved drivers should NOT see onboarding - redirect to home
    if ((driverProfile === null || driverProfile === void 0 ? void 0 : driverProfile.verification_status) === 'approved') {
        console.log('[VehicleInfo] Driver is already approved - redirecting to home');
        return <expo_router_1.Redirect href="/(tabs)/home"/>;
    }
    const [selectedType, setSelectedType] = (0, react_1.useState)((driverProfile === null || driverProfile === void 0 ? void 0 : driverProfile.vehicle_type) || null);
    // Format date to DD/MM/YYYY for display
    const formatDate = (dateStr) => {
        if (!dateStr)
            return "";
        try {
            const date = new Date(dateStr);
            return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
        }
        catch (e) {
            return "";
        }
    };
    const [form, setForm] = (0, react_1.useState)({
        vehicleNumber: (driverProfile === null || driverProfile === void 0 ? void 0 : driverProfile.vehicle_number) || "",
        vehicleModel: (driverProfile === null || driverProfile === void 0 ? void 0 : driverProfile.vehicle_model) || "",
        vehicleColor: (driverProfile === null || driverProfile === void 0 ? void 0 : driverProfile.vehicle_color) || "",
        licenseNumber: (driverProfile === null || driverProfile === void 0 ? void 0 : driverProfile.license_number) || "",
        licenseExpiry: formatDate((_a = driverProfile === null || driverProfile === void 0 ? void 0 : driverProfile.license_expiry) !== null && _a !== void 0 ? _a : undefined),
    });
    const onContinue = () => {
        if (!selectedType) {
            return react_native_1.Alert.alert("Error", "Please select your vehicle type");
        }
        if (!form.vehicleNumber.trim()) {
            return react_native_1.Alert.alert("Error", "Please enter your vehicle number");
        }
        if (!form.vehicleModel.trim()) {
            return react_native_1.Alert.alert("Error", "Please enter your vehicle model");
        }
        if (!form.licenseNumber.trim()) {
            return react_native_1.Alert.alert("Error", "Please enter your driving license number");
        }
        if (!form.licenseExpiry.trim()) {
            return react_native_1.Alert.alert("Error", "Please enter your license expiry date");
        }
        // Store in navigation params or context for next screen
        expo_router_1.router.push({
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
    return (<react_native_1.KeyboardAvoidingView behavior={react_native_1.Platform.OS === "ios" ? "padding" : "height"} className="flex-1">
      <react_native_1.ScrollView className="flex-1 bg-white">
        <react_native_1.View className="flex-1 bg-white">
          {/* Header */}
          <react_native_1.View className="w-full h-[180px] bg-green-500 justify-center px-5">
            <react_native_1.Text className="text-white text-sm font-Jakarta mb-2">
              Step 2 of 3
            </react_native_1.Text>
            <react_native_1.Text className="text-white text-2xl font-JakartaBold">
              Vehicle Information
            </react_native_1.Text>
            <react_native_1.Text className="text-green-100 mt-2">
              Tell us about your vehicle
            </react_native_1.Text>
          </react_native_1.View>

          {/* Progress Bar */}
          <react_native_1.View className="px-5 mt-4">
            <react_native_1.View className="flex-row h-2 bg-gray-200 rounded-full overflow-hidden">
              <react_native_1.View className="w-2/3 bg-green-500 rounded-full"/>
            </react_native_1.View>
          </react_native_1.View>

          {/* Vehicle Type Selection */}
          <react_native_1.View className="p-5">
            <react_native_1.Text className="text-gray-800 font-JakartaSemiBold mb-3">
              Select Vehicle Type
            </react_native_1.Text>
            <react_native_1.View className="flex-row flex-wrap justify-between">
              {VEHICLE_TYPES.map((type) => (<react_native_1.TouchableOpacity key={type.id} onPress={() => setSelectedType(type.id)} className={`w-[48%] p-4 mb-3 rounded-xl border-2 ${selectedType === type.id
                ? "border-green-500 bg-green-50"
                : "border-gray-200 bg-white"}`}>
                  <react_native_1.Text className="text-2xl mb-1">{type.icon}</react_native_1.Text>
                  <react_native_1.Text className={`font-JakartaSemiBold ${selectedType === type.id
                ? "text-green-700"
                : "text-gray-800"}`}>
                    {type.name}
                  </react_native_1.Text>
                  <react_native_1.Text className="text-gray-500 text-xs">{type.description}</react_native_1.Text>
                </react_native_1.TouchableOpacity>))}
            </react_native_1.View>

            {/* Vehicle Details */}
            <react_native_1.Text className="text-gray-800 font-JakartaSemiBold mt-4 mb-3">
              Vehicle Details
            </react_native_1.Text>

            <InputField_1.default label="Vehicle Number" placeholder="KA01AB1234" icon={constants_1.icons.marker} value={form.vehicleNumber} onChangeText={(value) => setForm({ ...form, vehicleNumber: value.toUpperCase() })} autoCapitalize="characters"/>

            <InputField_1.default label="Vehicle Model" placeholder="e.g., Maruti Swift, Toyota Innova" icon={constants_1.icons.marker} value={form.vehicleModel} onChangeText={(value) => setForm({ ...form, vehicleModel: value })} containerStyle="mt-4"/>

            <InputField_1.default label="Vehicle Color" placeholder="e.g., White, Silver, Black" icon={constants_1.icons.marker} value={form.vehicleColor} onChangeText={(value) => setForm({ ...form, vehicleColor: value })} containerStyle="mt-4"/>

            {/* License Details */}
            <react_native_1.Text className="text-gray-800 font-JakartaSemiBold mt-6 mb-3">
              Driving License
            </react_native_1.Text>

            <InputField_1.default label="License Number" placeholder="DL Number" icon={constants_1.icons.list} value={form.licenseNumber} onChangeText={(value) => setForm({ ...form, licenseNumber: value.toUpperCase() })} autoCapitalize="characters"/>

            <InputField_1.default label="License Expiry Date" placeholder="DD/MM/YYYY" icon={constants_1.icons.list} value={form.licenseExpiry} onChangeText={(value) => setForm({ ...form, licenseExpiry: value })} containerStyle="mt-4"/>

            <CustomButton_1.default title="Continue to Documents" onPress={onContinue} className="mt-8 bg-green-500"/>

            <react_native_1.TouchableOpacity onPress={() => expo_router_1.router.back()} className="mt-4 items-center">
              <react_native_1.Text className="text-gray-500">← Back to Personal Info</react_native_1.Text>
            </react_native_1.TouchableOpacity>
          </react_native_1.View>
        </react_native_1.View>
      </react_native_1.ScrollView>
    </react_native_1.KeyboardAvoidingView>);
};
exports.default = VehicleInfo;
