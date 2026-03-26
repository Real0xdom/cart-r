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
    addon_charges?: number | null;
    booking_addons?: Array<{
        quantity: number;
        unit_price: number;
        total_price?: number | null;
        addon_services?: {
            name?: string | null;
            code?: string | null;
            price?: number | null;
        } | null;
    }>;
}

const RideRequestCard = ({ request, onAccept, onReject }: { request: RideRequest; onAccept: (id: string) => void; onReject: (id: string) => void }) => (
    <View className="bg-gray-800 rounded-2xl p-4 mb-4">
        {request.booking_addons && request.booking_addons.length > 0 && (
            <View className="bg-amber-500/15 border border-amber-400/30 rounded-xl p-3 mb-4">
                <Text className="text-amber-300 font-JakartaBold mb-2">Add-on Services</Text>
                {request.booking_addons.map((addon, index) => (
                    <View
                        key={`${request.id}-addon-${index}`}
                        className={`flex-row justify-between items-center ${index > 0 ? 'mt-2 pt-2 border-t border-amber-400/20' : ''}`}
                    >
                        <Text className="text-white flex-1 mr-3">
                            {addon.addon_services?.name || 'Add-on'}
                            {addon.quantity > 1 ? ` x${addon.quantity}` : ''}
                        </Text>
                        <Text className="text-amber-300 font-JakartaBold">
                            ₹{Math.round(Number(addon.total_price ?? ((addon.unit_price || 0) * (addon.quantity || 1))))}
                        </Text>
                    </View>
                ))}
                {request.addon_charges && request.addon_charges > 0 && (
                    <Text className="text-amber-200 mt-3 font-JakartaSemiBold">
                        Total add-ons: ₹{Math.round(Number(request.addon_charges))}
                    </Text>
                )}
            </View>
        )}

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

    const fetchBookingWithAddons = useCallback(async (bookingId: string): Promise<RideRequest | null> => {
        try {
            const { data, error } = await supabase
                .from('bookings')
                .select(`
                    *,
                    booking_addons(
                        quantity,
                        unit_price,
                        total_price,
                        addon_services(name, code, price)
                    )
                `)
                .eq('id', bookingId)
                .single();

            if (error) throw error;
            return (data as RideRequest) || null;
        } catch (error: any) {
            console.error('[fetchBookingWithAddons] Error:', error.message);
            return null;
        }
    }, []);

    // Fetch initial pending bookings
    const fetchPendingBookings = useCallback(async () => {
        if (!driverProfile?.vehicle_type) return;

        try {
            const { data, error } = await supabase
                .from('bookings')
                .select(`
                    *,
                    booking_addons(
                        quantity,
                        unit_price,
                        total_price,
                        addon_services(name, code, price)
                    )
                `)
                .eq('status', 'pending')
                .is('driver_id', null)
                .eq('vehicle_type', driverProfile.vehicle_type)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setRequests((data as RideRequest[]) || []);
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
                async (payload) => {
                    const newBooking = payload.new as Booking;
                    // Filter: only pending, unassigned, matching vehicle type
                    if (
                        newBooking.status === 'pending' &&
                        !newBooking.driver_id &&
                        newBooking.vehicle_type === driverProfile.vehicle_type
                    ) {
                        const fullBooking = await fetchBookingWithAddons(newBooking.id);
                        const bookingToAdd = fullBooking || (newBooking as RideRequest);
                        setRequests((prev) => {
                            // Avoid duplicates
                            if (prev.some((r) => r.id === newBooking.id)) {
                                return prev;
                            }
                            return [bookingToAdd, ...prev];
                        });

                        // Add-ons are often inserted just after the booking row
                        // itself, so retry shortly to refresh the card.
                        setTimeout(async () => {
                            const refreshed = await fetchBookingWithAddons(newBooking.id);
                            if (!refreshed) return;
                            setRequests((prev) => prev.map((r) => (r.id === refreshed.id ? refreshed : r)));
                        }, 1200);
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
                async (payload) => {
                    const updatedBooking = payload.new as Booking;
                    // Remove if no longer pending or has been assigned
                    if (updatedBooking.status !== 'pending' || updatedBooking.driver_id) {
                        setRequests((prev) => prev.filter((r) => r.id !== updatedBooking.id));
                    } else {
                        const fullBooking = await fetchBookingWithAddons(updatedBooking.id);
                        if (!fullBooking) return;
                        setRequests((prev) => prev.map((r) => (r.id === fullBooking.id ? fullBooking : r)));
                    }
                }
            )
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'booking_addons',
                },
                async (payload) => {
                    const bookingId = (payload.new as any)?.booking_id ?? (payload.old as any)?.booking_id;
                    if (!bookingId) return;

                    const fullBooking = await fetchBookingWithAddons(String(bookingId));
                    if (!fullBooking) return;

                    if (
                        fullBooking.status === 'pending' &&
                        !fullBooking.driver_id &&
                        fullBooking.vehicle_type === driverProfile.vehicle_type
                    ) {
                        setRequests((prev) => {
                            const exists = prev.some((r) => r.id === fullBooking.id);
                            if (!exists) return [fullBooking, ...prev];
                            return prev.map((r) => (r.id === fullBooking.id ? fullBooking : r));
                        });
                    }
                }
            )
            .subscribe();

        return () => {
            channel.unsubscribe();
        };
    }, [driverProfile?.vehicle_type, fetchBookingWithAddons]);

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
