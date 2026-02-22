import { View, Text, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useState, useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { syncDriverStats } from '@/lib/bookings';
import LanguageModal from '@/components/LanguageModal';

const DriverProfile = () => {
    const { profile, driverProfile, signOut, refreshProfile } = useAuth();
    const { t } = useLanguage();
    const [isSyncing, setIsSyncing] = useState(false);
    const [languageModalVisible, setLanguageModalVisible] = useState(false);

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
        { icon: '🚗', title: t('vehicleDetails'), subtitle: `${driverProfile?.vehicle_model || t('notSet')} • ${driverProfile?.vehicle_number || ''}`, route: '/profile/vehicle' },
        { icon: '📄', title: t('documents'), subtitle: t('licenseRcInsurance'), route: '/profile/documents' },
        { icon: '💳', title: t('bankAccount'), subtitle: t('payoutSettings'), route: '/profile/bank' },
        { icon: '⭐', title: t('ratingsReviews'), subtitle: `${driverProfile?.rating?.toFixed(1) || '5.0'} ${t('rating')}`, route: '/profile/reviews' },
        { icon: '🔔', title: t('notifications'), subtitle: t('manageAlerts'), route: '/profile/notifications' },
        { icon: '❓', title: t('helpSupport'), subtitle: t('getAssistance'), route: '/profile/support' },
        { icon: '📜', title: t('termsPolicies'), subtitle: t('legalInfo'), route: '/profile/terms' },
        { icon: '🌐', title: t('language'), subtitle: t('currentLanguage'), route: '_language' },
    ];

    // Verification status badge
    const getVerificationBadge = () => {
        const status = driverProfile?.verification_status || 'pending';
        switch (status) {
            case 'approved':
                return { text: t('verified'), bgColor: 'bg-green-100', textColor: 'text-green-700' };
            case 'rejected':
                return { text: t('rejected'), bgColor: 'bg-red-100', textColor: 'text-red-600' };
            default:
                return { text: t('pending'), bgColor: 'bg-yellow-100', textColor: 'text-yellow-700' };
        }
    };

    const badge = getVerificationBadge();

    return (
        <SafeAreaView className="flex-1 bg-white">
            <LanguageModal visible={languageModalVisible} onClose={() => setLanguageModalVisible(false)} />
            <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 100 }}>
                {/* Profile Header */}
                <View className="items-center py-8 border-b border-gray-200">
                    <View className="w-24 h-24 bg-gray-200 rounded-full items-center justify-center mb-4">
                        {profile?.avatar_url ? (
                            <Text className="text-4xl">👤</Text>
                        ) : (
                            <Text className="text-4xl">👤</Text>
                        )}
                    </View>
                    <Text className="text-gray-900 text-2xl font-JakartaBold">{profile?.name || 'Driver'}</Text>
                    <Text className="text-gray-500">{profile?.phone || t('notSet')}</Text>

                    {/* Verification Badge */}
                    <View className={`mt-2 px-3 py-1 rounded-full ${badge.bgColor}`}>
                        <Text className={`font-JakartaMedium text-sm ${badge.textColor}`}>{badge.text}</Text>
                    </View>

                    <View className="flex-row mt-4 gap-6">
                        <View className="items-center">
                            <Text className="text-gray-900 text-xl font-JakartaBold">
                                {driverProfile?.total_trips || 0}
                            </Text>
                            <Text className="text-gray-500 text-sm">{t('trips')}</Text>
                        </View>
                        <View className="w-px bg-gray-300" />
                        <View className="items-center">
                            <Text className="text-gray-900 text-xl font-JakartaBold">
                                {driverProfile?.rating?.toFixed(1) || '5.0'}
                            </Text>
                            <Text className="text-gray-500 text-sm">{t('rating')}</Text>
                        </View>
                        <View className="w-px bg-gray-300" />
                        <View className="items-center">
                            <Text className="text-gray-900 text-xl font-JakartaBold">{getExperience()}</Text>
                            <Text className="text-gray-500 text-sm">{t('experience')}</Text>
                        </View>
                    </View>

                    {/* Lifetime Earnings */}
                    <View className="mt-4 bg-green-50 px-6 py-2 rounded-xl border border-green-100">
                        <Text className="text-green-700 text-sm text-center">{t('lifetimeEarnings')}</Text>
                        <Text className="text-green-700 text-xl font-JakartaBold text-center">
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
                                if (item.route === '_language') {
                                    setLanguageModalVisible(true);
                                } else if (item.route) {
                                    router.push(item.route as any);
                                } else {
                                    Alert.alert(t('comingSoon'), `${item.title} ${t('sectionUnderDevelopment')}`);
                                }
                            }}
                            className="flex-row items-center py-4 border-b border-gray-100"
                        >
                            <View className="w-12 h-12 bg-gray-100 rounded-full items-center justify-center mr-4">
                                <Text className="text-2xl">{item.icon}</Text>
                            </View>
                            <View className="flex-1">
                                <Text className="text-gray-900 font-JakartaSemiBold">{item.title}</Text>
                                <Text className="text-gray-500 text-sm">{item.subtitle}</Text>
                            </View>
                            <Text className="text-gray-400 text-xl">›</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Logout Button */}
                <TouchableOpacity
                    onPress={signOut}
                    className="mx-5 mt-4 bg-red-50 p-4 rounded-xl border border-red-100"
                >
                    <Text className="text-red-600 text-center font-JakartaBold">{t('logout')}</Text>
                </TouchableOpacity>

                <Text className="text-gray-600 text-center mt-6 text-sm">Version 1.0.0</Text>

            </ScrollView>
        </SafeAreaView>
    );
};

export default DriverProfile;
