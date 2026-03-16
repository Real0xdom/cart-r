// Active Ride Screen
// Driver's view during an active shipment - connected to Supabase

import { View, Text, TouchableOpacity, Linking, Platform, Alert, ActivityIndicator, ScrollView, AppState, AppStateStatus, Animated, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { useState, useEffect, useRef } from 'react';
import { Feather } from '@expo/vector-icons';
import MapView, { Marker, Polyline, AnimatedRegion } from 'react-native-maps';
import OlaMapViewDirections from '@/components/OlaMapViewDirections';
import * as Location from 'expo-location';
import { getBookingById, updateBookingStatus, subscribeToBooking, cancelBookingByDriver, Booking } from '@/lib/bookings';
import { getCurrentLocation, checkLocationServices } from '@/lib/location';
import { useAnimatedLocation } from '@/lib/mapAnimation';
import { useLanguage } from '@/contexts/LanguageContext';
import { icons, images } from '@/constants';

const olaMapsApiKey = process.env.EXPO_PUBLIC_OLA_MAPS_API_KEY;

const ActiveRide = () => {
    const { id } = useLocalSearchParams<{ id: string }>();
    const { t } = useLanguage();
    const [booking, setBooking] = useState<Booking | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isUpdating, setIsUpdating] = useState(false);
    const [driverLocation, setDriverLocation] = useState<{latitude: number, longitude: number} | null>(null);
    const [liveETA, setLiveETA] = useState<number | null>(null); // minutes
    const [liveDistance, setLiveDistance] = useState<number | null>(null); // km
    const [cachedRouteCoords, setCachedRouteCoords] = useState<Array<{latitude: number, longitude: number}>>([]);
    const [useDirectionsFallback, setUseDirectionsFallback] = useState(false);
    const [locationError, setLocationError] = useState<string | null>(null);
    const mapRef = useRef<MapView>(null);
    const appState = useRef(AppState.currentState);

    const { animatedCoordinate, heading } = useAnimatedLocation(driverLocation);

    // Get driver's current location with AppState management
    useEffect(() => {
        let subscription: Location.LocationSubscription | null = null;
        let isWatching = false;
        
        const startWatching = async () => {
            if (isWatching) return;

            try {
                // Check if services are enabled first
                const servicesEnabled = await checkLocationServices();
                if (!servicesEnabled) {
                    Alert.alert(
                        t('locationServicesDisabled') || 'Location Services Disabled',
                        t('enableLocationServices') || 'Please enable location services (GPS) to use the app properly.',
                        [{ text: t('ok') }]
                    );
                }

                // Check permissions first without triggering a dialog
                const { status: existingStatus } = await Location.getForegroundPermissionsAsync();
                
                // Only request if not determined or denied (though usually we shouldn't request in background)
                if (existingStatus !== 'granted') {
                    const { status } = await Location.requestForegroundPermissionsAsync();
                    if (status !== 'granted') return;
                }

                isWatching = true;

                // Get immediate location first
                const location = await getCurrentLocation();
                if (location) {
                    setDriverLocation({
                        latitude: location.coords.latitude,
                        longitude: location.coords.longitude
                    });
                    setLocationError(null);
                } else {
                    const errorMsg = t('enableLocationServices') || 'Current location is unavailable. Turn on device location services to show the route.';
                    setLocationError(errorMsg);
                    
                    if (!servicesEnabled) {
                        // Already showed alert above
                    } else {
                        Alert.alert(
                            t('locationServicesDisabled') || 'Location Services Disabled',
                            errorMsg,
                            [{ text: t('ok') }]
                        );
                    }
                }

                // Start watcher
                subscription = await Location.watchPositionAsync(
                    { accuracy: Location.Accuracy.High, distanceInterval: 10 },
                    (loc) => {
                        setDriverLocation({
                            latitude: loc.coords.latitude,
                            longitude: loc.coords.longitude
                        });
                        setLocationError(null);
                    }
                );
            } catch (e) {
                console.error('[ActiveRide] Location error:', e);
                const errorMsg = t('enableLocationServices') || 'Current location is unavailable. Turn on device location services to show the route.';
                setLocationError(errorMsg);
                
                Alert.alert(
                    t('locationServicesDisabled') || 'Location Services Disabled',
                    errorMsg,
                    [{ text: t('ok') }]
                );
                isWatching = false;
            }
        };

        const stopWatching = () => {
            if (subscription) {
                subscription.remove();
                subscription = null;
            }
            isWatching = false;
        };

        // Initial start if active
        if (AppState.currentState === 'active') {
            startWatching();
        }

        // Listen for AppState changes
        const subscriptionState = AppState.addEventListener('change', nextAppState => {
            if (
                appState.current.match(/inactive|background/) &&
                nextAppState === 'active'
            ) {
                // console.log('App has come to the foreground! checking location watcher...');
                // Don't restart aggressively, just ensure we are watching
                if (!isWatching) {
                     startWatching();
                }
            } else if (nextAppState.match(/inactive|background/)) {
                 // On Android, background service should handle this. 
                 // For now, we only stop if we want to save battery, but for a driver app we often want it running.
                 // However, let's keep the user's logic but make it robust.
                 // console.log('App going to background. Stopping location watcher (relying on background service).');
                 stopWatching();
            }

            appState.current = nextAppState;
        });

        return () => {
            stopWatching();
            subscriptionState.remove();
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
            
            // Customer cancelled the ride
            if (updatedBooking.status === 'cancelled') {
                Alert.alert(
                    'Ride Cancelled',
                    `The customer has cancelled this ride.\nReason: ${updatedBooking.cancellation_reason || 'No reason provided'}`,
                    [{
                        text: 'OK',
                        onPress: () => router.replace('/(tabs)/home')
                    }]
                );
                return;
            }
            
            setBooking(updatedBooking);
        });

        return () => unsubscribe();
    }, [id]);

    // Fit map to show route when booking and driver location are available
    useEffect(() => {
        if (booking && driverLocation && mapRef.current) {
            const isInProgress = booking.status === 'in_progress';
            
            const pointsToFit = [
                { latitude: driverLocation.latitude, longitude: driverLocation.longitude },
                { latitude: booking.origin_latitude, longitude: booking.origin_longitude },
                { latitude: booking.destination_latitude, longitude: booking.destination_longitude }
            ];
            
            mapRef.current.fitToCoordinates(pointsToFit, {
                edgePadding: { top: 100, right: 60, bottom: 350, left: 60 },
                animated: true
            });
        }
    }, [booking?.id, booking?.status, !!driverLocation]);

    useEffect(() => {
        if (!booking) return;

        // Force directions to recalculate when the ride phase switches from pickup to drop-off.
        setUseDirectionsFallback(false);
    }, [booking?.status, booking?.origin_latitude, booking?.origin_longitude, booking?.destination_latitude, booking?.destination_longitude]);

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

        // If in_progress and clicking the button, navigate to Arrived at Drop Location verification
        if (currentStatus === 'in_progress') {
            router.push({
                pathname: '/ride/verify-drop-otp',
                params: { bookingId: id },
            });
            setIsUpdating(false);
            return;
        }

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
            case 'in_progress': return 'Arrived at Drop Location';
            default: return 'Continue';
        }
    };

    const getStatusBadge = () => {
        switch (booking?.status) {
            case 'accepted': 
                return { text: 'Head to pickup location', color: 'bg-blue-500/20', textColor: 'text-blue-400' };
            case 'driver_arrived': 
                return { text: '📍 Arrived - Verify OTP', color: 'bg-yellow-500/20', textColor: 'text-yellow-400' };
            case 'in_progress': 
                return { text: '🚚 On the way to drop-off', color: 'bg-green-500/20', textColor: 'text-green-400' };
            default: 
                return { text: 'Loading...', color: 'bg-gray-500/20', textColor: 'text-gray-400' };
        }
    };

    if (isLoading || !booking) {
        return (
            <SafeAreaView className="flex-1 bg-white items-center justify-center">
                <ActivityIndicator size="large" color="#22c55e" />
                <Text className="text-gray-500 mt-4">Loading ride details...</Text>
            </SafeAreaView>
        );
    }

    const status = getStatusBadge();
    const customerName = booking.customer?.name || 'Customer';
    const isInProgress = booking.status === 'in_progress';
    const targetLat = isInProgress ? booking.destination_latitude : booking.origin_latitude;
    const targetLng = isInProgress ? booking.destination_longitude : booking.origin_longitude;
    const routeKey = `${booking.status}-${targetLat}-${targetLng}`;

    return (
        <SafeAreaView testID="driver.activeRide" accessibilityLabel="driver.activeRide" className="flex-1 bg-white">
            {/* Map View */}
            <View className="flex-1">
                {driverLocation ? (
                    <MapView
                        ref={mapRef}
                        style={{ flex: 1 }}
                        mapType="standard"
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
                        <Marker.Animated
                            coordinate={animatedCoordinate as any}
                            title="You"
                            anchor={{ x: 0.5, y: 0.5 }}
                            rotation={heading}
                            flat={true}
                        >
                            <Animated.View className="items-center justify-center">
                                <Image source={images.truckTransparent} style={{ width: 40, height: 40, resizeMode: 'contain', transform: [{ rotate: '-90deg' }] }} />
                            </Animated.View>
                        </Marker.Animated>

                        {/* Pickup marker */}
                        <Marker
                            coordinate={{
                                latitude: booking.origin_latitude,
                                longitude: booking.origin_longitude,
                            }}
                            title="Pickup"
                            anchor={{ x: 0.5, y: 0.5 }}
                        >
                            <Image source={icons.point} style={{ width: 30, height: 30, resizeMode: 'contain' }} />
                        </Marker>

                        {/* Dropoff marker */}
                        <Marker
                            coordinate={{
                                latitude: booking.destination_latitude,
                                longitude: booking.destination_longitude,
                            }}
                            title="Drop-off"
                            anchor={{ x: 0.5, y: 0.5 }}
                        >
                            <Image source={icons.pin} style={{ width: 36, height: 36, resizeMode: 'contain' }} />
                        </Marker>

                        {/* 1. Trip Route (Pickup -> Drop-off) - Always shown in background or foreground */}
                        {!useDirectionsFallback && (
                            <OlaMapViewDirections
                                key={`trip-route-${booking.id}`}
                                origin={{ latitude: booking.origin_latitude, longitude: booking.origin_longitude }}
                                destination={{ latitude: booking.destination_latitude, longitude: booking.destination_longitude }}
                                strokeColor={isInProgress ? "#ef4444" : "#94a3b8"}
                                strokeWidth={isInProgress ? 5 : 3}
                                lineDashPattern={isInProgress ? undefined : [5, 5]}
                            />
                        )}

                        {/* 2. Navigation Route (Driver -> Next Target) */}
                        {driverLocation && !useDirectionsFallback && (
                            <OlaMapViewDirections
                                key={`nav-route-${booking.status}-${driverLocation.latitude}-${driverLocation.longitude}`}
                                origin={driverLocation}
                                destination={{ latitude: targetLat, longitude: targetLng }}
                                strokeColor={isInProgress ? "#ef4444" : "#22c55e"}
                                strokeWidth={4}
                                onReady={(result) => {
                                    setLiveETA(Math.round(result.duration));
                                    setLiveDistance(Math.round(result.distance * 10) / 10);
                                    setCachedRouteCoords(result.coordinates);
                                    setUseDirectionsFallback(false);
                                }}
                                onError={(error) => {
                                    console.log('[ActiveRide] Directions API error, using cached route:', error);
                                    setUseDirectionsFallback(true);
                                }}
                            />
                        )}

                        {/* Fallback: cached route polyline when directions API unavailable (offline) */}
                        {useDirectionsFallback && cachedRouteCoords.length > 0 && (
                            <Polyline
                                coordinates={cachedRouteCoords}
                                strokeColor={isInProgress ? "#ef4444" : "#22c55e"}
                                strokeWidth={4}
                                lineDashPattern={[6, 3]}
                            />
                        )}

                        {/* Straight-line fallback when Directions API failed AND no cached route exists */}
                        {useDirectionsFallback && cachedRouteCoords.length === 0 && driverLocation && (
                            <Polyline
                                coordinates={[
                                    { latitude: driverLocation.latitude, longitude: driverLocation.longitude },
                                    { latitude: targetLat, longitude: targetLng },
                                ]}
                                strokeColor={isInProgress ? "#ef4444" : "#22c55e"}
                                strokeWidth={3}
                                lineDashPattern={[8, 6]}
                            />
                        )}
                    </MapView>
                ) : (
                    <View className="flex-1 bg-gray-100 items-center justify-center">
                        <ActivityIndicator size="large" color="#22c55e" />
                        <Text className="text-gray-500 mt-2">Getting location...</Text>
                        {locationError ? (
                            <Text className="text-center text-red-500 mt-3 px-8">
                                {locationError}
                            </Text>
                        ) : null}
                    </View>
                )}
            </View>

            {/* Bottom Sheet */}
            <View className="bg-white rounded-t-3xl -mt-8 max-h-[50%] border-t border-gray-200">
                <ScrollView 
                    className="p-5"
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 20 }}
                >
                    {/* Status Badge */}
                    <View className="items-center mb-4">
                        <View className={`px-4 py-2 rounded-full ${status.color} mb-2`}>
                            <Text className={`font-JakartaSemiBold ${status.textColor}`}>
                                {status.text}
                            </Text>
                        </View>
                        <View className="bg-gray-100 px-3 py-1 rounded-full border border-gray-200">
                            <Text className="text-xs font-JakartaBold text-gray-600">
                                Ride ID: #{id?.slice(-6).toUpperCase()}
                            </Text>
                        </View>
                    </View>

                    {/* Customer/Receiver Info */}
                    <View className="bg-gray-100 rounded-2xl p-4 mb-4 border border-gray-200">
                        <View className="flex-row justify-between items-center">
                            <View className="flex-row items-center">
                                <View className="w-12 h-12 bg-gray-200 rounded-full items-center justify-center mr-3">
                                    <Feather name="user" size={24} color="#6b7280" />
                                </View>
                                <View>
                                    <Text className="text-gray-900 font-JakartaBold">
                                        {isInProgress ? (booking.receiver_name || 'Receiver') : customerName}
                                    </Text>
                                    <Text className="text-gray-500 text-sm">
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
                        <View className="bg-blue-500/10 rounded-xl p-4 mb-4 border border-blue-200">
                            <Text className="text-blue-600 text-sm font-JakartaMedium mb-1">
                                Ask customer for 4-digit OTP to start trip
                            </Text>
                            <Text className="text-gray-900 text-xl font-JakartaBold">
                                OTP: ****
                            </Text>
                        </View>
                    )}

                    {/* Ride Details */}
                    <View className="bg-gray-100 rounded-2xl p-4 mb-4 border border-gray-200">
                        <View className="mb-3">
                            <Text className="text-gray-500 text-xs mb-1">
                                {isInProgress ? 'DROP-OFF' : 'PICKUP'}
                            </Text>
                            <Text className="text-gray-900 font-JakartaSemiBold" numberOfLines={2}>
                                {isInProgress ? booking.destination_address : booking.origin_address}
                            </Text>
                        </View>

                        {!isInProgress && (
                            <View className="mb-3">
                                <Text className="text-gray-500 text-xs mb-1">DROP-OFF</Text>
                                <Text className="text-gray-900 font-JakartaSemiBold" numberOfLines={2}>
                                    {booking.destination_address}
                                </Text>
                            </View>
                        )}

                        {/* Receiver contact when in progress */}
                        {isInProgress && booking.receiver_phone && (
                            <View className="mb-3">
                                <Text className="text-gray-500 text-xs mb-1">RECEIVER PHONE</Text>
                                <Text className="text-gray-900 font-JakartaSemiBold">
                                    +91 {booking.receiver_phone}
                                </Text>
                            </View>
                        )}

                        <View className="flex-row gap-4 mt-3 pt-3 border-t border-gray-200">
                            <View className="flex-1">
                                <Text className="text-gray-500 text-xs">Distance</Text>
                                <Text className="text-gray-900 font-JakartaSemiBold">
                                    {liveDistance ?? booking.estimated_distance?.toFixed(1) ?? '0'} km
                                </Text>
                            </View>
                            <View className="flex-1">
                                <Text className="text-gray-500 text-xs">ETA</Text>
                                <Text className="text-gray-900 font-JakartaSemiBold">
                                    {liveETA ?? booking.estimated_duration?.toFixed(0) ?? '0'} min
                                </Text>
                            </View>
                            <View className="flex-1">
                                <Text className="text-gray-500 text-xs">Fare</Text>
                                <Text className="text-green-600 font-JakartaBold">
                                    ₹{booking.total_fare}
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

                    {/* Cancel Option - before trip start */}
                    {(booking.status === 'accepted' || booking.status === 'driver_arrived') && (
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
                                                if (!booking.driver_id) {
                                                    Alert.alert('Error', 'Driver info missing');
                                                    return;
                                                }
                                                const { success, error } = await cancelBookingByDriver(id, booking.driver_id, 'Cancelled by driver');
                                                
                                                if (success) {
                                                    router.replace('/(tabs)/home');
                                                } else {
                                                    Alert.alert('Error', error || 'Failed to cancel ride');
                                                }
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

