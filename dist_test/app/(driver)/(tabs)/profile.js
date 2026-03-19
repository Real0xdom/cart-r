"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const react_native_1 = require("react-native");
const react_native_safe_area_context_1 = require("react-native-safe-area-context");
const AuthContext_1 = require("@/contexts/AuthContext");
const DriverProfile = () => {
    const { profile, driverProfile, signOut } = (0, AuthContext_1.useAuth)();
    const menuItems = [
        { icon: '🚗', title: 'Vehicle Details', subtitle: 'Manage your vehicle info' },
        { icon: '📄', title: 'Documents', subtitle: 'License, RC, Insurance' },
        { icon: '💳', title: 'Bank Account', subtitle: 'Payout settings' },
        { icon: '⭐', title: 'Ratings & Reviews', subtitle: `${(driverProfile === null || driverProfile === void 0 ? void 0 : driverProfile.rating) || '4.8'} rating` },
        { icon: '🔔', title: 'Notifications', subtitle: 'Manage alerts' },
        { icon: '❓', title: 'Help & Support', subtitle: 'Get assistance' },
        { icon: '📜', title: 'Terms & Policies', subtitle: 'Legal information' },
    ];
    return (<react_native_safe_area_context_1.SafeAreaView className="flex-1 bg-gray-900">
            <react_native_1.ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 100 }}>
                {/* Profile Header */}
                <react_native_1.View className="items-center py-8 border-b border-gray-800">
                    <react_native_1.View className="w-24 h-24 bg-gray-700 rounded-full items-center justify-center mb-4">
                        <react_native_1.Text className="text-4xl">👤</react_native_1.Text>
                    </react_native_1.View>
                    <react_native_1.Text className="text-white text-2xl font-JakartaBold">{(profile === null || profile === void 0 ? void 0 : profile.name) || 'Driver'}</react_native_1.Text>
                    <react_native_1.Text className="text-gray-400">{(profile === null || profile === void 0 ? void 0 : profile.phone) || 'Phone not set'}</react_native_1.Text>

                    <react_native_1.View className="flex-row mt-4 gap-6">
                        <react_native_1.View className="items-center">
                            <react_native_1.Text className="text-white text-xl font-JakartaBold">127</react_native_1.Text>
                            <react_native_1.Text className="text-gray-400 text-sm">Trips</react_native_1.Text>
                        </react_native_1.View>
                        <react_native_1.View className="w-px bg-gray-700"/>
                        <react_native_1.View className="items-center">
                            <react_native_1.Text className="text-white text-xl font-JakartaBold">4.8</react_native_1.Text>
                            <react_native_1.Text className="text-gray-400 text-sm">Rating</react_native_1.Text>
                        </react_native_1.View>
                        <react_native_1.View className="w-px bg-gray-700"/>
                        <react_native_1.View className="items-center">
                            <react_native_1.Text className="text-white text-xl font-JakartaBold">2y</react_native_1.Text>
                            <react_native_1.Text className="text-gray-400 text-sm">Experience</react_native_1.Text>
                        </react_native_1.View>
                    </react_native_1.View>
                </react_native_1.View>

                {/* Menu Items */}
                <react_native_1.View className="p-5">
                    {menuItems.map((item, index) => (<react_native_1.TouchableOpacity key={index} className="flex-row items-center py-4 border-b border-gray-800">
                            <react_native_1.View className="w-12 h-12 bg-gray-800 rounded-full items-center justify-center mr-4">
                                <react_native_1.Text className="text-2xl">{item.icon}</react_native_1.Text>
                            </react_native_1.View>
                            <react_native_1.View className="flex-1">
                                <react_native_1.Text className="text-white font-JakartaSemiBold">{item.title}</react_native_1.Text>
                                <react_native_1.Text className="text-gray-400 text-sm">{item.subtitle}</react_native_1.Text>
                            </react_native_1.View>
                            <react_native_1.Text className="text-gray-600 text-xl">›</react_native_1.Text>
                        </react_native_1.TouchableOpacity>))}
                </react_native_1.View>

                {/* Logout Button */}
                <react_native_1.TouchableOpacity onPress={signOut} className="mx-5 mt-4 bg-red-500/20 p-4 rounded-xl">
                    <react_native_1.Text className="text-red-400 text-center font-JakartaBold">Logout</react_native_1.Text>
                </react_native_1.TouchableOpacity>

                <react_native_1.Text className="text-gray-600 text-center mt-6 text-sm">Version 1.0.0</react_native_1.Text>

            </react_native_1.ScrollView>
        </react_native_safe_area_context_1.SafeAreaView>);
};
exports.default = DriverProfile;
