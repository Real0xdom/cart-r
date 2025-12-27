import { View, Text, TouchableOpacity, ScrollView, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { icons } from '@/constants';

const DriverProfile = () => {
    const { profile, driverProfile, signOut } = useAuth();

    const menuItems = [
        { icon: '🚗', title: 'Vehicle Details', subtitle: 'Manage your vehicle info' },
        { icon: '📄', title: 'Documents', subtitle: 'License, RC, Insurance' },
        { icon: '💳', title: 'Bank Account', subtitle: 'Payout settings' },
        { icon: '⭐', title: 'Ratings & Reviews', subtitle: `${driverProfile?.rating || '4.8'} rating` },
        { icon: '🔔', title: 'Notifications', subtitle: 'Manage alerts' },
        { icon: '❓', title: 'Help & Support', subtitle: 'Get assistance' },
        { icon: '📜', title: 'Terms & Policies', subtitle: 'Legal information' },
    ];

    return (
        <SafeAreaView className="flex-1 bg-gray-900">
            <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 100 }}>
                {/* Profile Header */}
                <View className="items-center py-8 border-b border-gray-800">
                    <View className="w-24 h-24 bg-gray-700 rounded-full items-center justify-center mb-4">
                        <Text className="text-4xl">👤</Text>
                    </View>
                    <Text className="text-white text-2xl font-JakartaBold">{profile?.name || 'Driver'}</Text>
                    <Text className="text-gray-400">{profile?.phone || 'Phone not set'}</Text>

                    <View className="flex-row mt-4 gap-6">
                        <View className="items-center">
                            <Text className="text-white text-xl font-JakartaBold">127</Text>
                            <Text className="text-gray-400 text-sm">Trips</Text>
                        </View>
                        <View className="w-px bg-gray-700" />
                        <View className="items-center">
                            <Text className="text-white text-xl font-JakartaBold">4.8</Text>
                            <Text className="text-gray-400 text-sm">Rating</Text>
                        </View>
                        <View className="w-px bg-gray-700" />
                        <View className="items-center">
                            <Text className="text-white text-xl font-JakartaBold">2y</Text>
                            <Text className="text-gray-400 text-sm">Experience</Text>
                        </View>
                    </View>
                </View>

                {/* Menu Items */}
                <View className="p-5">
                    {menuItems.map((item, index) => (
                        <TouchableOpacity
                            key={index}
                            className="flex-row items-center py-4 border-b border-gray-800"
                        >
                            <View className="w-12 h-12 bg-gray-800 rounded-full items-center justify-center mr-4">
                                <Text className="text-2xl">{item.icon}</Text>
                            </View>
                            <View className="flex-1">
                                <Text className="text-white font-JakartaSemiBold">{item.title}</Text>
                                <Text className="text-gray-400 text-sm">{item.subtitle}</Text>
                            </View>
                            <Text className="text-gray-600 text-xl">›</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Logout Button */}
                <TouchableOpacity
                    onPress={signOut}
                    className="mx-5 mt-4 bg-red-500/20 p-4 rounded-xl"
                >
                    <Text className="text-red-400 text-center font-JakartaBold">Logout</Text>
                </TouchableOpacity>

                <Text className="text-gray-600 text-center mt-6 text-sm">Version 1.0.0</Text>

            </ScrollView>
        </SafeAreaView>
    );
};

export default DriverProfile;
