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
const supabase_1 = require("@/lib/supabase");
const AuthContext_1 = require("@/contexts/AuthContext");
const PersonalInfo = () => {
    const { user, profile, driverProfile } = (0, AuthContext_1.useAuth)();
    // ROUTE GUARD: Approved drivers should NOT see onboarding - redirect to home
    if ((driverProfile === null || driverProfile === void 0 ? void 0 : driverProfile.verification_status) === 'approved') {
        console.log('[PersonalInfo] Driver is already approved - redirecting to home');
        return <expo_router_1.Redirect href="/(tabs)/home"/>;
    }
    const [loading, setLoading] = (0, react_1.useState)(false);
    const [form, setForm] = (0, react_1.useState)({
        fullName: (profile === null || profile === void 0 ? void 0 : profile.name) || "",
        email: (profile === null || profile === void 0 ? void 0 : profile.email) || "",
        phone: (user === null || user === void 0 ? void 0 : user.phone) || "",
    });
    const onContinue = async () => {
        if (!form.fullName.trim()) {
            return react_native_1.Alert.alert("Error", "Please enter your full name");
        }
        if (!form.email.trim() || !form.email.includes("@")) {
            return react_native_1.Alert.alert("Error", "Please enter a valid email address");
        }
        setLoading(true);
        try {
            // Update user profile in users table
            const { error } = await supabase_1.supabase
                .from("users")
                .upsert({
                id: user === null || user === void 0 ? void 0 : user.id,
                name: form.fullName.trim(),
                email: form.email.trim().toLowerCase(),
                phone: form.phone,
                role: "driver",
            });
            if (error) {
                react_native_1.Alert.alert("Error", error.message);
                return;
            }
            expo_router_1.router.push("/onboarding/vehicle-info");
        }
        catch (err) {
            react_native_1.Alert.alert("Error", err.message || "Something went wrong");
        }
        finally {
            setLoading(false);
        }
    };
    return (<react_native_1.KeyboardAvoidingView behavior={react_native_1.Platform.OS === "ios" ? "padding" : "height"} className="flex-1">
      <react_native_1.ScrollView className="flex-1 bg-white">
        <react_native_1.View className="flex-1 bg-white">
          {/* Header */}
          <react_native_1.View className="w-full h-[180px] bg-green-500 justify-center px-5">
            <react_native_1.Text className="text-white text-sm font-Jakarta mb-2">
              Step 1 of 3
            </react_native_1.Text>
            <react_native_1.Text className="text-white text-2xl font-JakartaBold">
              Personal Information
            </react_native_1.Text>
            <react_native_1.Text className="text-green-100 mt-2">
              Let's get to know you better
            </react_native_1.Text>
          </react_native_1.View>

          {/* Progress Bar */}
          <react_native_1.View className="px-5 mt-4">
            <react_native_1.View className="flex-row h-2 bg-gray-200 rounded-full overflow-hidden">
              <react_native_1.View className="w-1/3 bg-green-500 rounded-full"/>
            </react_native_1.View>
          </react_native_1.View>

          {/* Form */}
          <react_native_1.View className="p-5">
            <InputField_1.default label="Full Name" placeholder="Enter your full name" icon={constants_1.icons.person} value={form.fullName} onChangeText={(value) => setForm({ ...form, fullName: value })}/>

            <InputField_1.default label="Email Address" placeholder="driver@example.com" icon={constants_1.icons.email} value={form.email} onChangeText={(value) => setForm({ ...form, email: value })} keyboardType="email-address" containerStyle="mt-4"/>

            <InputField_1.default label="Phone Number" placeholder="+91 9876543210" icon={constants_1.icons.phone} value={form.phone} onChangeText={(value) => setForm({ ...form, phone: value })} keyboardType="phone-pad" containerStyle="mt-4" editable={false}/>

            <CustomButton_1.default title={loading ? "Saving..." : "Continue"} onPress={onContinue} className="mt-8 bg-green-500" disabled={loading}/>

            <react_native_1.View className="mt-6 p-4 bg-green-50 rounded-xl">
              <react_native_1.Text className="text-green-800 text-center text-sm">
                ℹ️ Your information is secure and will only be used to verify
                your identity as a CARTR driver partner.
              </react_native_1.Text>
            </react_native_1.View>
          </react_native_1.View>
        </react_native_1.View>
      </react_native_1.ScrollView>
    </react_native_1.KeyboardAvoidingView>);
};
exports.default = PersonalInfo;
