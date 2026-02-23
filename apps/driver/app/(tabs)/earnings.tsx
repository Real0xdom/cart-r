import { View, Text, TouchableOpacity, ScrollView, Dimensions, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { getDriverCompletedTrips, Booking } from '@/lib/bookings';
import { getDriverWalletInfo, WalletInfo } from '@/lib/walletLib';

const { width } = Dimensions.get('window');

interface DailyEarning {
    day: string;
    amount: number;
    trips: number;
}

const BarChart = ({ data }: { data: DailyEarning[] }) => {
    const maxAmount = Math.max(...data.map(d => d.amount), 1);
    const barWidth = (width - 80) / data.length - 8;

    return (
        <View className="flex-row justify-between items-end h-32 px-2">
            {data.map((item, index) => (
                <View key={index} className="items-center">
                    <View
                        style={{
                            height: Math.max((item.amount / maxAmount) * 100, 4),
                            width: barWidth,
                        }}
                        className="bg-green-500 rounded-t-lg mb-2"
                    />
                    <Text className="text-gray-600 text-xs">{item.day}</Text>
                </View>
            ))}
        </View>
    );
};

const DriverEarnings = () => {
    const { driverProfile } = useAuth();
    const { t } = useLanguage();
    const router = useRouter();
    const [period, setPeriod] = useState<'today' | 'week' | 'month'>('week');
    const [trips, setTrips] = useState<Booking[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [walletInfo, setWalletInfo] = useState<WalletInfo | null>(null);

    const fetchEarnings = async () => {
        if (!driverProfile?.id) return;

        const [tripsResult, wallet] = await Promise.all([
            getDriverCompletedTrips(driverProfile.id, 100),
            getDriverWalletInfo(driverProfile.id),
        ]);

        if (!tripsResult.error && tripsResult.data) {
            setTrips(tripsResult.data);
        }
        if (wallet) setWalletInfo(wallet);
        setIsLoading(false);
    };

    useEffect(() => {
        fetchEarnings();
    }, [driverProfile?.id]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await fetchEarnings();
        setRefreshing(false);
    }, [driverProfile?.id]);

    // Filter trips by period
    const getFilteredTrips = () => {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekStart = new Date(todayStart);
        weekStart.setDate(weekStart.getDate() - 7);
        const monthStart = new Date(todayStart);
        monthStart.setMonth(monthStart.getMonth() - 1);

        return trips.filter(trip => {
            const tripDate = new Date(trip.completed_at || trip.created_at);
            switch (period) {
                case 'today':
                    return tripDate >= todayStart;
                case 'week':
                    return tripDate >= weekStart;
                case 'month':
                    return tripDate >= monthStart;
                default:
                    return true;
            }
        });
    };

    // Calculate weekly chart data
    const getWeeklyData = (): DailyEarning[] => {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const weekData: DailyEarning[] = days.map(day => ({ day, amount: 0, trips: 0 }));
        
        const now = new Date();
        const weekStart = new Date(now);
        weekStart.setDate(weekStart.getDate() - 6);
        weekStart.setHours(0, 0, 0, 0);

        trips.forEach(trip => {
            const tripDate = new Date(trip.completed_at || trip.created_at);
            if (tripDate >= weekStart) {
                const dayIndex = tripDate.getDay();
                weekData[dayIndex].amount += (trip.driver_payout || trip.total_fare);
                weekData[dayIndex].trips += 1;
            }
        });

        // Reorder to start from today and go back 7 days
        const todayIndex = now.getDay();
        const reordered: DailyEarning[] = [];
        for (let i = 6; i >= 0; i--) {
            const idx = (todayIndex - i + 7) % 7;
            reordered.push(weekData[idx]);
        }
        return reordered;
    };

    const filteredTrips = getFilteredTrips();
    const totalEarnings = filteredTrips.reduce((sum, t) => sum + (t.driver_payout || t.total_fare), 0);
    const tripsCount = filteredTrips.length;
    const avgPerTrip = tripsCount > 0 ? Math.round(totalEarnings / tripsCount) : 0;
    const recentTrips = filteredTrips.slice(0, 10);
    const weeklyData = getWeeklyData();

    if (isLoading) {
        return (
            <SafeAreaView className="flex-1 bg-white items-center justify-center">
                <ActivityIndicator size="large" color="#22c55e" />
                <Text className="text-gray-600 mt-4">{t('loadingEarnings')}</Text>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-white">
            <ScrollView 
                className="flex-1" 
                contentContainerStyle={{ paddingBottom: 100 }}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#22c55e" />
                }
            >
                {/* Header */}
                <View className="p-5">
                    <Text className="text-gray-900 text-2xl font-JakartaBold mb-1">{t('earnings')}</Text>
                    <Text className="text-gray-500">{t('trackIncomeAndTrips')}</Text>
                </View>

                {/* Period Selector */}
                <View className="flex-row mx-5 bg-gray-100 rounded-xl p-1 mb-6">
                    {(['today', 'week', 'month'] as const).map((p) => (
                        <TouchableOpacity
                            key={p}
                            onPress={() => setPeriod(p)}
                            className={`flex-1 py-3 rounded-lg ${period === p ? 'bg-green-500' : ''}`}
                        >
                            <Text className={`text-center font-JakartaSemiBold capitalize ${period === p ? 'text-white' : 'text-gray-600'}`}>
                                {t(p)}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Wallet Balance Card */}
                {walletInfo && (
                    <View className="mx-5 bg-blue-50 border border-blue-200 rounded-2xl p-5 mb-4">
                        <Text className="text-blue-700 text-sm font-JakartaSemiBold mb-3">💰 Wallet Balance</Text>
                        <View className="flex-row justify-between">
                            <View className="flex-1">
                                <Text className="text-gray-500 text-xs">Available</Text>
                                <Text className="text-green-700 text-2xl font-JakartaBold">₹{walletInfo.available_balance.toLocaleString()}</Text>
                            </View>
                            <View className="flex-1">
                                <Text className="text-gray-500 text-xs">In Escrow</Text>
                                <Text className="text-yellow-700 text-2xl font-JakartaBold">₹{walletInfo.pending_balance.toLocaleString()}</Text>
                            </View>
                        </View>
                    </View>
                )}

                {/* Total Earnings Card */}
                <View className="mx-5 bg-green-50 border border-green-200 rounded-2xl p-6 mb-6">
                    <Text className="text-green-700 text-sm mb-1">{t('totalEarningsPeriod')} ({t(period)})</Text>
                    <Text className="text-gray-900 text-4xl font-JakartaBold">₹{totalEarnings.toLocaleString()}</Text>
                    <View className="flex-row mt-4 gap-6">
                        <View>
                            <Text className="text-gray-500 text-xs">{t('trips')}</Text>
                            <Text className="text-gray-900 font-JakartaSemiBold">{tripsCount}</Text>
                        </View>
                        <View>
                            <Text className="text-gray-500 text-xs">{t('lifetimeEarnings')}</Text>
                            <Text className="text-gray-900 font-JakartaSemiBold">₹{(walletInfo?.total_earned || driverProfile?.total_earnings || 0).toLocaleString()}</Text>
                        </View>
                        <View>
                            <Text className="text-gray-500 text-xs">{t('avgPerTrip')}</Text>
                            <Text className="text-gray-900 font-JakartaSemiBold">₹{avgPerTrip}</Text>
                        </View>
                    </View>
                </View>

                {/* Chart */}
                <View className="mx-5 bg-gray-50 border border-gray-200 rounded-2xl p-4 mb-6">
                    <Text className="text-gray-900 font-JakartaBold mb-4">{t('last7Days')}</Text>
                    <BarChart data={weeklyData} />
                </View>

                {/* Recent Trips */}
                <View className="mx-5">
                    <Text className="text-gray-900 font-JakartaBold mb-4">{t('recentTrips')}</Text>
                    {recentTrips.length > 0 ? (
                        recentTrips.map(trip => (
                            <View key={trip.id} className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-3 flex-row justify-between items-center">
                                <View className="flex-1">
                                    <Text className="text-gray-900 font-JakartaSemiBold" numberOfLines={1}>
                                        {trip.origin_address.split(',')[0]} → {trip.destination_address.split(',')[0]}
                                    </Text>
                                    <Text className="text-gray-500 text-sm">
                                        {new Date(trip.completed_at || trip.created_at).toLocaleDateString('en-IN', {
                                            day: 'numeric',
                                            month: 'short',
                                            hour: '2-digit',
                                            minute: '2-digit',
                                        })}
                                    </Text>
                                </View>
                                <Text className="text-green-600 font-JakartaBold text-lg">
                                    ₹{trip.driver_payout || trip.total_fare}
                                </Text>
                            </View>
                        ))
                    ) : (
                        <View className="bg-gray-50 border border-gray-200 rounded-xl p-6 items-center">
                            <Text className="text-4xl mb-2">📭</Text>
                            <Text className="text-gray-500 text-center">{t('noCompletedTrips')}</Text>
                        </View>
                    )}
                </View>

                {/* Withdraw Button */}
                {(walletInfo?.available_balance || 0) > 0 && (
                    <TouchableOpacity 
                        onPress={() => router.push('/profile/bank')}
                        className="mx-5 mt-6 bg-green-500 p-4 rounded-xl"
                    >
                        <Text className="text-white text-center font-JakartaBold text-lg">{t('withdrawToBank')}</Text>
                    </TouchableOpacity>
                )}

            </ScrollView>
        </SafeAreaView>
    );
};

export default DriverEarnings;
