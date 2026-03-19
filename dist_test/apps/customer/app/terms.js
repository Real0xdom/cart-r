"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = Terms;
const react_native_1 = require("react-native");
const react_native_safe_area_context_1 = require("react-native-safe-area-context");
const expo_router_1 = require("expo-router");
const vector_icons_1 = require("@expo/vector-icons");
function Terms() {
    return (<react_native_safe_area_context_1.SafeAreaView className="flex-1 bg-white px-5">
      {/* Header */}
      <react_native_1.View className="flex flex-row items-center py-4">
        <react_native_1.TouchableOpacity onPress={() => expo_router_1.router.back()} className="mr-4">
          <vector_icons_1.Ionicons name="arrow-back" size={24} color="black"/>
        </react_native_1.TouchableOpacity>
        <react_native_1.Text className="text-xl font-JakartaBold">Terms and Conditions</react_native_1.Text>
      </react_native_1.View>

      {/* Content */}
      <react_native_1.ScrollView showsVerticalScrollIndicator={false}>
        <react_native_1.Text className="text-base text-gray-700 leading-6">
          Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
        </react_native_1.Text>
      </react_native_1.ScrollView>
    </react_native_safe_area_context_1.SafeAreaView>);
}
