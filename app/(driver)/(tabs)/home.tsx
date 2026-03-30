import { View, Text, TouchableOpacity, ScrollView, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect } from 'react';

const DriverHome = () => {
    const { driverProfile, toggleDriverOnline, profile } = useAuth();
    const [isOnline, setIsOnline] = useState(driverProfile?.is_online || false);

    useEffect(() => {
        setIsOnline(driverProfile?.is_online || false);
    }, [driverProfile]);

    const handleToggleOnline = async (value: boolean) => {
        setIsOnline(value);
        await toggleDriverOnline(value);
    };

    return (
        <SafeAreaView className="flex-1 bg-gray-900">
            <ScrollView className="p-5" contentContainerStyle={{ paddingBottom: 100 }}>
                {/* Header */}
                <View className="flex-row justify-between items-center mb-6">
                    <View>
                        <Text className="text-gray-400 text-sm">Welcome back,</Text>
                        <Text className="text-white text-2xl font-JakartaBold">
                            {profile?.name || 'Driver'}
                        </Text>
                    </View>
                </View>

                {/* Online Status Card */}
                <View className="bg-gray-800 p-6 rounded-2xl mb-6">
                    <View className="flex-row justify-between items-center">
                        <View>
                            <Text className="text-gray-400 text-sm mb-1">Status</Text>
                            <Text className={`text-2xl font-JakartaBold ${isOnline ? 'text-green-400' : 'text-red-400'}`}>
                                {isOnline ? '🟢 Online' : '🔴 Offline'}
                            </Text>
                        </View>
                        <Switch
                            value={isOnline}
                            onValueChange={handleToggleOnline}
                            trackColor={{ false: '#374151', true: '#22c55e' }}
                            thumbColor={isOnline ? '#ffffff' : '#9ca3af'}
                        />
                    </View>
                    <Text className="text-gray-500 text-sm mt-3">
                        {isOnline ? 'You are visible to customers' : 'Go online to receive ride requests'}
                    </Text>
                </View>

                {/* Today's Stats */}
                <Text className="text-white text-xl font-JakartaBold mb-4">Today's Summary</Text>
                <View className="flex-row gap-3 mb-6">
                    <View className="flex-1 bg-blue-500/20 p-4 rounded-xl">
                        <Text className="text-blue-400 text-sm mb-1">Earnings</Text>
                        <Text className="text-white text-2xl font-JakartaBold">₹0</Text>
                    </View>
                    <View className="flex-1 bg-purple-500/20 p-4 rounded-xl">
                        <Text className="text-purple-400 text-sm mb-1">Trips</Text>
                        <Text className="text-white text-2xl font-JakartaBold">0</Text>
                    </View>
                    <View className="flex-1 bg-green-500/20 p-4 rounded-xl">
                        <Text className="text-green-400 text-sm mb-1">Hours</Text>
                        <Text className="text-white text-2xl font-JakartaBold">0h</Text>
                    </View>
                </View>

                {/* Quick Actions */}
                <Text className="text-white text-xl font-JakartaBold mb-4">Quick Actions</Text>
                <View className="gap-3">
                    <TouchableOpacity className="bg-gray-800 p-4 rounded-xl flex-row items-center">
                        <View className="w-12 h-12 bg-blue-500/20 rounded-full items-center justify-center mr-4">
                            <Text className="text-2xl">📍</Text>
                        </View>
                        <View className="flex-1">
                            <Text className="text-white font-JakartaSemiBold">Navigation</Text>
                            <Text className="text-gray-400 text-sm">Open Google Maps</Text>
                        </View>
                    </TouchableOpacity>

                    <TouchableOpacity className="bg-gray-800 p-4 rounded-xl flex-row items-center">
                        <View className="w-12 h-12 bg-green-500/20 rounded-full items-center justify-center mr-4">
                            <Text className="text-2xl">💰</Text>
                        </View>
                        <View className="flex-1">
                            <Text className="text-white font-JakartaSemiBold">Withdraw Earnings</Text>
                            <Text className="text-gray-400 text-sm">Transfer to bank account</Text>
                        </View>
                    </TouchableOpacity>

                    <TouchableOpacity className="bg-gray-800 p-4 rounded-xl flex-row items-center">
                        <View className="w-12 h-12 bg-orange-500/20 rounded-full items-center justify-center mr-4">
                            <Text className="text-2xl">📞</Text>
                        </View>
                        <View className="flex-1">
                            <Text className="text-white font-JakartaSemiBold">Support</Text>
                            <Text className="text-gray-400 text-sm">Get help from our team</Text>
                        </View>
                    </TouchableOpacity>
                </View>

            </ScrollView>
        </SafeAreaView>
    );
};

export default DriverHome;
