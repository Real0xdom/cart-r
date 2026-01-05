// Active Ride Screen
// Driver's view during an active shipment - connected to Supabase

import { View, Text, TouchableOpacity, Linking, Platform, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useState, useEffect, useRef } from 'react';
import { Feather } from '@expo/vector-icons';
import MapView, { Marker, PROVIDER_GOOGLE, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import { getBookingById, updateBookingStatus, subscribeToBooking, Booking } from '@/lib/bookings';

const ActiveRide = () => {
    const { id } = useLocalSearchParams<{ id: string }>();
    const [booking, setBooking] = useState<Booking | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isUpdating, setIsUpdating] = useState(false);
    const [driverLocation, setDriverLocation] = useState<{latitude: number, longitude: number} | null>(null);
    const mapRef = useRef<MapView>(null);

    // Get driver's current location
    useEffect(() => {
        let subscription: Location.LocationSubscription | null = null;
        
        (async () => {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status === 'granted') {
                // Get initial location
                const location = await Location.getCurrentPositionAsync({});
                setDriverLocation({
                    latitude: location.coords.latitude,
                    longitude: location.coords.longitude
                });
                
                // Watch location updates
                subscription = await Location.watchPositionAsync(
                    { accuracy: Location.Accuracy.High, distanceInterval: 10 },
                    (location) => {
                        setDriverLocation({
                            latitude: location.coords.latitude,
                            longitude: location.coords.longitude
                        });
                    }
                );
            }
        })();
        
        return () => {
            subscription?.remove();
        };
    }, []);

    // Fetch booking data
    useEffect(() => {
        if (!id) {
            console.log('[ACTIVE RIDE] No booking ID provided');
            router.back();
            return;
        }

        console.log('[ACTIVE RIDE] Fetching booking details for ID:', id);

        const fetchBooking = async () => {
            const { data, error } = await getBookingById(id);
            
            console.log('[ACTIVE RIDE] getBookingById result:', {
                hasData: !!data,
                error: error,
                bookingId: id
            });
            
            if (data) {
                console.log('[ACTIVE RIDE] Booking loaded successfully:', JSON.stringify(data, null, 2));
                setBooking(data);
            } else {
                console.error('[ACTIVE RIDE] Failed to load booking:', error);
                Alert.alert('Error', `Failed to load ride details: ${error || 'Unknown error'}`);
                router.back();
            }
            setIsLoading(false);
        };

        fetchBooking();

        // Subscribe to real-time updates
        console.log('[ACTIVE RIDE] Subscribing to booking updates');
        const unsubscribe = subscribeToBooking(id, (updatedBooking) => {
            console.log('[ACTIVE RIDE] Received booking update:', updatedBooking.status);
            setBooking(updatedBooking);
        });

        return () => unsubscribe();
    }, [id]);

    // Fit map to show route when booking and driver location are available
    useEffect(() => {
        if (booking && driverLocation && mapRef.current) {
            const isInProgress = booking.status === 'in_progress';
            const targetLat = isInProgress ? booking.destination_latitude : booking.origin_latitude;
            const targetLng = isInProgress ? booking.destination_longitude : booking.origin_longitude;
            
            mapRef.current.fitToCoordinates([
                { latitude: driverLocation.latitude, longitude: driverLocation.longitude },
                { latitude: targetLat, longitude: targetLng }
            ], {
                edgePadding: { top: 80, right: 50, bottom: 250, left: 50 },
                animated: true
            });
        }
    }, [booking, driverLocation]);

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
    const targetLat = isInProgress ? booking.destination_latitude : booking.origin_latitude;
    const targetLng = isInProgress ? booking.destination_longitude : booking.origin_longitude;

    return (
        <SafeAreaView className="flex-1 bg-gray-900">
            {/* Map View */}
            <View className="flex-1">
                {driverLocation ? (
                    <MapView
                        ref={mapRef}
                        style={{ flex: 1 }}
                        provider={PROVIDER_GOOGLE}
                        initialRegion={{
                            latitude: driverLocation.latitude,
                            longitude: driverLocation.longitude,
                            latitudeDelta: 0.05,
                            longitudeDelta: 0.05,
                        }}
                        showsUserLocation={false}
                        showsMyLocationButton={false}
                    >
                        {/* Driver marker */}
                        <Marker
                            coordinate={driverLocation}
                            title="You"
                            anchor={{ x: 0.5, y: 0.5 }}
                        >
                            <View className="bg-blue-500 p-2 rounded-full border-2 border-white">
                                <Text className="text-lg">🚗</Text>
                            </View>
                        </Marker>

                        {/* Pickup marker */}
                        <Marker
                            coordinate={{
                                latitude: booking.origin_latitude,
                                longitude: booking.origin_longitude,
                            }}
                            title="Pickup"
                            pinColor={isInProgress ? "gray" : "green"}
                        />

                        {/* Dropoff marker */}
                        <Marker
                            coordinate={{
                                latitude: booking.destination_latitude,
                                longitude: booking.destination_longitude,
                            }}
                            title="Drop-off"
                            pinColor={isInProgress ? "red" : "blue"}
                        />

                        {/* Route line from driver to target */}
                        <Polyline
                            coordinates={[
                                driverLocation,
                                { latitude: targetLat, longitude: targetLng }
                            ]}
                            strokeColor={isInProgress ? "#ef4444" : "#22c55e"}
                            strokeWidth={4}
                            lineDashPattern={[10, 5]}
                        />
                    </MapView>
                ) : (
                    <View className="flex-1 bg-gray-800 items-center justify-center">
                        <ActivityIndicator size="large" color="#22c55e" />
                        <Text className="text-gray-400 mt-2">Getting location...</Text>
                    </View>
                )}
            </View>

            {/* Bottom Sheet */}
            <View className="bg-gray-900 rounded-t-3xl -mt-8 max-h-[50%]">
                <ScrollView 
                    className="p-5"
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 20 }}
                >
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
                </ScrollView>
            </View>
        </SafeAreaView>
    );
};

export default ActiveRide;
