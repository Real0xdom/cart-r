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
const AuthContext_1 = require("@/contexts/AuthContext");
const DriverSignIn = () => {
    const { signInWithWhatsApp, verifyWhatsAppOtp } = (0, AuthContext_1.useAuth)();
    const [form, setForm] = (0, react_1.useState)({
        phone: "",
        otp: "",
    });
    const [step, setStep] = (0, react_1.useState)('phone');
    const [loading, setLoading] = (0, react_1.useState)(false);
    const onSignInPress = async () => {
        if (!form.phone)
            return react_native_1.Alert.alert("Error", "Please enter phone number");
        setLoading(true);
        try {
            const { error } = await signInWithWhatsApp(form.phone);
            if (error) {
                react_native_1.Alert.alert("Error", error.message);
            }
            else {
                setStep('otp');
            }
        }
        catch (err) {
            react_native_1.Alert.alert("Error", err.message);
        }
        finally {
            setLoading(false);
        }
    };
    const onVerifyPress = async () => {
        if (!form.otp)
            return react_native_1.Alert.alert("Error", "Please enter OTP");
        setLoading(true);
        const targetRole = 'driver';
        try {
            const { error } = await verifyWhatsAppOtp(form.phone, form.otp, targetRole);
            if (error) {
                react_native_1.Alert.alert("Error", error.message);
            }
            else {
                // Success
                // Check if driver logic needs additional steps, otherwise _layout redirect handles it
            }
        }
        catch (err) {
            react_native_1.Alert.alert("Error", err.message);
        }
        finally {
            setLoading(false);
        }
    };
    return (<react_native_1.ScrollView className="flex-1 bg-white">
            <react_native_1.View className="flex-1 bg-white">
                <react_native_1.View className="relative w-full h-[250px]">
                    {/* Use existing image or different one if available. Could use onboarding images */}
                    <react_native_1.Image source={constants_1.images.signUpCar} className="z-0 w-full h-[250px]"/>
                    <react_native_1.Text className="text-2xl text-black font-JakartaSemiBold absolute bottom-5 left-5">
                        Welcome Driver 👋
                    </react_native_1.Text>
                </react_native_1.View>

                <react_native_1.View className="p-5">
                    {step === 'phone' ? (<>
                            <react_native_1.View className="mb-6">
                                <react_native_1.Text className="text-gray-500 mb-2">Login or Register with WhatsApp to start earning.</react_native_1.Text>
                            </react_native_1.View>

                            <InputField_1.default label="WhatsApp Number" placeholder="Enter phone: +91 98765 43210" icon={constants_1.icons.email} value={form.phone} onChangeText={(value) => setForm({ ...form, phone: value })} keyboardType="phone-pad"/>
                            <CustomButton_1.default title={loading ? "Sending..." : "Continue as Driver"} onPress={onSignInPress} className="mt-6 bg-general-500" // Different color for Driver?
         disabled={loading}/>
                        </>) : (<>
                            <InputField_1.default label="OTP Code" placeholder="Enter 6-digit code" icon={constants_1.icons.lock} value={form.otp} onChangeText={(value) => setForm({ ...form, otp: value })} keyboardType="number-pad"/>
                            <react_native_1.View className="mt-6 gap-2">
                                <CustomButton_1.default title={loading ? "Verifying..." : "Verify & Start Driving"} onPress={onVerifyPress} className="bg-general-500" disabled={loading}/>
                                <CustomButton_1.default title="Change Number" onPress={() => setStep('phone')} className="bg-gray-100" textVariant="secondary" disabled={loading}/>
                            </react_native_1.View>
                        </>)}

                    <react_native_1.TouchableOpacity onPress={() => expo_router_1.router.replace('/')} className="mt-10 items-center">
                        <react_native_1.Text className="text-gray-400">Back to Role Selection</react_native_1.Text>
                    </react_native_1.TouchableOpacity>

                </react_native_1.View>
            </react_native_1.View>
        </react_native_1.ScrollView>);
};
exports.default = DriverSignIn;
