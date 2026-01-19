"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const expo_router_1 = require("expo-router");
const react_1 = require("react");
const react_native_1 = require("react-native");
const react_native_safe_area_context_1 = require("react-native-safe-area-context");
const vector_icons_1 = require("@expo/vector-icons");
const AuthContext_1 = require("@/contexts/AuthContext");
const supabase_1 = require("@/lib/supabase");
const RegisterScreen = () => {
    const params = (0, expo_router_1.useLocalSearchParams)();
    const phoneNumber = params.phone || "";
    const { signInWithPhone, verifyOtp } = (0, AuthContext_1.useAuth)();
    const [firstName, setFirstName] = (0, react_1.useState)("");
    const [lastName, setLastName] = (0, react_1.useState)("");
    const [email, setEmail] = (0, react_1.useState)("");
    const [whatsappUpdates, setWhatsappUpdates] = (0, react_1.useState)(true);
    const [otp, setOtp] = (0, react_1.useState)("");
    const [step, setStep] = (0, react_1.useState)('register');
    const [loading, setLoading] = (0, react_1.useState)(false);
    const otpInputRef = (0, react_1.useRef)(null);
    const isFormValid = () => {
        return firstName.trim().length > 0 &&
            lastName.trim().length > 0 &&
            email.trim().length > 0 &&
            email.includes('@');
    };
    const onRegisterPress = async () => {
        if (!isFormValid()) {
            return react_native_1.Alert.alert("Error", "Please fill in all required fields");
        }
        setLoading(true);
        try {
            // Send OTP to the phone number
            const { error } = await signInWithPhone(phoneNumber);
            if (error) {
                react_native_1.Alert.alert("Error", error.message);
            }
            else {
                react_native_1.Alert.alert("OTP Sent", `We've sent a verification code to ${phoneNumber}`);
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
        if (!otp || otp.length !== 6) {
            return react_native_1.Alert.alert("Error", "Please enter the 6-digit OTP");
        }
        setLoading(true);
        try {
            // First verify the OTP
            const { error, data } = await supabase_1.supabase.auth.verifyOtp({
                phone: phoneNumber,
                token: otp,
                type: 'sms',
            });
            if (error) {
                react_native_1.Alert.alert("Error", error.message);
                setLoading(false);
                return;
            }
            // OTP verified - now create or update the user profile
            if (data === null || data === void 0 ? void 0 : data.user) {
                const userEmail = email.trim() || `${phoneNumber.replace('+', '')}@phone.carter.app`;
                const fullName = `${firstName.trim()} ${lastName.trim()}`;
                // Try to insert first
                const { error: profileError } = await supabase_1.supabase
                    .from('users')
                    .insert({
                    id: data.user.id,
                    email: userEmail,
                    name: fullName,
                    phone: phoneNumber,
                    role: 'customer',
                });
                if (profileError) {
                    // If duplicate key error, profile already exists - UPDATE it with real data
                    if (profileError.code === '23505') {
                        console.log('Profile already exists, updating with real data...');
                        const { error: updateError } = await supabase_1.supabase
                            .from('users')
                            .update({
                            email: userEmail,
                            name: fullName,
                            phone: phoneNumber,
                        })
                            .eq('id', data.user.id);
                        if (updateError) {
                            console.error('Error updating profile:', updateError);
                        }
                        else {
                            console.log('Profile updated successfully with registration data');
                        }
                    }
                    else {
                        console.error('Error creating profile:', profileError);
                        react_native_1.Alert.alert("Error", "Failed to create profile. Please try again.");
                        setLoading(false);
                        return;
                    }
                }
                // Success - navigate directly to home (no alert)
                expo_router_1.router.replace("/(tabs)/home");
            }
        }
        catch (err) {
            react_native_1.Alert.alert("Error", err.message || "Invalid OTP");
        }
        finally {
            setLoading(false);
        }
    };
    const renderRegisterStep = () => (<react_native_1.ScrollView className="flex-1 px-6" contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
            {/* Header */}
            <react_native_1.View className="mt-8 mb-8">
                <react_native_1.Text className="text-3xl font-JakartaBold text-gray-900 mb-2">
                    Create Account
                </react_native_1.Text>
                <react_native_1.Text className="text-gray-500 font-JakartaMedium">
                    Complete your registration for{'\n'}
                    <react_native_1.Text className="font-JakartaBold text-gray-700">{phoneNumber}</react_native_1.Text>
                </react_native_1.Text>
            </react_native_1.View>

            {/* Form Fields */}
            <react_native_1.View className="space-y-4">
                {/* First Name */}
                <react_native_1.View className="mb-4">
                    <react_native_1.Text className="text-sm font-JakartaSemiBold text-gray-600 mb-2 ml-1">
                        First Name <react_native_1.Text className="text-danger-500">*</react_native_1.Text>
                    </react_native_1.Text>
                    <react_native_1.TextInput className="bg-gray-100 rounded-2xl px-4 py-4 text-base font-JakartaSemiBold border border-gray-200" placeholder="Enter your first name" placeholderTextColor="#9CA3AF" value={firstName} onChangeText={setFirstName} autoCapitalize="words"/>
                </react_native_1.View>

                {/* Last Name */}
                <react_native_1.View className="mb-4">
                    <react_native_1.Text className="text-sm font-JakartaSemiBold text-gray-600 mb-2 ml-1">
                        Last Name <react_native_1.Text className="text-danger-500">*</react_native_1.Text>
                    </react_native_1.Text>
                    <react_native_1.TextInput className="bg-gray-100 rounded-2xl px-4 py-4 text-base font-JakartaSemiBold border border-gray-200" placeholder="Enter your last name" placeholderTextColor="#9CA3AF" value={lastName} onChangeText={setLastName} autoCapitalize="words"/>
                </react_native_1.View>

                {/* Email */}
                <react_native_1.View className="mb-4">
                    <react_native_1.Text className="text-sm font-JakartaSemiBold text-gray-600 mb-2 ml-1">
                        Email Address <react_native_1.Text className="text-danger-500">*</react_native_1.Text>
                    </react_native_1.Text>
                    <react_native_1.TextInput className="bg-gray-100 rounded-2xl px-4 py-4 text-base font-JakartaSemiBold border border-gray-200" placeholder="Enter your email address" placeholderTextColor="#9CA3AF" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none"/>
                </react_native_1.View>

                {/* WhatsApp Updates Checkbox */}
                <react_native_1.TouchableOpacity onPress={() => setWhatsappUpdates(!whatsappUpdates)} className="flex-row items-center mb-6">
                    <react_native_1.View className={`w-6 h-6 rounded-md border-2 items-center justify-center mr-3 ${whatsappUpdates ? 'bg-success-500 border-success-500' : 'border-gray-300'}`}>
                        {whatsappUpdates && (<vector_icons_1.Feather name="check" size={14} color="#fff"/>)}
                    </react_native_1.View>
                    <react_native_1.Text className="flex-1 text-gray-600 font-JakartaMedium">
                        Allow CartR to send updates on WhatsApp
                    </react_native_1.Text>
                </react_native_1.TouchableOpacity>

                {/* OTP Note */}
                <react_native_1.View className="bg-blue-50 rounded-2xl p-4 flex-row items-start mb-6">
                    <vector_icons_1.MaterialIcons name="info-outline" size={20} color="#3B82F6"/>
                    <react_native_1.Text className="flex-1 ml-3 text-blue-700 font-Jakarta text-sm">
                        One-time password (OTP) will be sent to this number for verification
                    </react_native_1.Text>
                </react_native_1.View>

                {/* Register Button */}
                <react_native_1.TouchableOpacity onPress={onRegisterPress} disabled={loading || !isFormValid()} className={`py-4 rounded-2xl items-center justify-center ${isFormValid() ? 'bg-success-500' : 'bg-gray-300'}`} activeOpacity={0.8}>
                    {loading ? (<react_native_1.View className="flex-row items-center">
                            <react_native_1.ActivityIndicator color="#fff" size="small"/>
                            <react_native_1.Text className="text-white font-JakartaBold text-lg ml-2">
                                Sending OTP...
                            </react_native_1.Text>
                        </react_native_1.View>) : (<react_native_1.Text className="text-white font-JakartaBold text-lg">
                            Register
                        </react_native_1.Text>)}
                </react_native_1.TouchableOpacity>
            </react_native_1.View>
        </react_native_1.ScrollView>);
    const renderOtpStep = () => (<react_native_1.View className="flex-1 px-6">
            {/* OTP Icon */}
            <react_native_1.View className="items-center mt-16 mb-8">
                <react_native_1.View className="w-24 h-24 bg-success-100 rounded-full items-center justify-center">
                    <vector_icons_1.MaterialIcons name="sms" size={48} color="#4CAF50"/>
                </react_native_1.View>
            </react_native_1.View>

            {/* Title */}
            <react_native_1.Text className="text-2xl font-JakartaBold text-gray-900 text-center mb-2">
                Verify your number
            </react_native_1.Text>
            <react_native_1.Text className="text-gray-500 text-center font-JakartaMedium mb-8">
                Enter the 6-digit code sent to{'\n'}
                <react_native_1.Text className="font-JakartaBold text-gray-700">{phoneNumber}</react_native_1.Text>
            </react_native_1.Text>

            {/* OTP Input */}
            <react_native_1.View className="mb-6">
                <react_native_1.TextInput ref={otpInputRef} className="bg-gray-100 rounded-2xl px-6 py-4 text-center text-2xl font-JakartaBold tracking-widest border border-gray-200" placeholder="• • • • • •" placeholderTextColor="#9CA3AF" value={otp} onChangeText={setOtp} keyboardType="number-pad" maxLength={6} autoFocus/>
            </react_native_1.View>

            {/* Verify Button */}
            <react_native_1.TouchableOpacity onPress={onVerifyOtpPress} disabled={loading || otp.length !== 6} className={`py-4 rounded-2xl items-center justify-center ${otp.length === 6 ? 'bg-success-500' : 'bg-gray-300'}`} activeOpacity={0.8}>
                {loading ? (<react_native_1.View className="flex-row items-center">
                        <react_native_1.ActivityIndicator color="#fff" size="small"/>
                        <react_native_1.Text className="text-white font-JakartaBold text-lg ml-2">
                            Creating Account...
                        </react_native_1.Text>
                    </react_native_1.View>) : (<react_native_1.Text className="text-white font-JakartaBold text-lg">
                        Verify & Create Account
                    </react_native_1.Text>)}
            </react_native_1.TouchableOpacity>

            {/* Resend OTP */}
            <react_native_1.View className="flex-row justify-center mt-6">
                <react_native_1.Text className="text-gray-500 font-Jakarta">
                    Didn't receive code?{" "}
                </react_native_1.Text>
                <react_native_1.TouchableOpacity onPress={onRegisterPress} disabled={loading}>
                    <react_native_1.Text className="text-success-500 font-JakartaSemiBold">
                        Resend OTP
                    </react_native_1.Text>
                </react_native_1.TouchableOpacity>
            </react_native_1.View>
        </react_native_1.View>);
    return (<react_native_safe_area_context_1.SafeAreaView className="flex-1 bg-white">
            <react_native_1.KeyboardAvoidingView behavior={react_native_1.Platform.OS === "ios" ? "padding" : "height"} className="flex-1">
                {step === 'register' ? renderRegisterStep() : renderOtpStep()}
            </react_native_1.KeyboardAvoidingView>
        </react_native_safe_area_context_1.SafeAreaView>);
};
exports.default = RegisterScreen;
