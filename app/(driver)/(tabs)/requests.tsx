import { View, Text, TouchableOpacity, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useCallback } from 'react';
import { router } from 'expo-router';
import { supabase, Database } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

type Booking = Database['public']['Tables']['bookings']['Row'];

interface RideRequest extends Booking {
    estimated_distance_str?: string;
    estimated_duration_str?: string;
}

const RideRequestCard = ({ request, onAccept, onReject }: { request: RideRequest; onAccept: (id: string) => void; onReject: (id: string) => void }) => (
    <View className="bg-gray-800 rounded-2xl p-4 mb-4">
        <View className="flex-row justify-between items-start mb-4">
            <View className="flex-1">
                <Text className="text-gray-400 text-xs mb-1">PICKUP</Text>
                <Text className="text-white font-JakartaSemiBold text-base">{request.origin_address}</Text>
            </View>
            <View className="bg-green-500/20 px-3 py-1 rounded-full">
                <Text className="text-green-400 font-JakartaBold">₹{request.total_fare}</Text>
            </View>
        </View>

        <View className="mb-4">
            <Text className="text-gray-400 text-xs mb-1">DROP-OFF</Text>
            <Text className="text-white font-JakartaSemiBold text-base">{request.destination_address}</Text>
        </View>

        <View className="flex-row gap-4 mb-4">
            <View className="flex-1 bg-gray-700/50 p-3 rounded-xl">
                <Text className="text-gray-400 text-xs">Distance</Text>
                <Text className="text-white font-JakartaSemiBold">
                    {request.estimated_distance ? `${request.estimated_distance.toFixed(1)} km` : 'N/A'}
                </Text>
            </View>
            <View className="flex-1 bg-gray-700/50 p-3 rounded-xl">
                <Text className="text-gray-400 text-xs">Est. Time</Text>
                <Text className="text-white font-JakartaSemiBold">
                    {request.estimated_duration ? `${Math.round(request.estimated_duration / 60)} mins` : 'N/A'}
                </Text>
            </View>
            <View className="flex-1 bg-gray-700/50 p-3 rounded-xl">
                <Text className="text-gray-400 text-xs">Vehicle</Text>
                <Text className="text-white font-JakartaSemiBold capitalize">{request.vehicle_type}</Text>
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
    const [requests, setRequests] = useState<RideRequest[]>([]);
    const [refreshing, setRefreshing] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const { driverProfile } = useAuth();

    // Fetch initial pending bookings
    const fetchPendingBookings = useCallback(async () => {
        if (!driverProfile?.vehicle_type) return;

        try {
            const { data, error } = await supabase
                .from('bookings')
                .select('*')
                .eq('status', 'pending')
                .is('driver_id', null)
                .eq('vehicle_type', driverProfile.vehicle_type)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setRequests(data || []);
        } catch (error: any) {
            console.error('[fetchPendingBookings] Error:', error.message);
        } finally {
            setIsLoading(false);
            setRefreshing(false);
        }
    }, [driverProfile?.vehicle_type]);

    // Initial load
    useEffect(() => {
        fetchPendingBookings();
    }, [fetchPendingBookings]);

    // Real-time subscription for new bookings
    useEffect(() => {
        if (!driverProfile?.vehicle_type) return;

        const channel = supabase
            .channel('driver-available-bookings')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'bookings',
                },
                (payload) => {
                    const newBooking = payload.new as Booking;
                    // Filter: only pending, unassigned, matching vehicle type
                    if (
                        newBooking.status === 'pending' &&
                        !newBooking.driver_id &&
                        newBooking.vehicle_type === driverProfile.vehicle_type
                    ) {
                        setRequests((prev) => {
                            // Avoid duplicates
                            if (prev.some((r) => r.id === newBooking.id)) {
                                return prev;
                            }
                            return [newBooking, ...prev];
                        });
                    }
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'bookings',
                },
                (payload) => {
                    const updatedBooking = payload.new as Booking;
                    // Remove if no longer pending or has been assigned
                    if (updatedBooking.status !== 'pending' || updatedBooking.driver_id) {
                        setRequests((prev) => prev.filter((r) => r.id !== updatedBooking.id));
                    }
                }
            )
            .subscribe();

        return () => {
            channel.unsubscribe();
        };
    }, [driverProfile?.vehicle_type]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchPendingBookings();
    }, [fetchPendingBookings]);

    const handleAccept = async (id: string) => {
        try {
            const { error } = await supabase
                .from('bookings')
                .update({ 
                    driver_id: driverProfile?.user_id,
                    status: 'accepted'
                })
                .eq('id', id);

            if (error) throw error;

            // Remove from requests list
            setRequests((prev) => prev.filter((r) => r.id !== id));

            // Navigate to ride screen
            router.push(`/(driver)/ride/${id}` as any);
        } catch (error: any) {
            console.error('[handleAccept] Error:', error.message);
            alert('Failed to accept ride. Please try again.');
        }
    };

    const handleReject = async (id: string) => {
        try {
            // Mark as cancelled or just remove from list
            const { error } = await supabase
                .from('bookings')
                .update({ status: 'cancelled' })
                .eq('id', id);

            if (error) throw error;

            setRequests((prev) => prev.filter((r) => r.id !== id));
        } catch (error: any) {
            console.error('[handleReject] Error:', error.message);
        }
    };

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
                {isLoading ? (
                    <View className="flex-1 items-center justify-center py-20">
                        <Text className="text-6xl mb-4">⏳</Text>
                        <Text className="text-white text-xl font-JakartaBold mb-2">Loading...</Text>
                        <Text className="text-gray-400 text-center">Fetching available rides</Text>
                    </View>
                ) : requests.length > 0 ? (
                    requests.map((request) => (
                        <RideRequestCard
                            key={request.id}
                            request={request}
                            onAccept={handleAccept}
                            onReject={handleReject}
                        />
                    ))
                ) : (
                    <View className="flex-1 items-center justify-center py-20">
                        <Text className="text-6xl mb-4"></Text>
                        <Text className="text-white text-xl font-JakartaBold mb-2">No Requests</Text>
                        <Text className="text-gray-400 text-center">
                            New ride requests will appear here{'\n'}Make sure you're online and nearby!
                        </Text>
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
};

export default DriverRequests;
