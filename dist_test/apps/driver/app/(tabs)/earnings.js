"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const react_native_1 = require("react-native");
const react_native_safe_area_context_1 = require("react-native-safe-area-context");
const react_1 = require("react");
const AuthContext_1 = require("@/contexts/AuthContext");
const bookings_1 = require("@/lib/bookings");
const { width } = react_native_1.Dimensions.get('window');
const BarChart = ({ data }) => {
    const maxAmount = Math.max(...data.map(d => d.amount), 1);
    const barWidth = (width - 80) / data.length - 8;
    return (<react_native_1.View className="flex-row justify-between items-end h-32 px-2">
            {data.map((item, index) => (<react_native_1.View key={index} className="items-center">
                    <react_native_1.View style={{
                height: Math.max((item.amount / maxAmount) * 100, 4),
                width: barWidth,
            }} className="bg-green-500 rounded-t-lg mb-2"/>
                    <react_native_1.Text className="text-gray-400 text-xs">{item.day}</react_native_1.Text>
                </react_native_1.View>))}
        </react_native_1.View>);
};
const DriverEarnings = () => {
    const { driverProfile } = (0, AuthContext_1.useAuth)();
    const [period, setPeriod] = (0, react_1.useState)('week');
    const [trips, setTrips] = (0, react_1.useState)([]);
    const [isLoading, setIsLoading] = (0, react_1.useState)(true);
    const [refreshing, setRefreshing] = (0, react_1.useState)(false);
    const fetchEarnings = async () => {
        if (!(driverProfile === null || driverProfile === void 0 ? void 0 : driverProfile.id))
            return;
        const { data, error } = await (0, bookings_1.getDriverCompletedTrips)(driverProfile.id, 100);
        if (!error && data) {
            setTrips(data);
        }
        setIsLoading(false);
    };
    (0, react_1.useEffect)(() => {
        fetchEarnings();
    }, [driverProfile === null || driverProfile === void 0 ? void 0 : driverProfile.id]);
    const onRefresh = (0, react_1.useCallback)(async () => {
        setRefreshing(true);
        await fetchEarnings();
        setRefreshing(false);
    }, [driverProfile === null || driverProfile === void 0 ? void 0 : driverProfile.id]);
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
    const getWeeklyData = () => {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const weekData = days.map(day => ({ day, amount: 0, trips: 0 }));
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
        const reordered = [];
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
        return (<react_native_safe_area_context_1.SafeAreaView className="flex-1 bg-gray-900 items-center justify-center">
                <react_native_1.ActivityIndicator size="large" color="#22c55e"/>
                <react_native_1.Text className="text-gray-400 mt-4">Loading earnings...</react_native_1.Text>
            </react_native_safe_area_context_1.SafeAreaView>);
    }
    return (<react_native_safe_area_context_1.SafeAreaView className="flex-1 bg-gray-900">
            <react_native_1.ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 100 }} refreshControl={<react_native_1.RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff"/>}>
                {/* Header */}
                <react_native_1.View className="p-5">
                    <react_native_1.Text className="text-white text-2xl font-JakartaBold mb-1">Earnings</react_native_1.Text>
                    <react_native_1.Text className="text-gray-400">Track your income and trips</react_native_1.Text>
                </react_native_1.View>

                {/* Period Selector */}
                <react_native_1.View className="flex-row mx-5 bg-gray-800 rounded-xl p-1 mb-6">
                    {['today', 'week', 'month'].map((p) => (<react_native_1.TouchableOpacity key={p} onPress={() => setPeriod(p)} className={`flex-1 py-3 rounded-lg ${period === p ? 'bg-green-500' : ''}`}>
                            <react_native_1.Text className={`text-center font-JakartaSemiBold capitalize ${period === p ? 'text-white' : 'text-gray-400'}`}>
                                {p}
                            </react_native_1.Text>
                        </react_native_1.TouchableOpacity>))}
                </react_native_1.View>

                {/* Total Earnings Card */}
                <react_native_1.View className="mx-5 bg-gradient-to-br bg-green-500/20 border border-green-500/30 rounded-2xl p-6 mb-6">
                    <react_native_1.Text className="text-green-400 text-sm mb-1">Total Earnings ({period})</react_native_1.Text>
                    <react_native_1.Text className="text-white text-4xl font-JakartaBold">₹{totalEarnings.toLocaleString()}</react_native_1.Text>
                    <react_native_1.View className="flex-row mt-4 gap-6">
                        <react_native_1.View>
                            <react_native_1.Text className="text-gray-400 text-xs">Trips</react_native_1.Text>
                            <react_native_1.Text className="text-white font-JakartaSemiBold">{tripsCount}</react_native_1.Text>
                        </react_native_1.View>
                        <react_native_1.View>
                            <react_native_1.Text className="text-gray-400 text-xs">Lifetime Earnings</react_native_1.Text>
                            <react_native_1.Text className="text-white font-JakartaSemiBold">₹{((driverProfile === null || driverProfile === void 0 ? void 0 : driverProfile.total_earnings) || 0).toLocaleString()}</react_native_1.Text>
                        </react_native_1.View>
                        <react_native_1.View>
                            <react_native_1.Text className="text-gray-400 text-xs">Avg/Trip</react_native_1.Text>
                            <react_native_1.Text className="text-white font-JakartaSemiBold">₹{avgPerTrip}</react_native_1.Text>
                        </react_native_1.View>
                    </react_native_1.View>
                </react_native_1.View>

                {/* Chart */}
                <react_native_1.View className="mx-5 bg-gray-800 rounded-2xl p-4 mb-6">
                    <react_native_1.Text className="text-white font-JakartaBold mb-4">Last 7 Days</react_native_1.Text>
                    <BarChart data={weeklyData}/>
                </react_native_1.View>

                {/* Recent Trips */}
                <react_native_1.View className="mx-5">
                    <react_native_1.Text className="text-white font-JakartaBold mb-4">Recent Trips</react_native_1.Text>
                    {recentTrips.length > 0 ? (recentTrips.map(trip => (<react_native_1.View key={trip.id} className="bg-gray-800 rounded-xl p-4 mb-3 flex-row justify-between items-center">
                                <react_native_1.View className="flex-1">
                                    <react_native_1.Text className="text-white font-JakartaSemiBold" numberOfLines={1}>
                                        {trip.origin_address.split(',')[0]} → {trip.destination_address.split(',')[0]}
                                    </react_native_1.Text>
                                    <react_native_1.Text className="text-gray-400 text-sm">
                                        {new Date(trip.completed_at || trip.created_at).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
            })}
                                    </react_native_1.Text>
                                </react_native_1.View>
                                <react_native_1.Text className="text-green-400 font-JakartaBold text-lg">
                                    ₹{trip.driver_payout || trip.total_fare}
                                </react_native_1.Text>
                            </react_native_1.View>))) : (<react_native_1.View className="bg-gray-800 rounded-xl p-6 items-center">
                            <react_native_1.Text className="text-4xl mb-2">📭</react_native_1.Text>
                            <react_native_1.Text className="text-gray-400 text-center">No completed trips yet</react_native_1.Text>
                        </react_native_1.View>)}
                </react_native_1.View>

                {/* Withdraw Button - shows if has balance */}
                {((driverProfile === null || driverProfile === void 0 ? void 0 : driverProfile.total_earnings) || 0) > 0 && (<react_native_1.TouchableOpacity onPress={() => react_native_1.Alert.alert('Coming Soon', 'Withdrawals will be available soon!')} className="mx-5 mt-6 bg-green-500 p-4 rounded-xl">
                        <react_native_1.Text className="text-white text-center font-JakartaBold text-lg">Withdraw to Bank</react_native_1.Text>
                    </react_native_1.TouchableOpacity>)}

            </react_native_1.ScrollView>
        </react_native_safe_area_context_1.SafeAreaView>);
};
exports.default = DriverEarnings;
