"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const react_native_1 = require("react-native");
const react_1 = require("react");
const react_native_safe_area_context_1 = require("react-native-safe-area-context");
const InputField_1 = __importDefault(require("@/components/InputField"));
const CustomButton_1 = __importDefault(require("@/components/CustomButton"));
const constants_1 = require("@/constants");
const AuthContext_1 = require("@/contexts/AuthContext");
const AdminLogin = () => {
    const { signIn } = (0, AuthContext_1.useAuth)();
    const [form, setForm] = (0, react_1.useState)({
        email: '',
        password: '',
    });
    const [loading, setLoading] = (0, react_1.useState)(false);
    const onSignInPress = async () => {
        setLoading(true);
        try {
            const { error } = await signIn(form.email, form.password);
            if (error) {
                react_native_1.Alert.alert('Error', error.message);
            }
            else {
                // Router redirect handled by _layout.tsx based on rule
                // But we can force check
                // router.replace('/(admin)/dashboard');
            }
        }
        catch (err) {
            react_native_1.Alert.alert('Error', err.message);
        }
        finally {
            setLoading(false);
        }
    };
    return (<react_native_safe_area_context_1.SafeAreaView className="flex-1 bg-white">
            <react_native_1.ScrollView contentContainerStyle={{ flexGrow: 1 }}>
                <react_native_1.View className="flex-1 p-5 justify-center">
                    <react_native_1.View className="items-center mb-10">
                        <react_native_1.Text className="text-3xl font-JakartaBold">Admin Portal</react_native_1.Text>
                        <react_native_1.Text className="text-gray-400 mt-2">Authorized Personnel Only</react_native_1.Text>
                    </react_native_1.View>

                    <InputField_1.default label="Email" placeholder="admin@example.com" icon={constants_1.icons.email} value={form.email} onChangeText={(value) => setForm({ ...form, email: value })}/>

                    <InputField_1.default label="Password" placeholder="Enter password" icon={constants_1.icons.lock} secureTextEntry={true} value={form.password} onChangeText={(value) => setForm({ ...form, password: value })}/>

                    <CustomButton_1.default title={loading ? "Logging in..." : "Login"} onPress={onSignInPress} className="mt-6" disabled={loading}/>
                </react_native_1.View>
            </react_native_1.ScrollView>
        </react_native_safe_area_context_1.SafeAreaView>);
};
exports.default = AdminLogin;
