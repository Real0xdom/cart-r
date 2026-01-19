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
const supabase_1 = require("@/lib/supabase");
const DriverSignIn = () => {
    const { signInWithPhone, verifyOtp, refreshProfile } = (0, AuthContext_1.useAuth)();
    const [form, setForm] = (0, react_1.useState)({
        phone: "+91",
        otp: "",
    });
    const [step, setStep] = (0, react_1.useState)('phone');
    const [loading, setLoading] = (0, react_1.useState)(false);
    const formatPhone = (phone) => {
        if (!phone.startsWith('+')) {
            return '+' + phone;
        }
        return phone;
    };
    const onSendOtpPress = async () => {
        if (!form.phone || form.phone.length < 10) {
            return react_native_1.Alert.alert("Error", "Please enter a valid phone number with country code (e.g., +919876543210)");
        }
        const formattedPhone = formatPhone(form.phone);
        setLoading(true);
        try {
            const { error } = await signInWithPhone(formattedPhone);
            if (error) {
                react_native_1.Alert.alert("Error", error.message);
            }
            else {
                react_native_1.Alert.alert("OTP Sent", `We've sent a verification code to ${formattedPhone}`);
                setStep('otp');
            }
        }
        catch (err) {
            react_native_1.Alert.alert("Error", err.message || "Failed to send OTP");
        }
        finally {
            setLoading(false);
        }
    };
    const onVerifyOtpPress = async () => {
        var _a;
        if (!form.otp || form.otp.length !== 6) {
            return react_native_1.Alert.alert("Error", "Please enter the 6-digit OTP");
        }
        const formattedPhone = formatPhone(form.phone);
        setLoading(true);
        try {
            const { error, data } = await verifyOtp(formattedPhone, form.otp);
            if (error) {
                react_native_1.Alert.alert("Error", error.message);
            }
            else {
                // Check if driver record exists - DATABASE IS THE SINGLE SOURCE OF TRUTH
                const { data: driverData } = await supabase_1.supabase
                    .from("drivers")
                    .select("id, verification_status")
                    .eq("user_id", (_a = data === null || data === void 0 ? void 0 : data.user) === null || _a === void 0 ? void 0 : _a.id)
                    .single();
                // Sync AuthContext with database BEFORE navigating
                await refreshProfile();
                if (!driverData) {
                    // New driver - go to onboarding form
                    expo_router_1.router.replace("/onboarding/personal-info");
                }
                else if (driverData.verification_status === "approved") {
                    // ✅ Approved driver - go directly to main app
                    expo_router_1.router.replace("/(tabs)/home");
                }
                else if (driverData.verification_status === "pending") {
                    // ⏳ Pending verification - show pending screen
                    expo_router_1.router.replace("/onboarding/verification-pending");
                }
                else if (driverData.verification_status === "rejected") {
                    // ❌ Rejected - show rejection screen with option to resubmit
                    expo_router_1.router.replace("/onboarding/verification-pending");
                }
                else {
                    // Fallback for any other status - go to home
                    expo_router_1.router.replace("/(tabs)/home");
                }
            }
        }
        catch (err) {
            react_native_1.Alert.alert("Error", err.message || "Invalid OTP");
        }
        finally {
            setLoading(false);
        }
    };
    return (<react_native_1.KeyboardAvoidingView behavior={react_native_1.Platform.OS === "ios" ? "padding" : "height"} className="flex-1">
            <react_native_1.ScrollView className="flex-1 bg-white">
                <react_native_1.View className="flex-1 bg-white">
                    {/* Green Header for Driver App */}
                    <react_native_1.View className="w-full h-[220px] bg-green-500 justify-center items-center">
                        <react_native_1.Text className="text-6xl mb-3">🚗</react_native_1.Text>
                        <react_native_1.Text className="text-white text-2xl font-JakartaBold">
                            Carter Driver
                        </react_native_1.Text>
                        <react_native_1.Text className="text-green-100 mt-2">
                            Partner App for Drivers
                        </react_native_1.Text>
                    </react_native_1.View>

                    <react_native_1.View className="p-5">
                        {step === 'phone' ? (<>
                                <react_native_1.View className="mb-6">
                                    <react_native_1.Text className="text-lg font-JakartaSemiBold text-gray-800 mb-2">
                                        Driver Login
                                    </react_native_1.Text>
                                    <react_native_1.Text className="text-gray-500">
                                        Enter your registered mobile number
                                    </react_native_1.Text>
                                </react_native_1.View>

                                <InputField_1.default label="Mobile Number" placeholder="+91 9876543210" icon={constants_1.icons.email} value={form.phone} onChangeText={(value) => setForm({ ...form, phone: value })} keyboardType="phone-pad"/>

                                <CustomButton_1.default title={loading ? "Sending OTP..." : "Get OTP"} onPress={onSendOtpPress} className="mt-6 bg-green-500" disabled={loading}/>

                                <react_native_1.View className="mt-8 p-4 bg-gray-50 rounded-xl">
                                    <react_native_1.Text className="text-gray-600 text-center text-sm">
                                        🚗 Want to become a Carter driver?{"\n"}
                                        Contact us at{" "}
                                        <react_native_1.Text className="text-green-600 font-JakartaSemiBold">
                                            drivers@cart-r.com
                                        </react_native_1.Text>
                                    </react_native_1.Text>
                                </react_native_1.View>
                            </>) : (<>
                                <react_native_1.View className="mb-6">
                                    <react_native_1.Text className="text-lg font-JakartaSemiBold text-gray-800 mb-2">
                                        Verify your number
                                    </react_native_1.Text>
                                    <react_native_1.Text className="text-gray-500">
                                        Enter the 6-digit code sent to {form.phone}
                                    </react_native_1.Text>
                                </react_native_1.View>

                                <InputField_1.default label="Verification Code" placeholder="Enter 6-digit OTP" icon={constants_1.icons.lock} value={form.otp} onChangeText={(value) => setForm({ ...form, otp: value })} keyboardType="number-pad" maxLength={6}/>

                                <CustomButton_1.default title={loading ? "Verifying..." : "Verify & Start Driving"} onPress={onVerifyOtpPress} className="mt-6 bg-green-500" disabled={loading}/>

                                <react_native_1.TouchableOpacity onPress={() => setStep('phone')} className="mt-4 items-center">
                                    <react_native_1.Text className="text-green-500 font-JakartaSemiBold">
                                        Change phone number
                                    </react_native_1.Text>
                                </react_native_1.TouchableOpacity>

                                <react_native_1.TouchableOpacity onPress={onSendOtpPress} className="mt-2 items-center" disabled={loading}>
                                    <react_native_1.Text className="text-gray-400">
                                        Resend OTP
                                    </react_native_1.Text>
                                </react_native_1.TouchableOpacity>
                            </>)}
                    </react_native_1.View>
                </react_native_1.View>
            </react_native_1.ScrollView>
        </react_native_1.KeyboardAvoidingView>);
};
exports.default = DriverSignIn;
