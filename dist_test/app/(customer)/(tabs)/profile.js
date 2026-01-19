"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const AuthContext_1 = require("@/contexts/AuthContext");
const react_native_1 = require("react-native");
const react_native_safe_area_context_1 = require("react-native-safe-area-context");
const InputField_1 = __importDefault(require("@/components/InputField"));
const Profile = () => {
    const { profile } = (0, AuthContext_1.useAuth)();
    return (<react_native_safe_area_context_1.SafeAreaView className="flex-1">
      <react_native_1.ScrollView className="px-5" contentContainerStyle={{ paddingBottom: 120 }}>
        <react_native_1.Text className="text-2xl font-JakartaBold my-5">My profile</react_native_1.Text>

        <react_native_1.View className="flex items-center justify-center my-5">
          <react_native_1.Image source={{
            uri: "https://ui-avatars.com/api/?name=" + ((profile === null || profile === void 0 ? void 0 : profile.name) || "User"),
        }} style={{ width: 110, height: 110, borderRadius: 110 / 2 }} className=" rounded-full h-[110px] w-[110px] border-[3px] border-white shadow-sm shadow-neutral-300"/>
        </react_native_1.View>

        <react_native_1.View className="flex flex-col items-start justify-center bg-white rounded-lg shadow-sm shadow-neutral-300 px-5 py-3">
          <react_native_1.View className="flex flex-col items-start justify-start w-full">
            <InputField_1.default label="Name" placeholder={(profile === null || profile === void 0 ? void 0 : profile.name) || "Not Found"} containerStyle="w-full" inputStyle="p-3.5" editable={false}/>

            <InputField_1.default label="Email" placeholder={(profile === null || profile === void 0 ? void 0 : profile.email) || "Not Found"} containerStyle="w-full" inputStyle="p-3.5" editable={false}/>

            <InputField_1.default label="Phone" placeholder={(profile === null || profile === void 0 ? void 0 : profile.phone) || "Not Found"} containerStyle="w-full" inputStyle="p-3.5" editable={false}/>
          </react_native_1.View>
        </react_native_1.View>
      </react_native_1.ScrollView>
    </react_native_safe_area_context_1.SafeAreaView>);
};
exports.default = Profile;
