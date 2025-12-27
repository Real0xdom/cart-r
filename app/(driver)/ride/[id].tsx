import { View, Text, TouchableOpacity, Linking, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useState } from 'react';

// Mock ride data - replace with Supabase fetch
const mockRideData = {
    id: '1',
    status: 'accepted', // accepted, picked_up, in_progress, completed
    customer: {
        name: 'Rahul Sharma',
        phone: '+91 98765 43210',
        rating: 4.7,
    },
    pickup: {
        address: 'Koramangala 4th Block, Bangalore',
        lat: 12.9352,
        lng: 77.6245,
    },
    dropoff: {
        address: 'Whitefield Main Road, Bangalore',
        lat: 12.9698,
        lng: 77.7500,
    },
    fare: '₹450',
    distance: '18.5 km',
    estimatedTime: '35 mins',
};

const ActiveRide = () => {
    const { id } = useLocalSearchParams();
    const [ride, setRide] = useState(mockRideData);
    const [status, setStatus] = useState<'accepted' | 'arrived' | 'picked_up' | 'completed'>('accepted');

    const openNavigation = () => {
        const destination = status === 'picked_up' ? ride.dropoff : ride.pickup;
        const url = Platform.select({
            ios: `maps://app?daddr=${destination.lat},${destination.lng}`,
            android: `google.navigation:q=${destination.lat},${destination.lng}`,
        });
        if (url) Linking.openURL(url);
    };

    const callCustomer = () => {
        Linking.openURL(`tel:${ride.customer.phone}`);
    };

    const updateStatus = () => {
        if (status === 'accepted') {
            setStatus('arrived');
        } else if (status === 'arrived') {
            setStatus('picked_up');
        } else if (status === 'picked_up') {
            setStatus('completed');
            // TODO: Navigate to rating screen or back to home
            router.replace('/(driver)/home' as any);
        }
    };

    const getButtonText = () => {
        switch (status) {
            case 'accepted': return 'Arrived at Pickup';
            case 'arrived': return 'Start Trip';
            case 'picked_up': return 'Complete Trip';
            default: return 'Continue';
        }
    };

    const getStatusText = () => {
        switch (status) {
            case 'accepted': return 'Head to pickup location';
            case 'arrived': return 'Waiting for customer';
            case 'picked_up': return 'Trip in progress';
            default: return '';
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-gray-900">
            {/* Map Placeholder */}
            <View className="flex-1 bg-gray-800 items-center justify-center">
                <Text className="text-4xl mb-2">🗺️</Text>
                <Text className="text-gray-400">Map View</Text>
                <Text className="text-gray-500 text-sm">(Integrate MapView here)</Text>
            </View>

            {/* Bottom Sheet */}
            <View className="bg-gray-900 rounded-t-3xl p-5 -mt-8">
                {/* Status */}
                <View className="items-center mb-4">
                    <View className={`px-4 py-2 rounded-full ${status === 'picked_up' ? 'bg-green-500/20' : 'bg-blue-500/20'
                        }`}>
                        <Text className={`font-JakartaSemiBold ${status === 'picked_up' ? 'text-green-400' : 'text-blue-400'
                            }`}>
                            {getStatusText()}
                        </Text>
                    </View>
                </View>

                {/* Customer Info */}
                <View className="bg-gray-800 rounded-2xl p-4 mb-4">
                    <View className="flex-row justify-between items-center">
                        <View className="flex-row items-center">
                            <View className="w-12 h-12 bg-gray-700 rounded-full items-center justify-center mr-3">
                                <Text className="text-2xl">👤</Text>
                            </View>
                            <View>
                                <Text className="text-white font-JakartaBold">{ride.customer.name}</Text>
                                <Text className="text-gray-400 text-sm">⭐ {ride.customer.rating}</Text>
                            </View>
                        </View>
                        <TouchableOpacity
                            onPress={callCustomer}
                            className="bg-green-500/20 w-12 h-12 rounded-full items-center justify-center"
                        >
                            <Text className="text-2xl">📞</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Ride Details */}
                <View className="bg-gray-800 rounded-2xl p-4 mb-4">
                    <View className="mb-3">
                        <Text className="text-gray-400 text-xs mb-1">
                            {status === 'picked_up' ? 'DROP-OFF' : 'PICKUP'}
                        </Text>
                        <Text className="text-white font-JakartaSemiBold">
                            {status === 'picked_up' ? ride.dropoff.address : ride.pickup.address}
                        </Text>
                    </View>

                    {status !== 'picked_up' && (
                        <View>
                            <Text className="text-gray-400 text-xs mb-1">DROP-OFF</Text>
                            <Text className="text-white font-JakartaSemiBold">{ride.dropoff.address}</Text>
                        </View>
                    )}

                    <View className="flex-row gap-4 mt-4 pt-4 border-t border-gray-700">
                        <View className="flex-1">
                            <Text className="text-gray-400 text-xs">Distance</Text>
                            <Text className="text-white font-JakartaSemiBold">{ride.distance}</Text>
                        </View>
                        <View className="flex-1">
                            <Text className="text-gray-400 text-xs">Est. Time</Text>
                            <Text className="text-white font-JakartaSemiBold">{ride.estimatedTime}</Text>
                        </View>
                        <View className="flex-1">
                            <Text className="text-gray-400 text-xs">Fare</Text>
                            <Text className="text-green-400 font-JakartaBold">{ride.fare}</Text>
                        </View>
                    </View>
                </View>

                {/* Action Buttons */}
                <View className="flex-row gap-3">
                    <TouchableOpacity
                        onPress={openNavigation}
                        className="flex-1 bg-blue-500 p-4 rounded-xl flex-row items-center justify-center"
                    >
                        <Text className="text-white mr-2">📍</Text>
                        <Text className="text-white font-JakartaBold">Navigate</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={updateStatus}
                        className="flex-1 bg-green-500 p-4 rounded-xl"
                    >
                        <Text className="text-white text-center font-JakartaBold">{getButtonText()}</Text>
                    </TouchableOpacity>
                </View>

                {/* Cancel Option */}
                {status === 'accepted' && (
                    <TouchableOpacity
                        onPress={() => router.back()}
                        className="mt-4"
                    >
                        <Text className="text-red-400 text-center">Cancel Ride</Text>
                    </TouchableOpacity>
                )}
            </View>
        </SafeAreaView>
    );
};

export default ActiveRide;
