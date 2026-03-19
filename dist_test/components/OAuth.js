"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const clerk_expo_1 = require("@clerk/clerk-expo");
const expo_router_1 = require("expo-router");
const react_native_1 = require("react-native");
const CustomButton_1 = __importDefault(require("@/components/CustomButton"));
const constants_1 = require("@/constants");
const auth_1 = require("@/lib/auth");
const OAuth = () => {
    const { startOAuthFlow } = (0, clerk_expo_1.useOAuth)({ strategy: "oauth_google" });
    const handleGoogleSignIn = async () => {
        const result = await (0, auth_1.googleOAuth)(startOAuthFlow);
        if (result.code === "session_exists") {
            react_native_1.Alert.alert("Success", "Session exists. Redirecting to home screen.");
            expo_router_1.router.replace("/(root)/(tabs)/home");
        }
        react_native_1.Alert.alert(result.success ? "Success" : "Error", result.message);
    };
    return (<react_native_1.View>
      <react_native_1.View className="flex flex-row justify-center items-center mt-4 gap-x-3">
        <react_native_1.View className="flex-1 h-[1px] bg-general-100"/>
        <react_native_1.Text className="text-lg">Or</react_native_1.Text>
        <react_native_1.View className="flex-1 h-[1px] bg-general-100"/>
      </react_native_1.View>

      <CustomButton_1.default title="Log In with Google" className="mt-5 w-full shadow-none" IconLeft={() => (<react_native_1.Image source={constants_1.icons.google} resizeMode="contain" className="w-5 h-5 mx-2"/>)} bgVariant="outline" textVariant="primary" onPress={handleGoogleSignIn}/>
    </react_native_1.View>);
};
exports.default = OAuth;
