"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = SavedAddresses;
const react_native_1 = require("react-native");
const react_native_safe_area_context_1 = require("react-native-safe-area-context");
const expo_router_1 = require("expo-router");
const vector_icons_1 = require("@expo/vector-icons");
function SavedAddresses() {
    return (<react_native_safe_area_context_1.SafeAreaView className="flex-1 bg-white px-5">
      {/* Header */}
      <react_native_1.View className="flex flex-row items-center py-4">
        <react_native_1.TouchableOpacity onPress={() => expo_router_1.router.back()} className="mr-4">
          <vector_icons_1.Ionicons name="arrow-back" size={24} color="black"/>
        </react_native_1.TouchableOpacity>
        <react_native_1.Text className="text-xl font-JakartaBold">Saved Addresses</react_native_1.Text>
      </react_native_1.View>

      {/* Content */}
      <react_native_1.View className="flex-1 items-center justify-center">
        <react_native_1.Text className="text-base text-gray-500">No saved addresses yet.</react_native_1.Text>
      </react_native_1.View>
    </react_native_safe_area_context_1.SafeAreaView>);
}
