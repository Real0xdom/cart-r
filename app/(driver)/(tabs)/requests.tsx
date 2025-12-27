import { View, Text, TouchableOpacity, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useCallback } from 'react';
import { router } from 'expo-router';

// Mock data - replace with Supabase realtime subscription
const mockRequests = [
    {
        id: '1',
        pickup: 'Koramangala, Bangalore',
        dropoff: 'Whitefield, Bangalore',
        distance: '18.5 km',
        fare: '₹450',
        time: '35 mins',
        customerName: 'Rahul S.',
    },
    {
        id: '2',
        pickup: 'HSR Layout, Bangalore',
        dropoff: 'Electronic City, Bangalore',
        distance: '12.2 km',
        fare: '₹320',
        time: '25 mins',
        customerName: 'Priya M.',
    },
];

const RideRequestCard = ({ request, onAccept, onReject }: any) => (
    <View className="bg-gray-800 rounded-2xl p-4 mb-4">
        <View className="flex-row justify-between items-start mb-4">
            <View className="flex-1">
                <Text className="text-gray-400 text-xs mb-1">PICKUP</Text>
                <Text className="text-white font-JakartaSemiBold text-base">{request.pickup}</Text>
            </View>
            <View className="bg-green-500/20 px-3 py-1 rounded-full">
                <Text className="text-green-400 font-JakartaBold">{request.fare}</Text>
            </View>
        </View>

        <View className="mb-4">
            <Text className="text-gray-400 text-xs mb-1">DROP-OFF</Text>
            <Text className="text-white font-JakartaSemiBold text-base">{request.dropoff}</Text>
        </View>

        <View className="flex-row gap-4 mb-4">
            <View className="flex-1 bg-gray-700/50 p-3 rounded-xl">
                <Text className="text-gray-400 text-xs">Distance</Text>
                <Text className="text-white font-JakartaSemiBold">{request.distance}</Text>
            </View>
            <View className="flex-1 bg-gray-700/50 p-3 rounded-xl">
                <Text className="text-gray-400 text-xs">Est. Time</Text>
                <Text className="text-white font-JakartaSemiBold">{request.time}</Text>
            </View>
            <View className="flex-1 bg-gray-700/50 p-3 rounded-xl">
                <Text className="text-gray-400 text-xs">Customer</Text>
                <Text className="text-white font-JakartaSemiBold">{request.customerName}</Text>
            </View>
        </View>

        <View className="flex-row gap-3">
            <TouchableOpacity
                onPress={() => onReject(request.id)}
                className="flex-1 bg-red-500/20 p-4 rounded-xl"
            >
                <Text className="text-red-400 text-center font-JakartaBold">Decline</Text>
            </TouchableOpacity>
            <TouchableOpacity
                onPress={() => onAccept(request.id)}
                className="flex-1 bg-green-500 p-4 rounded-xl"
            >
                <Text className="text-white text-center font-JakartaBold">Accept</Text>
            </TouchableOpacity>
        </View>
    </View>
);

const DriverRequests = () => {
    const [requests, setRequests] = useState(mockRequests);
    const [refreshing, setRefreshing] = useState(false);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        // TODO: Fetch from Supabase
        setTimeout(() => {
            setRefreshing(false);
        }, 1000);
    }, []);

    const handleAccept = (id: string) => {
        // TODO: Update booking status in Supabase
        // Navigate to active ride screen
        router.push(`/(driver)/ride/${id}` as any);
    };

    const handleReject = (id: string) => {
        // TODO: Update booking status in Supabase
        setRequests(prev => prev.filter(r => r.id !== id));
    };

    return (
        <SafeAreaView className="flex-1 bg-gray-900">
            <View className="p-5">
                <Text className="text-white text-2xl font-JakartaBold mb-2">Ride Requests</Text>
                <Text className="text-gray-400 mb-4">
                    {requests.length} {requests.length === 1 ? 'request' : 'requests'} available
                </Text>
            </View>

            <ScrollView
                className="flex-1 px-5"
                contentContainerStyle={{ paddingBottom: 100 }}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />
                }
            >
                {requests.length > 0 ? (
                    requests.map(request => (
                        <RideRequestCard
                            key={request.id}
                            request={request}
                            onAccept={handleAccept}
                            onReject={handleReject}
                        />
                    ))
                ) : (
                    <View className="flex-1 items-center justify-center py-20">
                        <Text className="text-6xl mb-4">📭</Text>
                        <Text className="text-white text-xl font-JakartaBold mb-2">No Requests</Text>
                        <Text className="text-gray-400 text-center">
                            New ride requests will appear here.{'\n'}Make sure you're online!
                        </Text>
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
};

export default DriverRequests;
