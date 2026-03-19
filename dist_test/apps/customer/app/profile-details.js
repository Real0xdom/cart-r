"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const AuthContext_1 = require("@/contexts/AuthContext");
const react_native_1 = require("react-native");
const react_native_safe_area_context_1 = require("react-native-safe-area-context");
const expo_router_1 = require("expo-router");
const vector_icons_1 = require("@expo/vector-icons");
const InputField_1 = __importDefault(require("@/components/InputField"));
const ProfileDetails = () => {
    const { profile } = (0, AuthContext_1.useAuth)();
    return (<react_native_safe_area_context_1.SafeAreaView className="flex-1 bg-white px-5">
      {/* Header with Back Button */}
      <react_native_1.View className="flex flex-row items-center py-4">
        <react_native_1.TouchableOpacity onPress={() => expo_router_1.router.back()} className="mr-4">
          <vector_icons_1.Ionicons name="arrow-back" size={24} color="black"/>
        </react_native_1.TouchableOpacity>
        <react_native_1.Text className="text-xl font-JakartaBold">Profile Details</react_native_1.Text>
      </react_native_1.View>

      {/* Avatar */}
      <react_native_1.View className="items-center my-6">
        <react_native_1.Image source={{
            uri: (profile === null || profile === void 0 ? void 0 : profile.avatar_url) || "https://ui-avatars.com/api/?name=" + ((profile === null || profile === void 0 ? void 0 : profile.name) || "User"),
        }} className="rounded-full h-24 w-24 border-2 border-gray-100"/>
      </react_native_1.View>

      {/* Info Fields */}
      <react_native_1.View className="bg-gray-50 rounded-xl p-4">
        <InputField_1.default label="Name" placeholder={(profile === null || profile === void 0 ? void 0 : profile.name) || "Not Found"} containerStyle="w-full" inputStyle="p-3" editable={false}/>

        <InputField_1.default label="Email" placeholder={(profile === null || profile === void 0 ? void 0 : profile.email) || "Not Found"} containerStyle="w-full" inputStyle="p-3" editable={false}/>

        <InputField_1.default label="Phone" placeholder={(profile === null || profile === void 0 ? void 0 : profile.phone) || "Not Found"} containerStyle="w-full" inputStyle="p-3" editable={false}/>
      </react_native_1.View>
    </react_native_safe_area_context_1.SafeAreaView>);
};
exports.default = ProfileDetails;
