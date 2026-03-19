"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const clerk_expo_1 = require("@clerk/clerk-expo");
const react_native_1 = require("react-native");
const react_native_safe_area_context_1 = require("react-native-safe-area-context");
const InputField_1 = __importDefault(require("@/components/InputField"));
const Profile = () => {
    var _a, _b, _c, _d;
    const { user } = (0, clerk_expo_1.useUser)();
    return (<react_native_safe_area_context_1.SafeAreaView className="flex-1">
      <react_native_1.ScrollView className="px-5" contentContainerStyle={{ paddingBottom: 120 }}>
        <react_native_1.Text className="text-2xl font-JakartaBold my-5">My profile</react_native_1.Text>

        <react_native_1.View className="flex items-center justify-center my-5">
          <react_native_1.Image source={{
            uri: (_b = (_a = user === null || user === void 0 ? void 0 : user.externalAccounts[0]) === null || _a === void 0 ? void 0 : _a.imageUrl) !== null && _b !== void 0 ? _b : user === null || user === void 0 ? void 0 : user.imageUrl,
        }} style={{ width: 110, height: 110, borderRadius: 110 / 2 }} className=" rounded-full h-[110px] w-[110px] border-[3px] border-white shadow-sm shadow-neutral-300"/>
        </react_native_1.View>

        <react_native_1.View className="flex flex-col items-start justify-center bg-white rounded-lg shadow-sm shadow-neutral-300 px-5 py-3">
          <react_native_1.View className="flex flex-col items-start justify-start w-full">
            <InputField_1.default label="First name" placeholder={(user === null || user === void 0 ? void 0 : user.firstName) || "Not Found"} containerStyle="w-full" inputStyle="p-3.5" editable={false}/>

            <InputField_1.default label="Last name" placeholder={(user === null || user === void 0 ? void 0 : user.lastName) || "Not Found"} containerStyle="w-full" inputStyle="p-3.5" editable={false}/>

            <InputField_1.default label="Email" placeholder={((_c = user === null || user === void 0 ? void 0 : user.primaryEmailAddress) === null || _c === void 0 ? void 0 : _c.emailAddress) || "Not Found"} containerStyle="w-full" inputStyle="p-3.5" editable={false}/>

            <InputField_1.default label="Phone" placeholder={((_d = user === null || user === void 0 ? void 0 : user.primaryPhoneNumber) === null || _d === void 0 ? void 0 : _d.phoneNumber) || "Not Found"} containerStyle="w-full" inputStyle="p-3.5" editable={false}/>
          </react_native_1.View>
        </react_native_1.View>
      </react_native_1.ScrollView>
    </react_native_safe_area_context_1.SafeAreaView>);
};
exports.default = Profile;
