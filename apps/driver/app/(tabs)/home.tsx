import { View, Text, TouchableOpacity, ScrollView, Switch, Alert, ActivityIndicator } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useState, useEffect } from 'react';
import { router } from 'expo-router';
import { startLocationTracking, stopLocationTracking, requestLocationPermissions } from '@/lib/location';
import { getDriverActiveBookings, getDriverCompletedTrips, Booking } from '@/lib/bookings';

const DriverHome = () => {
    const { signOut, driverProfile, toggleDriverOnline, profile } = useAuth();
    const { t } = useLanguage();
    const [isOnline, setIsOnline] = useState(driverProfile?.is_online || false);
    const [isTogglingStatus, setIsTogglingStatus] = useState(false);
    const [activeBookings, setActiveBookings] = useState<Booking[]>([]);
    const [isRidesExpanded, setIsRidesExpanded] = useState(true);
    const [todayStats, setTodayStats] = useState({ earnings: 0, trips: 0 });
    const [isLoadingStats, setIsLoadingStats] = useState(true);

    useEffect(() => {
        setIsOnline(driverProfile?.is_online || false);
    }, [driverProfile]);

    // Check for active booking and fetch today's stats
    useEffect(() => {
        if (!driverProfile?.id) return;

        const fetchData = async () => {
            // Check for active bookings (all of them)
            const { data: activeRides } = await getDriverActiveBookings(driverProfile.id);
            if (activeRides) {
                setActiveBookings(activeRides);
            }

            // Fetch today's stats
            const { data: trips } = await getDriverCompletedTrips(driverProfile.id, 50);
            if (trips) {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                
                const todayTrips = trips.filter(t => {
                    const tripDate = new Date(t.completed_at || t.created_at);
                    return tripDate >= today;
                });

                const earnings = todayTrips.reduce((sum, t) => sum + (t.driver_payout || t.total_fare), 0);
                setTodayStats({ earnings, trips: todayTrips.length });
            }
            setIsLoadingStats(false);
        };

        fetchData();

        // Poll for updates every 30 seconds
        const interval = setInterval(fetchData, 30000);
        return () => clearInterval(interval);
    }, [driverProfile?.id]);

    const handleToggleOnline = async (value: boolean) => {
        setIsTogglingStatus(true);
        
        try {
            if (value) {
                // Going online - request permissions and start tracking
                const hasPermissions = await requestLocationPermissions();
                if (!hasPermissions) {
                    Alert.alert(
                        t('locationPermissionRequired'),
                        t('enableLocationAccess'),
                        [{ text: t('ok') }]
                    );
                    setIsTogglingStatus(false);
                    return;
                }
                
                // First toggle online status so location updates can be saved
                await toggleDriverOnline(value);
                setIsOnline(value);
                
                // Get and save current location immediately (don't wait for background task)
                try {
                    const Location = require('expo-location');
                    const location = await Location.getCurrentPositionAsync({
                        accuracy: Location.Accuracy.Balanced,
                    });
                    if (location && profile?.id) {
                        // Update location in database
                        const { supabase } = require('@/lib/supabase');
                        await supabase
                            .from('drivers')
                            .update({
                                current_latitude: location.coords.latitude,
                                current_longitude: location.coords.longitude,
                                last_location_update: new Date().toISOString(),
                            })
                            .eq('user_id', profile.id);
                        console.log('📍 Initial location set:', location.coords.latitude, location.coords.longitude);
                    }
                } catch (locError) {
                    console.error('Failed to set initial location:', locError);
                }
                
                // Register push token for notifications
                try {
                    const { registerPushToken } = require('@/lib/notifications');
                    const { supabase } = require('@/lib/supabase');
                    if (profile?.id) {
                        await registerPushToken(supabase, profile.id);
                    }
                } catch (pushError) {
                    console.error('Failed to register push token:', pushError);
                }
                
                // Start background location tracking
                await startLocationTracking();
            } else {
                // Going offline - stop tracking
                await stopLocationTracking();
                setIsOnline(value);
                await toggleDriverOnline(value);
            }
        } catch (error) {
            console.error('Failed to toggle online status:', error);
            Alert.alert(t('error'), t('failedToUpdateStatus'));
        } finally {
            setIsTogglingStatus(false);
        }
    };

    const navigateToRide = (bookingId: string) => {
        router.push(`/ride/${bookingId}` as any);
    };

    const getStatusBadge = (status: Booking['status']) => {
        switch (status) {
            case 'accepted':
                return { text: t('headToPickup'), color: 'bg-blue-500/20', textColor: 'text-blue-400' };
            case 'driver_arrived':
                return { text: t('verifyOtp'), color: 'bg-yellow-500/20', textColor: 'text-yellow-400' };
            case 'in_progress':
                return { text: t('tripInProgress'), color: 'bg-green-500/20', textColor: 'text-green-400' };
            default:
                return { text: t('unknown'), color: 'bg-gray-500/20', textColor: 'text-gray-400' };
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-white">
            <ScrollView className="p-5" contentContainerStyle={{ paddingBottom: 100 }}>
                {/* Header */}
                <View className="flex-row justify-between items-center mb-6">
                    <View>
                        <Text className="text-gray-500 text-sm">Welcome back,</Text>
                        <Text className="text-gray-900 text-2xl font-JakartaBold">
                            {profile?.name || 'Driver'}
                        </Text>
                    </View>
                    <TouchableOpacity
                        onPress={signOut}
                        className="bg-red-50 px-4 py-2 rounded-full"
                    >
                        <Text className="text-red-600 font-JakartaSemiBold">Logout</Text>
                    </TouchableOpacity>
                </View>

                {/* Active Rides List */}
                {activeBookings.length > 0 && (
                    <View className="mb-6">
                        {/* Expandable Header */}
                        <TouchableOpacity
                            onPress={() => setIsRidesExpanded(!isRidesExpanded)}
                            className="flex-row justify-between items-center mb-3"
                        >
                            <Text className="text-gray-900 text-lg font-JakartaBold">
                                {t('activeRides')} ({activeBookings.length})
                            </Text>
                            <Feather
                                name={isRidesExpanded ? "chevron-up" : "chevron-down"}
                                size={24}
                                color="#6b7280"
                            />
                        </TouchableOpacity>

                        {/* Ride Cards - Only show when expanded */}
                        {isRidesExpanded && activeBookings.map((booking) => {
                            const statusBadge = getStatusBadge(booking.status);
                            return (
                                <TouchableOpacity
                                    key={booking.id}
                                    onPress={() => navigateToRide(booking.id)}
                                    className="bg-gray-50 rounded-2xl p-4 mb-3 border border-gray-200"
                                >
                                    {/* Status Badge */}
                                    <View className="mb-3">
                                        <View className={`self-start px-3 py-1 rounded-full ${statusBadge.color}`}>
                                            <Text className={`text-xs font-JakartaSemiBold ${statusBadge.textColor}`}>
                                                {statusBadge.text}
                                            </Text>
                                        </View>
                                    </View>

                                    {/* Customer Info */}
                                    <View className="flex-row items-center mb-3">
                                        <View className="w-10 h-10 bg-gray-200 rounded-full items-center justify-center mr-3">
                                            <Ionicons name="person" size={20} color="#9ca3af" />
                                        </View>
                                        <View className="flex-1">
                                            <Text className="text-gray-900 font-JakartaSemiBold">
                                                {booking.customer?.name || 'Customer'}
                                            </Text>
                                            <Text className="text-gray-500 text-xs">
                                                {booking.booking_number}
                                            </Text>
                                        </View>
                                        <Text className="text-gray-500 text-xl">›</Text>
                                    </View>

                                    {/* Destination */}
                                    <View className="mb-2">
                                        <Text className="text-gray-500 text-xs mb-1">{t('destination')}</Text>
                                        <Text className="text-gray-900 text-sm" numberOfLines={1}>
                                            {booking.destination_address}
                                        </Text>
                                    </View>

                                    {/* Fare */}
                                    <View className="flex-row justify-between items-center pt-2 border-t border-gray-200">
                                        <Text className="text-gray-500 text-xs">Fare</Text>
                                        <Text className="text-green-600 font-JakartaBold">
                                            ₹{booking.driver_payout || booking.total_fare}
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                )}

                {/* Online Status Card */}
                <View className="bg-gray-50 p-6 rounded-2xl mb-6 border border-gray-200">
                    <View className="flex-row justify-between items-center">
                        <View>
                            <Text className="text-gray-500 text-sm mb-1">{t('status')}</Text>
                            <Text className={`text-2xl font-JakartaBold ${isOnline ? 'text-green-600' : 'text-red-600'}`}>
                                {isOnline ? `🟢 ${t('online')}` : `🔴 ${t('offline')}`}
                            </Text>
                        </View>
                        <Switch
                            value={isOnline}
                            onValueChange={handleToggleOnline}
                            trackColor={{ false: '#d1d5db', true: '#22c55e' }}
                            thumbColor={isOnline ? '#ffffff' : '#9ca3af'}
                            disabled={isTogglingStatus}
                        />
                    </View>
                    <Text className="text-gray-500 text-sm mt-3">
                        {isTogglingStatus 
                            ? t('updatingStatus') 
                            : isOnline 
                                ? t('visibleToCustomers') 
                                : t('goOnlineToReceive')}
                    </Text>
                </View>

                {/* Today's Stats */}
                <Text className="text-gray-900 text-xl font-JakartaBold mb-4">{t('todaysSummary')}</Text>
                <View className="flex-row gap-3 mb-6">
                    <View className="flex-1 bg-blue-50 p-4 rounded-xl border border-blue-100">
                        <Text className="text-blue-600 text-sm mb-1">Earnings</Text>
                        {isLoadingStats ? (
                            <ActivityIndicator size="small" color="#2563eb" />
                        ) : (
                            <Text className="text-gray-900 text-2xl font-JakartaBold">
                                ₹{todayStats.earnings.toLocaleString()}
                            </Text>
                        )}
                    </View>
                    <View className="flex-1 bg-purple-50 p-4 rounded-xl border border-purple-100">
                        <Text className="text-purple-600 text-sm mb-1">{t('trips')}</Text>
                        {isLoadingStats ? (
                            <ActivityIndicator size="small" color="#7c3aed" />
                        ) : (
                            <Text className="text-gray-900 text-2xl font-JakartaBold">{todayStats.trips}</Text>
                        )}
                    </View>
                    <View className="flex-1 bg-green-50 p-4 rounded-xl border border-green-100">
                        <Text className="text-green-600 text-sm mb-1">Rating</Text>
                        <Text className="text-gray-900 text-2xl font-JakartaBold">
                            {driverProfile?.rating?.toFixed(1) || '5.0'}
                        </Text>
                    </View>
                </View>

                {/* Quick Actions */}
                <Text className="text-gray-900 text-xl font-JakartaBold mb-4">{t('quickActions')}</Text>
                <View className="gap-3">
                    <TouchableOpacity 
                        onPress={() => router.push('/(tabs)/requests')}
                        className="bg-gray-50 p-4 rounded-xl flex-row items-center border border-gray-200"
                    >
                        <View className="w-12 h-12 bg-blue-100 rounded-full items-center justify-center mr-4">
                            <Ionicons name="list" size={24} color="#3b82f6" />
                        </View>
                        <View className="flex-1">
                            <Text className="text-gray-900 font-JakartaSemiBold">{t('viewRequests')}</Text>
                            <Text className="text-gray-500 text-sm">{t('checkAvailableRequests')}</Text>
                        </View>
                    </TouchableOpacity>

                    <TouchableOpacity 
                        onPress={() => router.push('/(tabs)/earnings')}
                        className="bg-gray-50 p-4 rounded-xl flex-row items-center border border-gray-200"
                    >
                        <View className="w-12 h-12 bg-green-100 rounded-full items-center justify-center mr-4">
                            <Ionicons name="wallet" size={24} color="#22c55e" />
                        </View>
                        <View className="flex-1">
                            <Text className="text-gray-900 font-JakartaSemiBold">{t('earnings')}</Text>
                            <Text className="text-gray-500 text-sm">
                                {t('total')}: ₹{(driverProfile?.total_earnings || 0).toLocaleString()}
                            </Text>
                        </View>
                    </TouchableOpacity>

                    <TouchableOpacity 
                        onPress={() => Alert.alert(t('helpSupport'), `${t('contactUsAt')} drivers@cart-r.com`)}
                        className="bg-gray-50 p-4 rounded-xl flex-row items-center border border-gray-200"
                    >
                        <View className="w-12 h-12 bg-orange-100 rounded-full items-center justify-center mr-4">
                            <Ionicons name="call" size={24} color="#f97316" />
                        </View>
                        <View className="flex-1">
                            <Text className="text-gray-900 font-JakartaSemiBold">{t('helpSupport')}</Text>
                            <Text className="text-gray-500 text-sm">{t('getHelpFromTeam')}</Text>
                        </View>
                    </TouchableOpacity>
                </View>

            </ScrollView>
        </SafeAreaView>
    );
};

export default DriverHome;
