"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const AuthContext_1 = require("@/contexts/AuthContext");
const react_native_1 = require("react-native");
const react_native_safe_area_context_1 = require("react-native-safe-area-context");
const expo_router_1 = require("expo-router");
const constants_1 = require("@/constants");
const GridItem = ({ icon, title, onPress }) => (<react_native_1.TouchableOpacity onPress={onPress} className="flex-1 items-center justify-center p-4 bg-gray-50 rounded-xl border border-gray-100 mx-1">
    <react_native_1.View className="w-10 h-10 rounded-full bg-white items-center justify-center border border-gray-100 shadow-sm mb-2">
      <react_native_1.Image source={icon} resizeMode="contain" className="w-5 h-5"/>
    </react_native_1.View>
    <react_native_1.Text className="text-sm font-JakartaMedium text-gray-700 text-center">{title}</react_native_1.Text>
  </react_native_1.TouchableOpacity>);
const ProfileItem = ({ icon, title, onPress }) => (<react_native_1.TouchableOpacity onPress={onPress} className="flex flex-row items-center justify-between w-full py-3 border-b border-gray-100">
    <react_native_1.View className="flex flex-row items-center gap-3">
      <react_native_1.View className="w-8 h-8 rounded-full bg-gray-50 items-center justify-center">
        <react_native_1.Image source={icon} resizeMode="contain" className="w-4 h-4"/>
      </react_native_1.View>
      <react_native_1.Text className="text-base font-JakartaMedium text-gray-800">{title}</react_native_1.Text>
    </react_native_1.View>
    <react_native_1.Image source={constants_1.icons.arrowDown} className="w-4 h-4 -rotate-90" resizeMode="contain" tintColor="#9ca3af"/>
  </react_native_1.TouchableOpacity>);
const Profile = () => {
    const { profile, signOut } = (0, AuthContext_1.useAuth)();
    /* TEST FUNCTION: SIMULATE IDEMPOTENCY */
    const handleTestIdempotency = async () => {
        var _a, _b, _c;
        if (!(profile === null || profile === void 0 ? void 0 : profile.id))
            return react_native_1.Alert.alert("Error", "Login first");
        const key = `TEST-${Date.now()}`;
        const testBookingParams = {
            customerId: profile.id,
            originAddress: "Test Origin",
            originLatitude: 12.9716,
            originLongitude: 77.5946,
            destinationAddress: "Test Dest",
            destinationLatitude: 12.9716,
            destinationLongitude: 77.6,
            vehicleType: "bike",
            idempotencyKey: key
        };
        try {
            react_native_1.Alert.alert("Testing", "Firing 2 identicial requests...");
            // Fire two requests in parallel
            const req1 = Promise.resolve().then(() => __importStar(require("@/lib/bookingUtils"))).then(m => m.createBooking(testBookingParams));
            const req2 = Promise.resolve().then(() => __importStar(require("@/lib/bookingUtils"))).then(m => m.createBooking(testBookingParams));
            const [res1, res2] = await Promise.all([req1, req2]);
            console.log("Res1:", res1);
            console.log("Res2:", res2);
            if (((_a = res1.data) === null || _a === void 0 ? void 0 : _a.id) === ((_b = res2.data) === null || _b === void 0 ? void 0 : _b.id)) {
                react_native_1.Alert.alert("Success! ✅", `Idempotency works!\nBoth requests returned Booking ID: ${(_c = res1.data) === null || _c === void 0 ? void 0 : _c.id}`);
            }
            else {
                react_native_1.Alert.alert("Failed ❌", "Duplicate bookings created!");
            }
        }
        catch (e) {
            react_native_1.Alert.alert("Error", e.message);
        }
    };
    const handleLogout = async () => {
        react_native_1.Alert.alert("Logout", "Are you sure you want to logout?", [
            {
                text: "Cancel",
                style: "cancel"
            },
            {
                text: "Test Idempotency",
                onPress: handleTestIdempotency
            },
            {
                text: "Logout",
                style: "destructive",
                onPress: async () => {
                    await signOut();
                    expo_router_1.router.replace("/sign-in");
                }
            }
        ]);
    };
    return (<react_native_safe_area_context_1.SafeAreaView className="flex-1 bg-white px-5">
      {/* Header */}
      <react_native_1.Text className="text-2xl font-JakartaBold mt-4 mb-6">My Profile</react_native_1.Text>

      {/* User Info Card */}
      <react_native_1.TouchableOpacity onPress={() => expo_router_1.router.push("/profile-details")} className="flex flex-row items-center bg-green-50 p-4 rounded-xl border border-green-100 mb-4">
        <react_native_1.Image source={{
            uri: (profile === null || profile === void 0 ? void 0 : profile.avatar_url) || "https://ui-avatars.com/api/?name=" + ((profile === null || profile === void 0 ? void 0 : profile.name) || "User"),
        }} className="rounded-full h-14 w-14 border-2 border-white"/>
        <react_native_1.View className="ml-4 flex-1">
          <react_native_1.Text className="text-lg font-JakartaBold text-gray-900">{(profile === null || profile === void 0 ? void 0 : profile.name) || "User Name"}</react_native_1.Text>
          <react_native_1.Text className="text-sm text-gray-500 font-Jakarta">{(profile === null || profile === void 0 ? void 0 : profile.email) || "email@example.com"}</react_native_1.Text>
        </react_native_1.View>
        <react_native_1.View className="w-8 h-8 rounded-full bg-green-500 items-center justify-center">
          <react_native_1.Image source={constants_1.icons.arrowDown} className="w-4 h-4 -rotate-90" resizeMode="contain" tintColor="white"/>
        </react_native_1.View>
      </react_native_1.TouchableOpacity>

      {/* Grid: Saved Addresses & Help Center */}
      <react_native_1.View className="flex flex-row mb-4">
        <GridItem icon={constants_1.icons.home} title="Saved Addresses" onPress={() => expo_router_1.router.push("/saved-addresses")}/>
        <GridItem icon={constants_1.icons.chat} title="Help Center" onPress={() => expo_router_1.router.push("/help")}/>
      </react_native_1.View>

      {/* List Items */}
      <react_native_1.View className="bg-white rounded-xl px-4 py-2 border border-gray-100 mb-4">
        <ProfileItem icon={constants_1.icons.email} title="Refer your friends" onPress={() => react_native_1.Alert.alert("Invite", "Referral feature coming soon!")}/>
        <ProfileItem icon={constants_1.icons.list} title="Language" onPress={() => react_native_1.Alert.alert("Language", "Change Language feature coming soon!")}/>
        <ProfileItem icon={constants_1.icons.list} title="Terms and Conditions" onPress={() => expo_router_1.router.push("/terms")}/>
      </react_native_1.View>

      {/* Logout Button */}
      <react_native_1.TouchableOpacity onPress={handleLogout} className="flex flex-row items-center justify-center w-full py-3 bg-red-50 rounded-xl border border-red-100 mt-auto mb-24">
        <react_native_1.Image source={constants_1.icons.out} className="w-5 h-5 mr-2" resizeMode="contain" tintColor="#ef4444"/>
        <react_native_1.Text className="text-base font-JakartaSemiBold text-red-500">Log Out</react_native_1.Text>
      </react_native_1.TouchableOpacity>
    </react_native_safe_area_context_1.SafeAreaView>);
};
exports.default = Profile;
