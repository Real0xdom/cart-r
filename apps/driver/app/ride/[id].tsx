// Active Ride Screen
// Driver's view during an active shipment - connected to Supabase

import { View, Text, TouchableOpacity, Linking, Platform, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useState, useEffect } from 'react';
import { Feather } from '@expo/vector-icons';
import { getBookingById, updateBookingStatus, subscribeToBooking, Booking } from '@/lib/bookings';

const ActiveRide = () => {
    const { id } = useLocalSearchParams<{ id: string }>();
    const [booking, setBooking] = useState<Booking | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isUpdating, setIsUpdating] = useState(false);

    // Fetch booking data
    useEffect(() => {
        if (!id) {
            router.back();
            return;
        }

        const fetchBooking = async () => {
            const { data, error } = await getBookingById(id);
            if (data) {
                setBooking(data);
            } else {
                Alert.alert('Error', 'Failed to load ride details');
                router.back();
            }
            setIsLoading(false);
        };

        fetchBooking();

        // Subscribe to real-time updates
        const unsubscribe = subscribeToBooking(id, (updatedBooking) => {
            setBooking(updatedBooking);
        });

        return () => unsubscribe();
    }, [id]);

    const openNavigation = () => {
        if (!booking) return;
        
        const isPickedUp = booking.status === 'in_progress';
        const lat = isPickedUp ? booking.destination_latitude : booking.origin_latitude;
        const lng = isPickedUp ? booking.destination_longitude : booking.origin_longitude;

        const url = Platform.select({
            ios: `maps://app?daddr=${lat},${lng}`,
            android: `google.navigation:q=${lat},${lng}`,
        });
        if (url) Linking.openURL(url);
    };

    const callCustomer = () => {
        const phone = booking?.customer?.phone || booking?.receiver_phone;
        if (phone) {
            Linking.openURL(`tel:${phone}`);
        }
    };

    const handleStatusUpdate = async () => {
        if (!booking || !id) return;

        const currentStatus = booking.status;

        // If arrived and about to start trip, navigate to OTP verification
        if (currentStatus === 'driver_arrived') {
            router.push({
                pathname: '/ride/verify-otp',
                params: { bookingId: id },
            });
            return;
        }

        setIsUpdating(true);

        try {
            let newStatus: Booking['status'];
            
            if (currentStatus === 'accepted') {
                newStatus = 'driver_arrived';
            } else if (currentStatus === 'in_progress') {
                // Navigate to payment collection
                router.push({
                    pathname: '/ride/collect-payment',
                    params: { bookingId: id },
                });
                setIsUpdating(false);
                return;
            } else {
                setIsUpdating(false);
                return;
            }

            const { success, error } = await updateBookingStatus(id, newStatus);

            if (!success) {
                Alert.alert('Error', error || 'Failed to update status');
            }
        } catch (err: any) {
            Alert.alert('Error', err.message || 'Something went wrong');
        }

        setIsUpdating(false);
    };

    const getButtonText = () => {
        switch (booking?.status) {
            case 'accepted': return 'Arrived at Pickup';
            case 'driver_arrived': return 'Verify OTP & Start';
            case 'in_progress': return 'Complete & Collect Payment';
            default: return 'Continue';
        }
    };

    const getStatusBadge = () => {
        switch (booking?.status) {
            case 'accepted': 
                return { text: '🚗 Head to pickup location', color: 'bg-blue-500/20', textColor: 'text-blue-400' };
            case 'driver_arrived': 
                return { text: '📍 Arrived - Verify OTP', color: 'bg-yellow-500/20', textColor: 'text-yellow-400' };
            case 'in_progress': 
                return { text: '🚚 Trip in progress', color: 'bg-green-500/20', textColor: 'text-green-400' };
            default: 
                return { text: 'Loading...', color: 'bg-gray-500/20', textColor: 'text-gray-400' };
        }
    };

    if (isLoading || !booking) {
        return (
            <SafeAreaView className="flex-1 bg-gray-900 items-center justify-center">
                <ActivityIndicator size="large" color="#22c55e" />
                <Text className="text-gray-400 mt-4">Loading ride details...</Text>
            </SafeAreaView>
        );
    }

    const status = getStatusBadge();
    const customerName = booking.customer?.name || 'Customer';
    const isInProgress = booking.status === 'in_progress';

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
                {/* Status Badge */}
                <View className="items-center mb-4">
                    <View className={`px-4 py-2 rounded-full ${status.color}`}>
                        <Text className={`font-JakartaSemiBold ${status.textColor}`}>
                            {status.text}
                        </Text>
                    </View>
                </View>

                {/* Customer/Receiver Info */}
                <View className="bg-gray-800 rounded-2xl p-4 mb-4">
                    <View className="flex-row justify-between items-center">
                        <View className="flex-row items-center">
                            <View className="w-12 h-12 bg-gray-700 rounded-full items-center justify-center mr-3">
                                <Feather name="user" size={24} color="#9ca3af" />
                            </View>
                            <View>
                                <Text className="text-white font-JakartaBold">
                                    {isInProgress ? (booking.receiver_name || 'Receiver') : customerName}
                                </Text>
                                <Text className="text-gray-400 text-sm">
                                    {isInProgress ? 'Receiver' : 'Customer'}
                                </Text>
                            </View>
                        </View>
                        <TouchableOpacity
                            onPress={callCustomer}
                            className="bg-green-500/20 w-12 h-12 rounded-full items-center justify-center"
                        >
                            <Feather name="phone" size={20} color="#22c55e" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Pickup OTP - shown when arrived */}
                {booking.status === 'driver_arrived' && booking.pickup_otp && (
                    <View className="bg-blue-500/10 rounded-xl p-4 mb-4">
                        <Text className="text-blue-400 text-sm font-JakartaMedium mb-1">
                            Ask customer for OTP to start trip
                        </Text>
                        <Text className="text-white text-xl font-JakartaBold">
                            Expected OTP: ****
                        </Text>
                    </View>
                )}

                {/* Ride Details */}
                <View className="bg-gray-800 rounded-2xl p-4 mb-4">
                    <View className="mb-3">
                        <Text className="text-gray-400 text-xs mb-1">
                            {isInProgress ? 'DROP-OFF' : 'PICKUP'}
                        </Text>
                        <Text className="text-white font-JakartaSemiBold" numberOfLines={2}>
                            {isInProgress ? booking.destination_address : booking.origin_address}
                        </Text>
                    </View>

                    {!isInProgress && (
                        <View className="mb-3">
                            <Text className="text-gray-400 text-xs mb-1">DROP-OFF</Text>
                            <Text className="text-white font-JakartaSemiBold" numberOfLines={2}>
                                {booking.destination_address}
                            </Text>
                        </View>
                    )}

                    {/* Receiver contact when in progress */}
                    {isInProgress && booking.receiver_phone && (
                        <View className="mb-3">
                            <Text className="text-gray-400 text-xs mb-1">RECEIVER PHONE</Text>
                            <Text className="text-white font-JakartaSemiBold">
                                +91 {booking.receiver_phone}
                            </Text>
                        </View>
                    )}

                    <View className="flex-row gap-4 mt-3 pt-3 border-t border-gray-700">
                        <View className="flex-1">
                            <Text className="text-gray-400 text-xs">Distance</Text>
                            <Text className="text-white font-JakartaSemiBold">
                                {booking.estimated_distance?.toFixed(1) || '0'} km
                            </Text>
                        </View>
                        <View className="flex-1">
                            <Text className="text-gray-400 text-xs">Est. Time</Text>
                            <Text className="text-white font-JakartaSemiBold">
                                {booking.estimated_duration?.toFixed(0) || '0'} min
                            </Text>
                        </View>
                        <View className="flex-1">
                            <Text className="text-gray-400 text-xs">Fare</Text>
                            <Text className="text-green-400 font-JakartaBold">
                                ₹{booking.driver_payout || booking.total_fare}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Action Buttons */}
                <View className="flex-row gap-3">
                    <TouchableOpacity
                        onPress={openNavigation}
                        className="flex-1 bg-blue-500 p-4 rounded-xl flex-row items-center justify-center"
                    >
                        <Feather name="navigation" size={18} color="#fff" />
                        <Text className="text-white ml-2 font-JakartaBold">Navigate</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={handleStatusUpdate}
                        disabled={isUpdating}
                        className="flex-1 bg-green-500 p-4 rounded-xl flex-row items-center justify-center"
                    >
                        {isUpdating ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <Text className="text-white text-center font-JakartaBold">
                                {getButtonText()}
                            </Text>
                        )}
                    </TouchableOpacity>
                </View>

                {/* Cancel Option - only before pickup */}
                {booking.status === 'accepted' && (
                    <TouchableOpacity
                        onPress={() => {
                            Alert.alert(
                                'Cancel Ride',
                                'Are you sure you want to cancel this ride?',
                                [
                                    { text: 'No', style: 'cancel' },
                                    {
                                        text: 'Yes, Cancel',
                                        style: 'destructive',
                                        onPress: async () => {
                                            await updateBookingStatus(id, 'cancelled', {
                                                cancelled_by: 'driver',
                                                cancellation_reason: 'Cancelled by driver',
                                            });
                                            router.replace('/(tabs)/home');
                                        },
                                    },
                                ]
                            );
                        }}
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
