import { View, Text, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Image } from 'react-native';
import { useState, useEffect, useRef } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { syncDriverStats } from '@/lib/bookings';
import LanguageModal from '@/components/LanguageModal';
import { Ionicons } from '@expo/vector-icons';

const DriverProfile = () => {
    const { profile, driverProfile, signOut, refreshProfile } = useAuth();
    const { t } = useLanguage();
    const [isSyncing, setIsSyncing] = useState(false);
    const [languageModalVisible, setLanguageModalVisible] = useState(false);

    const hasSyncedRef = useRef(false);

    // Auto-sync stats once per session to recalculate and fix any wrongly bloated driver_earnings
    useEffect(() => {
        const syncStats = async () => {
            if (driverProfile?.id && !isSyncing && !hasSyncedRef.current) {
                hasSyncedRef.current = true;
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
        { icon: 'car-outline', title: t('vehicleDetails'), subtitle: `${driverProfile?.vehicle_model || t('notSet')} • ${driverProfile?.vehicle_number || ''}`, route: '/vehicle-info' },
        { icon: 'document-text-outline', title: t('documents'), subtitle: t('licenseRcInsurance'), route: '/profile/documents' },
        { icon: 'card-outline', title: t('bankAccount'), subtitle: t('payoutSettings'), route: '/profile/bank' },
        { icon: 'star-outline', title: t('ratingsReviews'), subtitle: `${driverProfile?.rating?.toFixed(1) || '5.0'} ${t('rating')}`, route: '/profile/reviews' },
        { icon: 'notifications-outline', title: t('notifications'), subtitle: t('manageAlerts'), route: '/profile/notifications' },
        { icon: 'help-circle-outline', title: t('helpSupport'), subtitle: t('getAssistance'), route: '/profile/support' },
        { icon: 'shield-checkmark-outline', title: t('termsPolicies'), subtitle: t('legalInfo'), route: '/profile/terms' },
        { icon: 'globe-outline', title: t('language'), subtitle: t('currentLanguage'), route: '_language' },
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
                    <View className="w-24 h-24 bg-gray-200 rounded-full items-center justify-center mb-4 overflow-hidden">
                        {profile?.avatar_url ? (
                            <Image source={{ uri: profile.avatar_url }} className="w-full h-full" resizeMode="cover" />
                        ) : (
                            <Ionicons name="person" size={48} color="#9ca3af" />
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
                                <Ionicons name={item.icon as any} size={24} color="#6b7280" />
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
