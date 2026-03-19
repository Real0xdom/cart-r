"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const react_native_1 = require("react-native");
const react_native_safe_area_context_1 = require("react-native-safe-area-context");
const react_1 = require("react");
const { width } = react_native_1.Dimensions.get('window');
// Mock earnings data
const weeklyData = [
    { day: 'Mon', amount: 850 },
    { day: 'Tue', amount: 1200 },
    { day: 'Wed', amount: 650 },
    { day: 'Thu', amount: 1450 },
    { day: 'Fri', amount: 1800 },
    { day: 'Sat', amount: 2100 },
    { day: 'Sun', amount: 950 },
];
const recentTrips = [
    { id: '1', from: 'Koramangala', to: 'Whitefield', fare: '₹450', time: '2:30 PM' },
    { id: '2', from: 'HSR Layout', to: 'MG Road', fare: '₹280', time: '11:15 AM' },
    { id: '3', from: 'Indiranagar', to: 'Airport', fare: '₹850', time: 'Yesterday' },
    { id: '4', from: 'Jayanagar', to: 'Electronic City', fare: '₹380', time: 'Yesterday' },
];
const BarChart = ({ data }) => {
    const maxAmount = Math.max(...data.map(d => d.amount));
    const barWidth = (width - 80) / data.length - 8;
    return (<react_native_1.View className="flex-row justify-between items-end h-32 px-2">
            {data.map((item, index) => (<react_native_1.View key={index} className="items-center">
                    <react_native_1.View style={{
                height: (item.amount / maxAmount) * 100,
                width: barWidth,
            }} className="bg-green-500 rounded-t-lg mb-2"/>
                    <react_native_1.Text className="text-gray-400 text-xs">{item.day}</react_native_1.Text>
                </react_native_1.View>))}
        </react_native_1.View>);
};
const DriverEarnings = () => {
    const [period, setPeriod] = (0, react_1.useState)('week');
    const totalEarnings = weeklyData.reduce((sum, d) => sum + d.amount, 0);
    return (<react_native_safe_area_context_1.SafeAreaView className="flex-1 bg-gray-900">
            <react_native_1.ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 100 }}>
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
                            <react_native_1.Text className="text-white font-JakartaSemiBold">23</react_native_1.Text>
                        </react_native_1.View>
                        <react_native_1.View>
                            <react_native_1.Text className="text-gray-400 text-xs">Hours Online</react_native_1.Text>
                            <react_native_1.Text className="text-white font-JakartaSemiBold">32h</react_native_1.Text>
                        </react_native_1.View>
                        <react_native_1.View>
                            <react_native_1.Text className="text-gray-400 text-xs">Avg/Trip</react_native_1.Text>
                            <react_native_1.Text className="text-white font-JakartaSemiBold">₹391</react_native_1.Text>
                        </react_native_1.View>
                    </react_native_1.View>
                </react_native_1.View>

                {/* Chart */}
                <react_native_1.View className="mx-5 bg-gray-800 rounded-2xl p-4 mb-6">
                    <react_native_1.Text className="text-white font-JakartaBold mb-4">Weekly Overview</react_native_1.Text>
                    <BarChart data={weeklyData}/>
                </react_native_1.View>

                {/* Recent Trips */}
                <react_native_1.View className="mx-5">
                    <react_native_1.Text className="text-white font-JakartaBold mb-4">Recent Trips</react_native_1.Text>
                    {recentTrips.map(trip => (<react_native_1.View key={trip.id} className="bg-gray-800 rounded-xl p-4 mb-3 flex-row justify-between items-center">
                            <react_native_1.View className="flex-1">
                                <react_native_1.Text className="text-white font-JakartaSemiBold">{trip.from} → {trip.to}</react_native_1.Text>
                                <react_native_1.Text className="text-gray-400 text-sm">{trip.time}</react_native_1.Text>
                            </react_native_1.View>
                            <react_native_1.Text className="text-green-400 font-JakartaBold text-lg">{trip.fare}</react_native_1.Text>
                        </react_native_1.View>))}
                </react_native_1.View>

                {/* Withdraw Button */}
                <react_native_1.TouchableOpacity className="mx-5 mt-6 bg-green-500 p-4 rounded-xl">
                    <react_native_1.Text className="text-white text-center font-JakartaBold text-lg">Withdraw to Bank</react_native_1.Text>
                </react_native_1.TouchableOpacity>

            </react_native_1.ScrollView>
        </react_native_safe_area_context_1.SafeAreaView>);
};
exports.default = DriverEarnings;
