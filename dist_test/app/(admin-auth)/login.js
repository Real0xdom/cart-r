"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = AdminLogin;
const react_native_1 = require("react-native");
const AuthContext_1 = require("@/contexts/AuthContext");
const react_native_safe_area_context_1 = require("react-native-safe-area-context");
function AdminLogin() {
    const { adminSignIn } = (0, AuthContext_1.useAuth)();
    return (<react_native_safe_area_context_1.SafeAreaView className="flex-1 bg-gray-100 justify-center items-center">
      <react_native_1.View className="bg-white p-8 rounded-xl w-[360px] shadow">
        <react_native_1.Text className="text-2xl font-JakartaBold mb-6 text-center">
          Carter Admin
        </react_native_1.Text>

        <react_native_1.TextInput placeholder="Admin Email" className="border px-4 py-3 rounded-lg mb-4"/>

        <react_native_1.TextInput placeholder="Password" secureTextEntry className="border px-4 py-3 rounded-lg mb-6"/>

        <react_native_1.TouchableOpacity onPress={adminSignIn} className="bg-black py-3 rounded-lg">
          <react_native_1.Text className="text-white text-center font-JakartaMedium">
            Login
          </react_native_1.Text>
        </react_native_1.TouchableOpacity>
      </react_native_1.View>
    </react_native_safe_area_context_1.SafeAreaView>);
}
