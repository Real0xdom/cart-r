"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const expo_router_1 = require("expo-router");
const react_1 = require("react");
const react_native_1 = require("react-native");
const CustomButton_1 = __importDefault(require("@/components/CustomButton"));
const supabase_1 = require("@/lib/supabase");
const AuthContext_1 = require("@/contexts/AuthContext");
const VerificationPending = () => {
    const { user } = (0, AuthContext_1.useAuth)();
    const [status, setStatus] = (0, react_1.useState)("pending");
    const [rejectionReason, setRejectionReason] = (0, react_1.useState)(null);
    (0, react_1.useEffect)(() => {
        checkVerificationStatus();
        // Subscribe to real-time updates
        const channel = supabase_1.supabase
            .channel("driver-verification")
            .on("postgres_changes", {
            event: "UPDATE",
            schema: "public",
            table: "drivers",
            filter: `user_id=eq.${user === null || user === void 0 ? void 0 : user.id}`,
        }, (payload) => {
            const newStatus = payload.new.verification_status;
            setStatus(newStatus);
            if (newStatus === "rejected") {
                setRejectionReason(payload.new.rejection_reason);
            }
            if (newStatus === "approved") {
                // Redirect to home after approval
                setTimeout(() => {
                    expo_router_1.router.replace("/(tabs)/home");
                }, 2000);
            }
        })
            .subscribe();
        return () => {
            supabase_1.supabase.removeChannel(channel);
        };
    }, [user === null || user === void 0 ? void 0 : user.id]);
    const checkVerificationStatus = async () => {
        try {
            const { data, error } = await supabase_1.supabase
                .from("drivers")
                .select("verification_status, rejection_reason")
                .eq("user_id", user === null || user === void 0 ? void 0 : user.id)
                .single();
            if (data) {
                setStatus(data.verification_status);
                if (data.verification_status === "rejected") {
                    setRejectionReason(data.rejection_reason);
                }
                if (data.verification_status === "approved") {
                    expo_router_1.router.replace("/(tabs)/home");
                }
            }
        }
        catch (error) {
            console.error("Error checking status:", error);
        }
    };
    const onContactSupport = () => {
        // Open email client
        const supportEmail = "support@cartr.com";
        const subject = "Driver Application Support";
        const url = `mailto:${supportEmail}?subject=${subject}`;
        react_native_1.Linking.openURL(url).catch(() => react_native_1.Alert.alert("Error", "Could not open email client. Please email support@cartr.com"));
    };
    const onRetryApplication = () => {
        // Go back to start of onboarding to allow editing all info
        expo_router_1.router.push("/onboarding/personal-info");
    };
    return (<react_native_1.View className="flex-1 bg-white justify-center items-center px-5">
      {status === "pending" ? (<>
          {/* Pending State */}
          <react_native_1.View className="w-32 h-32 bg-yellow-100 rounded-full items-center justify-center mb-6">
            <react_native_1.Text className="text-6xl">⏳</react_native_1.Text>
          </react_native_1.View>

          <react_native_1.Text className="text-2xl font-JakartaBold text-gray-800 text-center mb-3">
            Verification in Progress
          </react_native_1.Text>

          <react_native_1.Text className="text-gray-500 text-center mb-8 px-4">
            Our team is reviewing your documents. This usually takes 24-48 hours.
            We'll notify you once your account is verified.
          </react_native_1.Text>

          <react_native_1.View className="flex-row items-center mb-8">
            <react_native_1.ActivityIndicator color="#22c55e" size="small"/>
            <react_native_1.Text className="text-green-600 ml-2 font-JakartaSemiBold">
              Under Review
            </react_native_1.Text>
          </react_native_1.View>

          <react_native_1.View className="w-full p-5 bg-gray-50 rounded-xl mb-6">
            <react_native_1.Text className="text-gray-600 text-center text-sm">
              📱 You'll receive a notification when your account is approved.
              Make sure notifications are enabled.
            </react_native_1.Text>
          </react_native_1.View>

          <CustomButton_1.default title="Contact Support" onPress={onContactSupport} className="bg-gray-200" textVariant="secondary"/>
        </>) : status === "rejected" ? (<>
          {/* Rejected State */}
          <react_native_1.View className="w-32 h-32 bg-red-100 rounded-full items-center justify-center mb-6">
            <react_native_1.Text className="text-6xl">❌</react_native_1.Text>
          </react_native_1.View>

          <react_native_1.Text className="text-2xl font-JakartaBold text-gray-800 text-center mb-3">
            Verification Failed
          </react_native_1.Text>

          <react_native_1.Text className="text-gray-500 text-center mb-4 px-4">
            Unfortunately, we couldn't verify your documents.
          </react_native_1.Text>

          {rejectionReason && (<react_native_1.View className="w-full p-4 bg-red-50 rounded-xl mb-6">
              <react_native_1.Text className="text-red-800 font-JakartaSemiBold mb-1">
                Reason:
              </react_native_1.Text>
              <react_native_1.Text className="text-red-700">{rejectionReason}</react_native_1.Text>
            </react_native_1.View>)}

          <CustomButton_1.default title="Edit Application" onPress={onRetryApplication} className="bg-green-500 w-full mb-3"/>

          <CustomButton_1.default title="Contact Support" onPress={onContactSupport} className="bg-gray-200 w-full" textVariant="secondary"/>
        </>) : (<>
          {/* Approved State */}
          <react_native_1.View className="w-32 h-32 bg-green-100 rounded-full items-center justify-center mb-6">
            <react_native_1.Text className="text-6xl">✅</react_native_1.Text>
          </react_native_1.View>

          <react_native_1.Text className="text-2xl font-JakartaBold text-gray-800 text-center mb-3">
            You're Verified!
          </react_native_1.Text>

          <react_native_1.Text className="text-gray-500 text-center mb-8 px-4">
            Congratulations! Your account has been verified. You can now start
            accepting rides and earning.
          </react_native_1.Text>

          <react_native_1.View className="flex-row items-center mb-8">
            <react_native_1.ActivityIndicator color="#22c55e" size="small"/>
            <react_native_1.Text className="text-green-600 ml-2">Redirecting to home...</react_native_1.Text>
          </react_native_1.View>
        </>)}
    </react_native_1.View>);
};
exports.default = VerificationPending;
