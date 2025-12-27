import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { SafeAreaView } from 'react-native-safe-area-context';

// Note: In a real Expo Web setup, we'd add Platform checks or .web.tsx extensions
// But this works for basic structure

const AdminDashboard = () => {
    const { signOut } = useAuth();

    return (
        <SafeAreaView className="flex-1 bg-gray-50">
            <View className="flex-row items-center justify-between p-5 bg-white shadow-sm">
                <Text className="text-2xl font-JakartaBold text-primary-500">Admin Portal</Text>
                <TouchableOpacity onPress={signOut}>
                    <Text className="text-red-500 font-JakartaSemiBold">Logout</Text>
                </TouchableOpacity>
            </View>

            <ScrollView className="p-5">
                <View className="flex-row flex-wrap gap-4">
                    {/* Stats Cards */}
                    <View className="bg-white p-6 rounded-xl shadow-sm w-[300px]">
                        <Text className="text-gray-500 mb-2">Total Users</Text>
                        <Text className="text-3xl font-JakartaBold">1,234</Text>
                    </View>
                    <View className="bg-white p-6 rounded-xl shadow-sm w-[300px]">
                        <Text className="text-gray-500 mb-2">Active Drivers</Text>
                        <Text className="text-3xl font-JakartaBold">56</Text>
                    </View>
                    <View className="bg-white p-6 rounded-xl shadow-sm w-[300px]">
                        <Text className="text-gray-500 mb-2">Today's Revenue</Text>
                        <Text className="text-3xl font-JakartaBold">₹12,450</Text>
                    </View>
                </View>

                <View className="mt-8">
                    <Text className="text-xl font-JakartaBold mb-4">Verification Requests</Text>
                    <View className="bg-white rounded-xl shadow-sm p-4">
                        <Text className="text-gray-400 text-center py-10">No pending driver verifications</Text>
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

export default AdminDashboard;
