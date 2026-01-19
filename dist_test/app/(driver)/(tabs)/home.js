"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const react_native_1 = require("react-native");
const react_native_safe_area_context_1 = require("react-native-safe-area-context");
const AuthContext_1 = require("@/contexts/AuthContext");
const react_1 = require("react");
const DriverHome = () => {
    const { signOut, driverProfile, toggleDriverOnline, profile } = (0, AuthContext_1.useAuth)();
    const [isOnline, setIsOnline] = (0, react_1.useState)((driverProfile === null || driverProfile === void 0 ? void 0 : driverProfile.is_online) || false);
    (0, react_1.useEffect)(() => {
        setIsOnline((driverProfile === null || driverProfile === void 0 ? void 0 : driverProfile.is_online) || false);
    }, [driverProfile]);
    const handleToggleOnline = async (value) => {
        setIsOnline(value);
        await toggleDriverOnline(value);
    };
    return (<react_native_safe_area_context_1.SafeAreaView className="flex-1 bg-gray-900">
            <react_native_1.ScrollView className="p-5" contentContainerStyle={{ paddingBottom: 100 }}>
                {/* Header */}
                <react_native_1.View className="flex-row justify-between items-center mb-6">
                    <react_native_1.View>
                        <react_native_1.Text className="text-gray-400 text-sm">Welcome back,</react_native_1.Text>
                        <react_native_1.Text className="text-white text-2xl font-JakartaBold">
                            {(profile === null || profile === void 0 ? void 0 : profile.name) || 'Driver'}
                        </react_native_1.Text>
                    </react_native_1.View>
                    <react_native_1.TouchableOpacity onPress={signOut} className="bg-red-500/20 px-4 py-2 rounded-full">
                        <react_native_1.Text className="text-red-400 font-JakartaSemiBold">Logout</react_native_1.Text>
                    </react_native_1.TouchableOpacity>
                </react_native_1.View>

                {/* Online Status Card */}
                <react_native_1.View className="bg-gray-800 p-6 rounded-2xl mb-6">
                    <react_native_1.View className="flex-row justify-between items-center">
                        <react_native_1.View>
                            <react_native_1.Text className="text-gray-400 text-sm mb-1">Status</react_native_1.Text>
                            <react_native_1.Text className={`text-2xl font-JakartaBold ${isOnline ? 'text-green-400' : 'text-red-400'}`}>
                                {isOnline ? '🟢 Online' : '🔴 Offline'}
                            </react_native_1.Text>
                        </react_native_1.View>
                        <react_native_1.Switch value={isOnline} onValueChange={handleToggleOnline} trackColor={{ false: '#374151', true: '#22c55e' }} thumbColor={isOnline ? '#ffffff' : '#9ca3af'}/>
                    </react_native_1.View>
                    <react_native_1.Text className="text-gray-500 text-sm mt-3">
                        {isOnline ? 'You are visible to customers' : 'Go online to receive ride requests'}
                    </react_native_1.Text>
                </react_native_1.View>

                {/* Today's Stats */}
                <react_native_1.Text className="text-white text-xl font-JakartaBold mb-4">Today's Summary</react_native_1.Text>
                <react_native_1.View className="flex-row gap-3 mb-6">
                    <react_native_1.View className="flex-1 bg-blue-500/20 p-4 rounded-xl">
                        <react_native_1.Text className="text-blue-400 text-sm mb-1">Earnings</react_native_1.Text>
                        <react_native_1.Text className="text-white text-2xl font-JakartaBold">₹0</react_native_1.Text>
                    </react_native_1.View>
                    <react_native_1.View className="flex-1 bg-purple-500/20 p-4 rounded-xl">
                        <react_native_1.Text className="text-purple-400 text-sm mb-1">Trips</react_native_1.Text>
                        <react_native_1.Text className="text-white text-2xl font-JakartaBold">0</react_native_1.Text>
                    </react_native_1.View>
                    <react_native_1.View className="flex-1 bg-green-500/20 p-4 rounded-xl">
                        <react_native_1.Text className="text-green-400 text-sm mb-1">Hours</react_native_1.Text>
                        <react_native_1.Text className="text-white text-2xl font-JakartaBold">0h</react_native_1.Text>
                    </react_native_1.View>
                </react_native_1.View>

                {/* Quick Actions */}
                <react_native_1.Text className="text-white text-xl font-JakartaBold mb-4">Quick Actions</react_native_1.Text>
                <react_native_1.View className="gap-3">
                    <react_native_1.TouchableOpacity className="bg-gray-800 p-4 rounded-xl flex-row items-center">
                        <react_native_1.View className="w-12 h-12 bg-blue-500/20 rounded-full items-center justify-center mr-4">
                            <react_native_1.Text className="text-2xl">📍</react_native_1.Text>
                        </react_native_1.View>
                        <react_native_1.View className="flex-1">
                            <react_native_1.Text className="text-white font-JakartaSemiBold">Navigation</react_native_1.Text>
                            <react_native_1.Text className="text-gray-400 text-sm">Open Google Maps</react_native_1.Text>
                        </react_native_1.View>
                    </react_native_1.TouchableOpacity>

                    <react_native_1.TouchableOpacity className="bg-gray-800 p-4 rounded-xl flex-row items-center">
                        <react_native_1.View className="w-12 h-12 bg-green-500/20 rounded-full items-center justify-center mr-4">
                            <react_native_1.Text className="text-2xl">💰</react_native_1.Text>
                        </react_native_1.View>
                        <react_native_1.View className="flex-1">
                            <react_native_1.Text className="text-white font-JakartaSemiBold">Withdraw Earnings</react_native_1.Text>
                            <react_native_1.Text className="text-gray-400 text-sm">Transfer to bank account</react_native_1.Text>
                        </react_native_1.View>
                    </react_native_1.TouchableOpacity>

                    <react_native_1.TouchableOpacity className="bg-gray-800 p-4 rounded-xl flex-row items-center">
                        <react_native_1.View className="w-12 h-12 bg-orange-500/20 rounded-full items-center justify-center mr-4">
                            <react_native_1.Text className="text-2xl">📞</react_native_1.Text>
                        </react_native_1.View>
                        <react_native_1.View className="flex-1">
                            <react_native_1.Text className="text-white font-JakartaSemiBold">Support</react_native_1.Text>
                            <react_native_1.Text className="text-gray-400 text-sm">Get help from our team</react_native_1.Text>
                        </react_native_1.View>
                    </react_native_1.TouchableOpacity>
                </react_native_1.View>

            </react_native_1.ScrollView>
        </react_native_safe_area_context_1.SafeAreaView>);
};
exports.default = DriverHome;
