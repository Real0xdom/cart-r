import { View, Text, TouchableOpacity, ScrollView, Dimensions, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getDriverCompletedTrips, Booking } from '@/lib/bookings';

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
                    <Text className="text-gray-400 text-xs">{item.day}</Text>
                </View>
            ))}
        </View>
    );
};

const DriverEarnings = () => {
    const { driverProfile } = useAuth();
    const [period, setPeriod] = useState<'today' | 'week' | 'month'>('week');
    const [trips, setTrips] = useState<Booking[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchEarnings = async () => {
        if (!driverProfile?.id) return;

        const { data, error } = await getDriverCompletedTrips(driverProfile.id, 100);
        if (!error && data) {
            setTrips(data);
        }
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
            <SafeAreaView className="flex-1 bg-gray-900 items-center justify-center">
                <ActivityIndicator size="large" color="#22c55e" />
                <Text className="text-gray-400 mt-4">Loading earnings...</Text>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-gray-900">
            <ScrollView 
                className="flex-1" 
                contentContainerStyle={{ paddingBottom: 100 }}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />
                }
            >
                {/* Header */}
                <View className="p-5">
                    <Text className="text-white text-2xl font-JakartaBold mb-1">Earnings</Text>
                    <Text className="text-gray-400">Track your income and trips</Text>
                </View>

                {/* Period Selector */}
                <View className="flex-row mx-5 bg-gray-800 rounded-xl p-1 mb-6">
                    {(['today', 'week', 'month'] as const).map((p) => (
                        <TouchableOpacity
                            key={p}
                            onPress={() => setPeriod(p)}
                            className={`flex-1 py-3 rounded-lg ${period === p ? 'bg-green-500' : ''}`}
                        >
                            <Text className={`text-center font-JakartaSemiBold capitalize ${period === p ? 'text-white' : 'text-gray-400'}`}>
                                {p}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Total Earnings Card */}
                <View className="mx-5 bg-gradient-to-br bg-green-500/20 border border-green-500/30 rounded-2xl p-6 mb-6">
                    <Text className="text-green-400 text-sm mb-1">Total Earnings ({period})</Text>
                    <Text className="text-white text-4xl font-JakartaBold">₹{totalEarnings.toLocaleString()}</Text>
                    <View className="flex-row mt-4 gap-6">
                        <View>
                            <Text className="text-gray-400 text-xs">Trips</Text>
                            <Text className="text-white font-JakartaSemiBold">{tripsCount}</Text>
                        </View>
                        <View>
                            <Text className="text-gray-400 text-xs">Lifetime Earnings</Text>
                            <Text className="text-white font-JakartaSemiBold">₹{(driverProfile?.total_earnings || 0).toLocaleString()}</Text>
                        </View>
                        <View>
                            <Text className="text-gray-400 text-xs">Avg/Trip</Text>
                            <Text className="text-white font-JakartaSemiBold">₹{avgPerTrip}</Text>
                        </View>
                    </View>
                </View>

                {/* Chart */}
                <View className="mx-5 bg-gray-800 rounded-2xl p-4 mb-6">
                    <Text className="text-white font-JakartaBold mb-4">Last 7 Days</Text>
                    <BarChart data={weeklyData} />
                </View>

                {/* Recent Trips */}
                <View className="mx-5">
                    <Text className="text-white font-JakartaBold mb-4">Recent Trips</Text>
                    {recentTrips.length > 0 ? (
                        recentTrips.map(trip => (
                            <View key={trip.id} className="bg-gray-800 rounded-xl p-4 mb-3 flex-row justify-between items-center">
                                <View className="flex-1">
                                    <Text className="text-white font-JakartaSemiBold" numberOfLines={1}>
                                        {trip.origin_address.split(',')[0]} → {trip.destination_address.split(',')[0]}
                                    </Text>
                                    <Text className="text-gray-400 text-sm">
                                        {new Date(trip.completed_at || trip.created_at).toLocaleDateString('en-IN', {
                                            day: 'numeric',
                                            month: 'short',
                                            hour: '2-digit',
                                            minute: '2-digit',
                                        })}
                                    </Text>
                                </View>
                                <Text className="text-green-400 font-JakartaBold text-lg">
                                    ₹{trip.driver_payout || trip.total_fare}
                                </Text>
                            </View>
                        ))
                    ) : (
                        <View className="bg-gray-800 rounded-xl p-6 items-center">
                            <Text className="text-4xl mb-2">📭</Text>
                            <Text className="text-gray-400 text-center">No completed trips yet</Text>
                        </View>
                    )}
                </View>

                {/* Withdraw Button - shows if has balance */}
                {(driverProfile?.total_earnings || 0) > 0 && (
                    <TouchableOpacity className="mx-5 mt-6 bg-green-500 p-4 rounded-xl">
                        <Text className="text-white text-center font-JakartaBold text-lg">Withdraw to Bank</Text>
                    </TouchableOpacity>
                )}

            </ScrollView>
        </SafeAreaView>
    );
};

export default DriverEarnings;
