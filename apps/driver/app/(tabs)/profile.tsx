import { View, Text, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useState, useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { syncDriverStats } from '@/lib/bookings';

const DriverProfile = () => {
    const { profile, driverProfile, signOut, refreshProfile } = useAuth();
    const [isSyncing, setIsSyncing] = useState(false);

    // Auto-sync stats if they appear to be missing (e.g. 0 trips but we suspect they have some)
    // Or just run it once on mount to be safe since the trigger might have missed old data
    useEffect(() => {
        const syncStats = async () => {
            if (driverProfile?.id && !isSyncing) {
                // If we have 0 trips, it's worth checking if that's real or a sync error
                if (!driverProfile.total_trips || driverProfile.total_trips === 0) {
                    setIsSyncing(true);
                    try {
                        await syncDriverStats(driverProfile.id);
                        await refreshProfile();
                    } catch (e) {
                        console.error('Failed to sync stats', e);
                    } finally {
                        setIsSyncing(false);
                    }
                }
            }
        };
        
        syncStats();
    }, [driverProfile?.id]);

    // Calculate experience from created_at
    const getExperience = () => {
        if (!driverProfile?.created_at) return 'New';
        const createdAt = new Date(driverProfile.created_at);
        const now = new Date();
        const months = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24 * 30));
        if (months < 1) return 'New';
        if (months < 12) return `${months}mo`;
        return `${Math.floor(months / 12)}y`;
    };

    const menuItems = [
        { icon: '🚗', title: 'Vehicle Details', subtitle: `${driverProfile?.vehicle_model || 'Not set'} • ${driverProfile?.vehicle_number || ''}`, route: '/profile/vehicle' },
        { icon: '📄', title: 'Documents', subtitle: 'License, RC, Insurance', route: '/profile/documents' },
        { icon: '💳', title: 'Bank Account', subtitle: 'Payout settings', route: '/profile/bank' },
        { icon: '⭐', title: 'Ratings & Reviews', subtitle: `${driverProfile?.rating?.toFixed(1) || '5.0'} rating`, route: '/profile/reviews' },
        { icon: '🔔', title: 'Notifications', subtitle: 'Manage alerts', route: '/profile/notifications' },
        { icon: '❓', title: 'Help & Support', subtitle: 'Get assistance', route: '/profile/support' },
        { icon: '📜', title: 'Terms & Policies', subtitle: 'Legal information', route: '/profile/terms' },
    ];

    // Verification status badge
    const getVerificationBadge = () => {
        const status = driverProfile?.verification_status || 'pending';
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

    return (
        <SafeAreaView className="flex-1 bg-gray-900">
            <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 100 }}>
                {/* Profile Header */}
                <View className="items-center py-8 border-b border-gray-800">
                    <View className="w-24 h-24 bg-gray-700 rounded-full items-center justify-center mb-4">
                        {profile?.avatar_url ? (
                            <Text className="text-4xl">👤</Text>
                        ) : (
                            <Text className="text-4xl">👤</Text>
                        )}
                    </View>
                    <Text className="text-white text-2xl font-JakartaBold">{profile?.name || 'Driver'}</Text>
                    <Text className="text-gray-400">{profile?.phone || 'Phone not set'}</Text>

                    {/* Verification Badge */}
                    <View className={`mt-2 px-3 py-1 rounded-full ${badge.bgColor}`}>
                        <Text className={`font-JakartaMedium text-sm ${badge.textColor}`}>{badge.text}</Text>
                    </View>

                    <View className="flex-row mt-4 gap-6">
                        <View className="items-center">
                            <Text className="text-white text-xl font-JakartaBold">
                                {driverProfile?.total_trips || 0}
                            </Text>
                            <Text className="text-gray-400 text-sm">Trips</Text>
                        </View>
                        <View className="w-px bg-gray-700" />
                        <View className="items-center">
                            <Text className="text-white text-xl font-JakartaBold">
                                {driverProfile?.rating?.toFixed(1) || '5.0'}
                            </Text>
                            <Text className="text-gray-400 text-sm">Rating</Text>
                        </View>
                        <View className="w-px bg-gray-700" />
                        <View className="items-center">
                            <Text className="text-white text-xl font-JakartaBold">{getExperience()}</Text>
                            <Text className="text-gray-400 text-sm">Experience</Text>
                        </View>
                    </View>

                    {/* Lifetime Earnings */}
                    <View className="mt-4 bg-green-500/10 px-6 py-2 rounded-xl">
                        <Text className="text-green-400 text-sm text-center">Lifetime Earnings</Text>
                        <Text className="text-green-400 text-xl font-JakartaBold text-center">
                            ₹{(driverProfile?.total_earnings || 0).toLocaleString()}
                        </Text>
                    </View>
                </View>

                {/* Menu Items */}
                <View className="p-5">
                    {menuItems.map((item, index) => (
                        <TouchableOpacity
                            key={index}
                            onPress={() => {
                                if (item.route) {
                                    router.push(item.route as any);
                                } else {
                                    Alert.alert('Coming Soon', `${item.title} section is under development.`);
                                }
                            }}
                            className="flex-row items-center py-4 border-b border-gray-800"
                        >
                            <View className="w-12 h-12 bg-gray-800 rounded-full items-center justify-center mr-4">
                                <Text className="text-2xl">{item.icon}</Text>
                            </View>
                            <View className="flex-1">
                                <Text className="text-white font-JakartaSemiBold">{item.title}</Text>
                                <Text className="text-gray-400 text-sm">{item.subtitle}</Text>
                            </View>
                            <Text className="text-gray-600 text-xl">›</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Logout Button */}
                <TouchableOpacity
                    onPress={signOut}
                    className="mx-5 mt-4 bg-red-500/20 p-4 rounded-xl"
                >
                    <Text className="text-red-400 text-center font-JakartaBold">Logout</Text>
                </TouchableOpacity>

                <Text className="text-gray-600 text-center mt-6 text-sm">Version 1.0.0</Text>

            </ScrollView>
        </SafeAreaView>
    );
};

export default DriverProfile;
