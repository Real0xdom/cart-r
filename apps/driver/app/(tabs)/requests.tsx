import { View, Text, TouchableOpacity, ScrollView, RefreshControl, ActivityIndicator, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCallback } from 'react';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { getDriverAllBookings, Booking } from '@/lib/bookings';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';

const ActiveRideCard = ({ booking }: { booking: Booking }) => {
    const { t } = useLanguage();
    
    const getStatusText = (status: Booking['status']) => {
        switch (status) {
            case 'accepted': return t('headToPickup') || 'Head to pickup';
            case 'driver_arrived': return t('verifyOtp') || 'Verify OTP';
            case 'in_progress': return t('tripInProgress') || 'Trip in progress';
            default: return String(status);
        }
    };
    
    return (
        <TouchableOpacity
            onPress={() => router.push(`/ride/${booking.id}`)}
            className="bg-blue-50/50 rounded-2xl p-4 mb-4 border border-blue-200 shadow-sm"
        >
            <View className="mb-3">
                <View className="self-start px-3 py-1 rounded-full bg-blue-500">
                    <Text className="text-xs font-JakartaBold text-white">
                        Active Ride: {getStatusText(booking.status)}
                    </Text>
                </View>
            </View>
            <View className="flex-row justify-between items-start mb-2">
                <View className="flex-1 pr-4">
                    <Text className="text-gray-500 text-xs mb-1">
                        {booking.status === 'in_progress' ? 'DROP-OFF' : 'PICKUP'}
                    </Text>
                    <Text className="text-gray-900 font-JakartaSemiBold text-base" numberOfLines={2}>
                        {booking.status === 'in_progress' ? booking.destination_address : booking.origin_address}
                    </Text>
                </View>
                <View className="bg-green-100 px-3 py-1 rounded-full items-center justify-center">
                    <Text className="text-green-700 font-JakartaBold">₹{booking.total_fare}</Text>
                </View>
            </View>
            <Text className="text-blue-600 font-JakartaMedium text-sm mt-2 text-center">Tap to view navigation</Text>
        </TouchableOpacity>
    );
};

const QueuedRideCard = ({ booking }: { booking: Booking }) => {
    return (
        <View className="bg-amber-50 rounded-2xl p-4 mb-4 border border-amber-200 shadow-sm">
            <View className="mb-3">
                <View className="self-start px-3 py-1 rounded-full bg-amber-500">
                    <Text className="text-xs font-JakartaBold text-white">
                        Next Ride Queued
                    </Text>
                </View>
            </View>
            <View className="flex-row justify-between items-start mb-2">
                <View className="flex-1 pr-4">
                    <Text className="text-gray-500 text-xs mb-1">NEXT DROP-OFF</Text>
                    <Text className="text-gray-900 font-JakartaSemiBold text-base" numberOfLines={2}>
                        {booking.destination_address}
                    </Text>
                    <Text className="text-amber-700 font-JakartaMedium text-sm mt-2">
                        {booking.customer?.name || 'Customer'} is waiting for you next
                    </Text>
                </View>
                <View className="bg-amber-100 px-3 py-1 rounded-full items-center justify-center">
                    <Text className="text-amber-700 font-JakartaBold">₹{booking.total_fare}</Text>
                </View>
            </View>
            <Text className="text-amber-700 font-JakartaMedium text-sm mt-2 text-center">
                Finish your current ride to activate this trip
            </Text>
        </View>
    );
};

/**
 * History ride card for completed trips
 */
const HistoryRideCard = ({ booking }: { booking: Booking }) => {
    
    const formatTimeAgo = (dateString: string | null) => {
        if (!dateString) return 'Unknown';
        const now = new Date();
        const completed = new Date(dateString);
        const diffMs = now.getTime() - completed.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);
        
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        return `${diffDays}d ago`;
    };
    
    const getTripEarning = () => {
        if (booking.driver_payout && booking.driver_payout < booking.total_fare) {
            return Math.round(Number(booking.driver_payout));
        }
        return Math.round(booking.total_fare * 0.85);
    };

    const payout = getTripEarning();

    return (
        <View className="bg-green-50/50 rounded-2xl p-4 mb-4 border border-green-200 shadow-sm">
            <View className="mb-3">
                <View className="self-start px-3 py-1 rounded-full bg-green-500">
                    <Text className="text-xs font-JakartaBold text-white">
                        Completed {formatTimeAgo(booking.completed_at || null)}
                    </Text>
                </View>
            </View>
            <View className="flex-row justify-between items-start mb-2">
                <View className="flex-1 pr-4">
                    <Text className="text-gray-500 text-xs mb-1">PICKUP → DROP-OFF</Text>
                    <Text className="text-gray-900 font-JakartaSemiBold text-base" numberOfLines={1}>
                        {booking.origin_address} → {booking.destination_address}
                    </Text>
                </View>
                <View className="bg-emerald-100 px-3 py-1 rounded-full items-center justify-center">
                    <Text className="text-emerald-700 font-JakartaBold">
                        ₹{payout}
                    </Text>
                    <Text className="text-emerald-700 text-[10px] text-center mt-0.5 opacity-80 font-JakartaMedium">
                        Fare: ₹{booking.total_fare}
                    </Text>
                </View>
            </View>
            <View className="flex-row gap-2 mt-2">
                <View className="flex-1 bg-gray-50 p-2 rounded-lg">
                    <Text className="text-xs text-gray-500">Distance</Text>
                    <Text className="font-JakartaSemiBold text-sm">
                        {booking.estimated_distance?.toFixed(1)} km
                    </Text>
                </View>
                <View className="flex-1 bg-gray-50 p-2 rounded-lg">
                    <Text className="text-xs text-gray-500">Payment</Text>
                    <Text className="font-JakartaSemiBold text-sm capitalize">{booking.payment_method}</Text>
                </View>
            </View>
        </View>
    );
};

