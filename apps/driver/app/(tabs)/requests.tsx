import { View, Text, TouchableOpacity, ScrollView, RefreshControl, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useCallback, useEffect } from 'react';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { getAvailableBookings, subscribeToAvailableBookings, acceptBooking, Booking } from '@/lib/bookings';
import * as Location from 'expo-location';

const RideRequestCard = ({ request, onAccept, onReject }: { request: Booking, onAccept: (id: string) => void, onReject: (id: string) => void }) => (
    <View className="bg-gray-800 rounded-2xl p-4 mb-4">
        {/* Increased Fare Badge */}
        {((request.tip_amount && request.tip_amount > 0) || (request.fare_multiplier && request.fare_multiplier > 1)) && (
            <View className="bg-orange-500 px-3 py-1 rounded-full self-start mb-2 flex-row items-center">
                <Text className="text-white font-JakartaBold text-xs">🔥 Increased Fare</Text>
                {request.tip_amount && request.tip_amount > 0 && (
                    <Text className="text-white font-JakartaMedium text-xs ml-1">+₹{request.tip_amount} tip</Text>
                )}
            </View>
        )}
        
        <View className="flex-row justify-between items-start mb-4">
            <View className="flex-1">
                <Text className="text-gray-400 text-xs mb-1">PICKUP</Text>
                <Text className="text-white font-JakartaSemiBold text-base" numberOfLines={2}>
                    {request.origin_address}
                </Text>
            </View>
            <View className="bg-green-500/20 px-3 py-1 rounded-full ml-2">
                <Text className="text-green-400 font-JakartaBold">₹{request.driver_payout || request.total_fare}</Text>
            </View>
        </View>

        <View className="mb-4">
            <Text className="text-gray-400 text-xs mb-1">DROP-OFF</Text>
            <Text className="text-white font-JakartaSemiBold text-base" numberOfLines={2}>
                {request.destination_address}
            </Text>
        </View>

        <View className="flex-row gap-4 mb-4">
            <View className="flex-1 bg-gray-700/50 p-3 rounded-xl">
                <Text className="text-gray-400 text-xs">Distance</Text>
                <Text className="text-white font-JakartaSemiBold">
                    {request.estimated_distance ? `${request.estimated_distance.toFixed(1)} km` : '-'}
                </Text>
            </View>
            <View className="flex-1 bg-gray-700/50 p-3 rounded-xl">
                <Text className="text-gray-400 text-xs">Est. Time</Text>
                <Text className="text-white font-JakartaSemiBold">
                    {request.estimated_duration ? `${request.estimated_duration.toFixed(0)} min` : '-'}
                </Text>
            </View>
            <View className="flex-1 bg-gray-700/50 p-3 rounded-xl">
                <Text className="text-gray-400 text-xs">Payment</Text>
                <Text className="text-white font-JakartaSemiBold capitalize">{request.payment_method}</Text>
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
    const { driverProfile, profile } = useAuth();
    const [requests, setRequests] = useState<Booking[]>([]);
    const [refreshing, setRefreshing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [location, setLocation] = useState<{latitude: number, longitude: number} | null>(null);

    const fetchRequests = async () => {
        if (!location) return; // Wait for location
        
        const { data, error } = await getAvailableBookings(
            location.latitude,
            location.longitude,
            20 // 20km radius
        );
        
        if (error) {
            console.error("Error fetching requests:", error);
            // Don't show alert on auto-refresh to avoid annoyance
        } else {
            setRequests(data);
        }
        setLoading(false);
    };

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await fetchRequests();
        setRefreshing(false);
    }, [location]);

    // Initial load and subscription
    useEffect(() => {
        (async () => {
            // Get current location first
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission to access location was denied');
                setLoading(false);
                return;
            }

            let location = await Location.getCurrentPositionAsync({});
            setLocation({
                latitude: location.coords.latitude,
                longitude: location.coords.longitude
            });
        })();
    }, []);

    // Fetch requests when location is available
    useEffect(() => {
        if (location) {
            fetchRequests();

            // Subscribe to real-time updates
            const unsubscribe = subscribeToAvailableBookings(
                (newBooking) => {
                    setRequests(prev => [newBooking, ...prev]);
                },
                (removedBookingId) => {
                    setRequests(prev => prev.filter(b => b.id !== removedBookingId));
                }
            );

            return () => {
                unsubscribe();
            };
        }
    }, [location]);

    const handleAccept = async (id: string) => {
        if (!driverProfile?.id) {
            Alert.alert("Error", "Driver profile not found. Please log in again.");
            return;
        }

        const { success, error } = await acceptBooking(id, driverProfile.id);
        
        if (success) {
            Alert.alert("Success", "Booking accepted! Navigate to pickup location.");
            // Navigate to active ride screen
            router.push(`/(driver)/ride/${id}` as any);
        } else {
            Alert.alert("Error", error || "Failed to accept booking. It might have been taken.");
            // Refresh list
            fetchRequests();
        }
    };

    const handleReject = (id: string) => {
        // Just remove from local list for now
        setRequests(prev => prev.filter(r => r.id !== id));
    };

    if (loading && !requests.length) {
        return (
            <SafeAreaView className="flex-1 bg-gray-900 justify-center items-center">
                <ActivityIndicator size="large" color="#22c55e" />
                <Text className="text-white mt-4">Finding nearby requests...</Text>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-gray-900">
            <View className="p-5">
                <Text className="text-white text-2xl font-JakartaBold mb-2">Ride Requests</Text>
                <Text className="text-gray-400 mb-4">
                    {requests.length} {requests.length === 1 ? 'request' : 'requests'} available nearby
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
