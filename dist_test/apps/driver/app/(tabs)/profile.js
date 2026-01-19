"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const react_native_1 = require("react-native");
const react_1 = require("react");
const react_native_safe_area_context_1 = require("react-native-safe-area-context");
const expo_router_1 = require("expo-router");
const AuthContext_1 = require("@/contexts/AuthContext");
const bookings_1 = require("@/lib/bookings");
const DriverProfile = () => {
    var _a, _b;
    const { profile, driverProfile, signOut, refreshProfile } = (0, AuthContext_1.useAuth)();
    const [isSyncing, setIsSyncing] = (0, react_1.useState)(false);
    // Auto-sync stats if they appear to be missing (e.g. 0 trips but we suspect they have some)
    // Or just run it once on mount to be safe since the trigger might have missed old data
    (0, react_1.useEffect)(() => {
        const syncStats = async () => {
            if ((driverProfile === null || driverProfile === void 0 ? void 0 : driverProfile.id) && !isSyncing) {
                // If we have 0 trips, it's worth checking if that's real or a sync error
                if (!driverProfile.total_trips || driverProfile.total_trips === 0) {
                    setIsSyncing(true);
                    try {
                        await (0, bookings_1.syncDriverStats)(driverProfile.id);
                        await refreshProfile();
                    }
                    catch (e) {
                        console.error('Failed to sync stats', e);
                    }
                    finally {
                        setIsSyncing(false);
                    }
                }
            }
        };
        syncStats();
    }, [driverProfile === null || driverProfile === void 0 ? void 0 : driverProfile.id]);
    // Calculate experience from created_at
    const getExperience = () => {
        if (!(driverProfile === null || driverProfile === void 0 ? void 0 : driverProfile.created_at))
            return 'New';
        const createdAt = new Date(driverProfile.created_at);
        const now = new Date();
        const months = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24 * 30));
        if (months < 1)
            return 'New';
        if (months < 12)
            return `${months}mo`;
        return `${Math.floor(months / 12)}y`;
    };
    const menuItems = [
        { icon: '🚗', title: 'Vehicle Details', subtitle: `${(driverProfile === null || driverProfile === void 0 ? void 0 : driverProfile.vehicle_model) || 'Not set'} • ${(driverProfile === null || driverProfile === void 0 ? void 0 : driverProfile.vehicle_number) || ''}`, route: '/profile/vehicle' },
        { icon: '📄', title: 'Documents', subtitle: 'License, RC, Insurance', route: '/profile/documents' },
        { icon: '💳', title: 'Bank Account', subtitle: 'Payout settings', route: '/profile/bank' },
        { icon: '⭐', title: 'Ratings & Reviews', subtitle: `${((_a = driverProfile === null || driverProfile === void 0 ? void 0 : driverProfile.rating) === null || _a === void 0 ? void 0 : _a.toFixed(1)) || '5.0'} rating`, route: '/profile/reviews' },
        { icon: '🔔', title: 'Notifications', subtitle: 'Manage alerts', route: '/profile/notifications' },
        { icon: '❓', title: 'Help & Support', subtitle: 'Get assistance', route: '/profile/support' },
        { icon: '📜', title: 'Terms & Policies', subtitle: 'Legal information', route: '/profile/terms' },
    ];
    // Verification status badge
    const getVerificationBadge = () => {
        const status = (driverProfile === null || driverProfile === void 0 ? void 0 : driverProfile.verification_status) || 'pending';
        switch (status) {
            case 'approved':
                return { text: '✓ Verified', bgColor: 'bg-green-500/20', textColor: 'text-green-400' };
            case 'rejected':
                return { text: '✗ Rejected', bgColor: 'bg-red-500/20', textColor: 'text-red-400' };
            default:
                return { text: '⏳ Pending', bgColor: 'bg-yellow-500/20', textColor: 'text-yellow-400' };
        }
    };
    const badge = getVerificationBadge();
    return (<react_native_safe_area_context_1.SafeAreaView className="flex-1 bg-gray-900">
            <react_native_1.ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 100 }}>
                {/* Profile Header */}
                <react_native_1.View className="items-center py-8 border-b border-gray-800">
                    <react_native_1.View className="w-24 h-24 bg-gray-700 rounded-full items-center justify-center mb-4">
                        {(profile === null || profile === void 0 ? void 0 : profile.avatar_url) ? (<react_native_1.Text className="text-4xl">👤</react_native_1.Text>) : (<react_native_1.Text className="text-4xl">👤</react_native_1.Text>)}
                    </react_native_1.View>
                    <react_native_1.Text className="text-white text-2xl font-JakartaBold">{(profile === null || profile === void 0 ? void 0 : profile.name) || 'Driver'}</react_native_1.Text>
                    <react_native_1.Text className="text-gray-400">{(profile === null || profile === void 0 ? void 0 : profile.phone) || 'Phone not set'}</react_native_1.Text>

                    {/* Verification Badge */}
                    <react_native_1.View className={`mt-2 px-3 py-1 rounded-full ${badge.bgColor}`}>
                        <react_native_1.Text className={`font-JakartaMedium text-sm ${badge.textColor}`}>{badge.text}</react_native_1.Text>
                    </react_native_1.View>

                    <react_native_1.View className="flex-row mt-4 gap-6">
                        <react_native_1.View className="items-center">
                            <react_native_1.Text className="text-white text-xl font-JakartaBold">
                                {(driverProfile === null || driverProfile === void 0 ? void 0 : driverProfile.total_trips) || 0}
                            </react_native_1.Text>
                            <react_native_1.Text className="text-gray-400 text-sm">Trips</react_native_1.Text>
                        </react_native_1.View>
                        <react_native_1.View className="w-px bg-gray-700"/>
                        <react_native_1.View className="items-center">
                            <react_native_1.Text className="text-white text-xl font-JakartaBold">
                                {((_b = driverProfile === null || driverProfile === void 0 ? void 0 : driverProfile.rating) === null || _b === void 0 ? void 0 : _b.toFixed(1)) || '5.0'}
                            </react_native_1.Text>
                            <react_native_1.Text className="text-gray-400 text-sm">Rating</react_native_1.Text>
                        </react_native_1.View>
                        <react_native_1.View className="w-px bg-gray-700"/>
                        <react_native_1.View className="items-center">
                            <react_native_1.Text className="text-white text-xl font-JakartaBold">{getExperience()}</react_native_1.Text>
                            <react_native_1.Text className="text-gray-400 text-sm">Experience</react_native_1.Text>
                        </react_native_1.View>
                    </react_native_1.View>

                    {/* Lifetime Earnings */}
                    <react_native_1.View className="mt-4 bg-green-500/10 px-6 py-2 rounded-xl">
                        <react_native_1.Text className="text-green-400 text-sm text-center">Lifetime Earnings</react_native_1.Text>
                        <react_native_1.Text className="text-green-400 text-xl font-JakartaBold text-center">
                            ₹{((driverProfile === null || driverProfile === void 0 ? void 0 : driverProfile.total_earnings) || 0).toLocaleString()}
                        </react_native_1.Text>
                    </react_native_1.View>
                </react_native_1.View>

                {/* Menu Items */}
                <react_native_1.View className="p-5">
                    {menuItems.map((item, index) => (<react_native_1.TouchableOpacity key={index} onPress={() => {
                if (item.route) {
                    expo_router_1.router.push(item.route);
                }
                else {
                    react_native_1.Alert.alert('Coming Soon', `${item.title} section is under development.`);
                }
            }} className="flex-row items-center py-4 border-b border-gray-800">
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