const DriverRequests = () => {
    const { driverProfile } = useAuth();
    const { t } = useLanguage();
    
    const { data: allRides = [], isLoading, isRefetching, refetch } = useQuery({
        queryKey: ['driverBookings', driverProfile?.id],
        queryFn: async () => {
            if (!driverProfile?.id) return [];
            const { data, error } = await getDriverAllBookings(driverProfile.id, 50);
            if (error) throw new Error(error);
            const combined = [...data];
            combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            return combined;
        },
        enabled: !!driverProfile?.id,
        refetchInterval: 30000, // Background refresh every 30s
    });

    const onRefresh = useCallback(async () => {
        await refetch();
    }, [refetch]);

    const pulseAnim = useRef(new Animated.Value(0.4)).current;

    // Subtle pulse animation for the background-loading banner
    useEffect(() => {
        if (!isLoading) return;
        const pulse = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
                Animated.timing(pulseAnim, { toValue: 0.4, duration: 800, useNativeDriver: true }),
            ])
        );
        pulse.start();
        return () => pulse.stop();
    }, [isLoading]);

    // No blocking loading guard - page is always visible immediately

    // Render - SINGLE list showing ALL rides
    return (
        <SafeAreaView testID="driver.requests" accessibilityLabel="driver.requests" className="flex-1 bg-white">
            <View className="px-5 pt-5 pb-20 flex-1">
                {/* Header */}
                <View className="mb-6">
                    <Text className="text-gray-900 text-3xl font-JakartaBold mb-2">
                        {t('myRides') || 'My Rides'}
                    </Text>
                    <Text className="text-gray-500 text-sm">
                        {allRides.length} {allRides.length === 1 ? 'ride' : 'rides'} total
                    </Text>
                </View>

                {/* Background loading banner - shown while fetching, never blocks the page */}
                {isLoading && (
                    <Animated.View
                        style={{ opacity: pulseAnim }}
                        className="flex-row items-center bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-4"
                    >
                        <ActivityIndicator size="small" color="#2563eb" />
                        <Text className="text-blue-600 font-JakartaMedium text-sm ml-3">
                            Loading your rides...
                        </Text>
                    </Animated.View>
                )}

                {allRides.length === 0 && !isLoading ? (
                    <View className="bg-gray-50 rounded-2xl p-8 border border-gray-200 items-center">
                        <Ionicons name="car-outline" size={64} color="#9ca3af" />
                        <Text className="text-gray-500 text-center mt-4 font-JakartaMedium text-lg">
                            No rides yet
                        </Text>
                        <Text className="text-gray-400 text-center text-sm mt-2">
                            When you accept ride requests or complete trips, they'll appear here
                        </Text>
                    </View>
                ) : (
                    <ScrollView
                        refreshControl={
                            <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} />
                        }
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={{ paddingBottom: 100 }}
                    >
                        {/* SINGLE LIST - All rides together */}
                        {allRides.map((ride, index) => {
                            // Check if it's an available request (pending) or active/completed ride
                            const isQueued = ride.status === 'queued';
                            const isOngoing = ['accepted', 'driver_arrived', 'in_progress'].includes(ride.status);
                            const isCompleted = ride.status === 'completed';
                            
                            if (isQueued) {
                                return (
                                    <QueuedRideCard
                                        key={ride.id}
                                        booking={ride}
                                    />
                                );
                            } else if (isOngoing) {
                                return (
                                    <ActiveRideCard
                                        key={ride.id}
                                        booking={ride}
                                    />
                                );
                            } else if (isCompleted) {
                                return (
                                    <HistoryRideCard
                                        key={ride.id}
                                        booking={ride}
                                    />
                                );
                            }
                            return null;
                        })}
                    </ScrollView>
                )}
            </View>
        </SafeAreaView>
    );
};

export default DriverRequests;



