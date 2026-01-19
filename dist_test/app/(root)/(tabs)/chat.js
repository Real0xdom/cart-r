"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const react_native_1 = require("react-native");
const react_native_safe_area_context_1 = require("react-native-safe-area-context");
const constants_1 = require("@/constants");
const Chat = () => {
    return (<react_native_safe_area_context_1.SafeAreaView className="flex-1 bg-white p-5">
      <react_native_1.ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <react_native_1.Text className="text-2xl font-JakartaBold">Chat</react_native_1.Text>
        <react_native_1.View className="flex-1 h-fit flex justify-center items-center">
          <react_native_1.Image source={constants_1.images.message} alt="message" className="w-full h-40" resizeMode="contain"/>
          <react_native_1.Text className="text-3xl font-JakartaBold mt-3">
            No Messages Yet
          </react_native_1.Text>
          <react_native_1.Text className="text-base mt-2 text-center px-7">
            Start a conversation with your friends and family
          </react_native_1.Text>
        </react_native_1.View>
      </react_native_1.ScrollView>
    </react_native_safe_area_context_1.SafeAreaView>);
};
exports.default = Chat;
