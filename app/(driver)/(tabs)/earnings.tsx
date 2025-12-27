import { View, Text, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';

const { width } = Dimensions.get('window');

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

const BarChart = ({ data }: { data: typeof weeklyData }) => {
    const maxAmount = Math.max(...data.map(d => d.amount));
    const barWidth = (width - 80) / data.length - 8;

    return (
        <View className="flex-row justify-between items-end h-32 px-2">
            {data.map((item, index) => (
                <View key={index} className="items-center">
                    <View
                        style={{
                            height: (item.amount / maxAmount) * 100,
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
    const [period, setPeriod] = useState<'today' | 'week' | 'month'>('week');

    const totalEarnings = weeklyData.reduce((sum, d) => sum + d.amount, 0);

    return (
        <SafeAreaView className="flex-1 bg-gray-900">
            <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 100 }}>
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
                            <Text className="text-white font-JakartaSemiBold">23</Text>
                        </View>
                        <View>
                            <Text className="text-gray-400 text-xs">Hours Online</Text>
                            <Text className="text-white font-JakartaSemiBold">32h</Text>
                        </View>
                        <View>
                            <Text className="text-gray-400 text-xs">Avg/Trip</Text>
                            <Text className="text-white font-JakartaSemiBold">₹391</Text>
                        </View>
                    </View>
                </View>

                {/* Chart */}
                <View className="mx-5 bg-gray-800 rounded-2xl p-4 mb-6">
                    <Text className="text-white font-JakartaBold mb-4">Weekly Overview</Text>
                    <BarChart data={weeklyData} />
                </View>

                {/* Recent Trips */}
                <View className="mx-5">
                    <Text className="text-white font-JakartaBold mb-4">Recent Trips</Text>
                    {recentTrips.map(trip => (
                        <View key={trip.id} className="bg-gray-800 rounded-xl p-4 mb-3 flex-row justify-between items-center">
                            <View className="flex-1">
                                <Text className="text-white font-JakartaSemiBold">{trip.from} → {trip.to}</Text>
                                <Text className="text-gray-400 text-sm">{trip.time}</Text>
                            </View>
                            <Text className="text-green-400 font-JakartaBold text-lg">{trip.fare}</Text>
                        </View>
                    ))}
                </View>

                {/* Withdraw Button */}
                <TouchableOpacity className="mx-5 mt-6 bg-green-500 p-4 rounded-xl">
                    <Text className="text-white text-center font-JakartaBold text-lg">Withdraw to Bank</Text>
                </TouchableOpacity>

            </ScrollView>
        </SafeAreaView>
    );
};

export default DriverEarnings;
