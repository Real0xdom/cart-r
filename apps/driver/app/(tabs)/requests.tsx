import { View, Text, TouchableOpacity, ScrollView, RefreshControl, Alert, ActivityIndicator, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useCallback, useEffect, useRef } from 'react';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { getAvailableBookings, subscribeToAvailableBookings, acceptBooking, declineBooking, getDriverActiveBookings, getDriverCompletedTrips, getDriverAllBookings, Booking, getDriverSearchRadius } from '@/lib/bookings';
import { checkDriverWalletEligibility, getDriverWalletRechargeNavigationTarget } from '@/lib/wallet';
import * as Location from 'expo-location';
import { checkLocationServices } from '@/lib/location';
import { Ionicons } from '@expo/vector-icons';
import { refreshLocationTrackingNotification } from '@/lib/location';
import RideRequestCard from '@/components/RideRequestCard';

const ActiveRideCard = ({ booking }: { booking: Booking }) => {
    const { t } = useLanguage();
    
    const getStatusText = (status: Booking['status']) => {
        switch (status) {
            case 'accepted': return t('headToPickup') || 'Head to pickup';
            case 'driver_arrived': return t('verifyOtp') || 'Verify OTP';
            case 'in_progress': return t('tripInProgress') || 'Trip in progress';
            default: return String(status);
        }
    };
    
    return (
        <TouchableOpacity
            onPress={() => router.push(`/ride/${booking.id}`)}
            className="bg-blue-50/50 rounded-2xl p-4 mb-4 border border-blue-200 shadow-sm"
        >
            <View className="mb-3">
                <View className="self-start px-3 py-1 rounded-full bg-blue-500">
                    <Text className="text-xs font-JakartaBold text-white">
                        Active Ride: {getStatusText(booking.status)}
                    </Text>
                </View>
            </View>
            <View className="flex-row justify-between items-start mb-2">
                <View className="flex-1 pr-4">
                    <Text className="text-gray-500 text-xs mb-1">
                        {booking.status === 'in_progress' ? 'DROP-OFF' : 'PICKUP'}
                    </Text>
                    <Text className="text-gray-900 font-JakartaSemiBold text-base" numberOfLines={2}>
                        {booking.status === 'in_progress' ? booking.destination_address : booking.origin_address}
                    </Text>
                </View>
                <View className="bg-green-100 px-3 py-1 rounded-full items-center justify-center">
                    <Text className="text-green-700 font-JakartaBold">₹{booking.total_fare}</Text>
                </View>
            </View>
            <Text className="text-blue-600 font-JakartaMedium text-sm mt-2 text-center">Tap to view navigation</Text>
        </TouchableOpacity>
    );
};

const QueuedRideCard = ({ booking }: { booking: Booking }) => {
    return (
        <View className="bg-amber-50 rounded-2xl p-4 mb-4 border border-amber-200 shadow-sm">
            <View className="mb-3">
                <View className="self-start px-3 py-1 rounded-full bg-amber-500">
                    <Text className="text-xs font-JakartaBold text-white">
                        Next Ride Queued
                    </Text>
                </View>
            </View>
            <View className="flex-row justify-between items-start mb-2">
                <View className="flex-1 pr-4">
                    <Text className="text-gray-500 text-xs mb-1">NEXT DROP-OFF</Text>
                    <Text className="text-gray-900 font-JakartaSemiBold text-base" numberOfLines={2}>
                        {booking.destination_address}
                    </Text>
                    <Text className="text-amber-700 font-JakartaMedium text-sm mt-2">
                        {booking.customer?.name || 'Customer'} is waiting for you next
                    </Text>
                </View>
                <View className="bg-amber-100 px-3 py-1 rounded-full items-center justify-center">
                    <Text className="text-amber-700 font-JakartaBold">₹{booking.total_fare}</Text>
                </View>
            </View>
            <Text className="text-amber-700 font-JakartaMedium text-sm mt-2 text-center">
                Finish your current ride to activate this trip
            </Text>
        </View>
    );
};

/**
 * History ride card for completed trips
 */
const HistoryRideCard = ({ booking }: { booking: Booking }) => {
    const { t } = useLanguage();
    
    const formatTimeAgo = (dateString: string | null) => {
        if (!dateString) return 'Unknown';
        const now = new Date();
        const completed = new Date(dateString);
        const diffMs = now.getTime() - completed.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);
        
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        return `${diffDays}d ago`;
    };
    
    const getTripEarning = () => {
        if (booking.driver_payout && booking.driver_payout < booking.total_fare) {
            return Math.round(Number(booking.driver_payout));
        }
        return Math.round(booking.total_fare * 0.85);
    };

    const payout = getTripEarning();

    return (
        <View className="bg-green-50/50 rounded-2xl p-4 mb-4 border border-green-200 shadow-sm">
            <View className="mb-3">
                <View className="self-start px-3 py-1 rounded-full bg-green-500">
                    <Text className="text-xs font-JakartaBold text-white">
                        Completed {formatTimeAgo(booking.completed_at || null)}
                    </Text>
                </View>
            </View>
            <View className="flex-row justify-between items-start mb-2">
                <View className="flex-1 pr-4">
                    <Text className="text-gray-500 text-xs mb-1">PICKUP → DROP-OFF</Text>
                    <Text className="text-gray-900 font-JakartaSemiBold text-base" numberOfLines={1}>
                        {booking.origin_address} → {booking.destination_address}
                    </Text>
                </View>
                <View className="bg-emerald-100 px-3 py-1 rounded-full items-center justify-center">
                    <Text className="text-emerald-700 font-JakartaBold">
                        ₹{payout}
                    </Text>
                    <Text className="text-emerald-700 text-[10px] text-center mt-0.5 opacity-80 font-JakartaMedium">
                        Fare: ₹{booking.total_fare}
                    </Text>
                </View>
            </View>
            <View className="flex-row gap-2 mt-2">
                <View className="flex-1 bg-gray-50 p-2 rounded-lg">
                    <Text className="text-xs text-gray-500">Distance</Text>
                    <Text className="font-JakartaSemiBold text-sm">
                        {booking.estimated_distance?.toFixed(1)} km
                    </Text>
                </View>
                <View className="flex-1 bg-gray-50 p-2 rounded-lg">
                    <Text className="text-xs text-gray-500">Payment</Text>
                    <Text className="font-JakartaSemiBold text-sm capitalize">{booking.payment_method}</Text>
                </View>
            </View>
        </View>
    );
};

const DriverRequests = () => {
    const { driverProfile, profile } = useAuth();
    const { t } = useLanguage();
    const [allRides, setAllRides] = useState<Booking[]>([]);
    const [refreshing, setRefreshing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [location, setLocation] = useState<{latitude: number, longitude: number} | null>(null);
    const pulseAnim = useRef(new Animated.Value(0.4)).current;

    // Subtle pulse animation for the background-loading banner
    useEffect(() => {
        if (!loading) return;
        const pulse = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
                Animated.timing(pulseAnim, { toValue: 0.4, duration: 800, useNativeDriver: true }),
            ])
        );
        pulse.start();
        return () => pulse.stop();
    }, [loading]);

    // Fetch ALL rides: past, current, and available requests in a single list
    const fetchAllRides = async () => {
        console.log('[ALL RIDES] Fetching all rides...');
        
        if (!driverProfile?.id) {
            console.log('[ALL RIDES] Missing driver profile, skipping fetch');
            setLoading(false);
            return;
        }
        
        try {
            let availableBookings: Booking[] = [];
            if (location && driverProfile.vehicle_type) {
                // Fetch admin-configured search radius for this vehicle type
                const searchRadiusKm = await getDriverSearchRadius(driverProfile.vehicle_type);
                const { data } = await getAvailableBookings(
                    location.latitude,
                    location.longitude,
                    driverProfile.vehicle_type,
                    searchRadiusKm
                );
                availableBookings = data || [];
            }
            
            // Fetch driver rides (ongoing + completed, prioritized)
            const { data: driverRides, error } = await getDriverAllBookings(driverProfile.id, 50);
            if (error) throw new Error(error);
            
            // Combine: pending + driver rides (ongoing first, then completed)
            const combined = [
                ...availableBookings,
                ...driverRides
            ];
            
            // Sort by created_at DESC (recent first, ongoing already prioritized by query)
            combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            
            console.log('[ALL RIDES] Total:', combined.length, 
                'Pending:', availableBookings.length,
                'Driver rides:', driverRides.length);
            setAllRides(combined);
        } catch (error) {
            console.error('[ALL RIDES] Error:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await fetchAllRides();
        setRefreshing(false);
    }, [location]);

    // Initial load and subscription
    useEffect(() => {
        (async () => {
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

                // Get current location first
                let { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted') {
                    Alert.alert(t('permissionLocationDenied') || 'Permission to access location was denied');
                    setLoading(false);
                    return;
                }

                let location = await Location.getCurrentPositionAsync({});
                setLocation({
                    latitude: location.coords.latitude,
                    longitude: location.coords.longitude
                });
            } catch (error) {
                console.error('[REQUESTS] Location error:', error);
                const message = error instanceof Error ? error.message : String(error);
                if (message.includes('Location services are disabled') || message.includes('Current location is unavailable')) {
                    Alert.alert(
                        t('locationServicesDisabled') || 'Location Services Disabled',
                        t('enableLocationServices') || 'Please enable location services (GPS) to use the app properly.',
                        [{ text: t('ok') }]
                    );
                }
                setLoading(false);
            }
        })();
    }, []);

    // Fetch all rides when location and driver profile are available
    useEffect(() => {
        if (location && driverProfile?.vehicle_type) {
            // Initial fetch
            fetchAllRides();

            // Subscribe to real-time updates - filtered by vehicle type
            const unsubscribe = subscribeToAvailableBookings(
                driverProfile.vehicle_type,
                (newBooking: Booking) => {
                    console.log('[SUBSCRIPTION] INSERT - new booking:', newBooking.id, 'expires_at:', newBooking.expires_at);
                    // Add to the TOP of the list (prepend)
                    setAllRides(prev => {
                        // Avoid duplicates
                        if (prev.some(b => b.id === newBooking.id)) {
                            return prev;
                        }
                        return [newBooking, ...prev];
                    });
                },
                (removedBookingId: string) => {
                    console.log('[SUBSCRIPTION] DELETE - removing booking:', removedBookingId);
                    setAllRides(prev => prev.filter(b => b.id !== removedBookingId));
                },
                (updatedBooking: Booking) => {
                    console.log('[SUBSCRIPTION] UPDATE - booking updated:', updatedBooking.id);
                    setAllRides(prev => {
                        const idx = prev.findIndex(b => b.id === updatedBooking.id);
                        if (idx >= 0) {
                            const next = [...prev];
                            next[idx] = { ...next[idx], ...updatedBooking };
                            return next;
                        }
                        return [updatedBooking, ...prev];
                    });
                }
            );

            return () => {
                unsubscribe();
            };
        }
    }, [location, driverProfile?.vehicle_type]);

    const handleAccept = async (id: string) => {
        console.log('========================================');
        console.log('[HANDLE ACCEPT] Booking ID:', id);
        console.log('[HANDLE ACCEPT] Driver profile:', driverProfile?.id);
        console.log('========================================');
        
        if (!driverProfile?.id) {
            console.error('[HANDLE ACCEPT] No driver profile found');
            Alert.alert(t("error"), t("driverProfileNotFound"));
            return;
        }

        const openRechargeFlow = () => {
            router.push(getDriverWalletRechargeNavigationTarget() as any);
        };

        try {
            const eligibility = await checkDriverWalletEligibility(driverProfile.id);
            console.log('[HANDLE ACCEPT] Wallet eligibility:', eligibility);

            if (!eligibility.canAcceptRides) {
                Alert.alert(
                    'Cannot Accept Ride',
                    `Your wallet balance is \u20b9${eligibility.currentBalance.toFixed(2)}.\n\nRecharge \u20b9${(eligibility.requiredRecharge || 0).toFixed(0)} to accept new ride requests again.`,
                    [
                        { text: 'Later', style: 'cancel' },
                        {
                            text: 'Recharge Now',
                            onPress: openRechargeFlow,
                        },
                    ]
                );
                return;
            }

            console.log('[HANDLE ACCEPT] Calling acceptBooking...');
            const { success, error, errorCode, currentBalance, requiredRecharge, assignmentMode } = await acceptBooking(id, driverProfile.id);
            
            console.log('[HANDLE ACCEPT] Accept result:', { success, error, errorCode, currentBalance, requiredRecharge });
            
            if (success) {
                console.log('[HANDLE ACCEPT] Booking accepted successfully');
                void refreshLocationTrackingNotification();
                if (assignmentMode === 'queued') {
                    Alert.alert("Ride queued", "Next ride queued successfully. Finish your current ride to activate it.");
                    fetchAllRides();
                } else {
                    console.log('[HANDLE ACCEPT] Navigating to /ride/' + id);
                    Alert.alert("Success", "Booking accepted! Navigate to pickup location.");
                    router.push(`/ride/${id}`);
                    console.log('[HANDLE ACCEPT] Navigation triggered');
                }
            } else if (errorCode === 'wallet_recharge_required') {
                Alert.alert(
                    'Wallet Recharge Required',
                    `Your wallet balance is \u20b9${(currentBalance || 0).toFixed(2)}.\n\nRecharge \u20b9${(requiredRecharge || 0).toFixed(0)} to continue accepting rides.`,
                    [
                        { text: 'Later', style: 'cancel' },
                        {
                            text: 'Recharge Now',
                            onPress: openRechargeFlow,
                        },
                    ]
                );
            } else {
                console.error('[HANDLE ACCEPT] Failed to accept:', error);
                Alert.alert("Error", error || "Failed to accept booking. It might have been taken.");
                // Refresh list
                fetchAllRides();
            }
        } catch (acceptError) {
            console.error('[HANDLE ACCEPT] Unexpected accept error:', acceptError);
            Alert.alert('Error', 'Failed to verify wallet status. Please try again.');
        }
    };

    const handleDecline = async (id: string) => {
          Alert.alert(
              t("declineRequest"),
              t("areYouSureDecline"),
              [
                  { text: t("cancel"), style: "cancel" },
                  { 
                      text: t("decline"), 
                      style: "destructive",
                      onPress: async () => {
                          // Optimistically remove from list
                          setAllRides(prev => prev.filter(r => r.id !== id));
                          
                        // Call API to persist decline
                        const { success, error } = await declineBooking(id);
                          
                          if (!success) {
                              console.error('[HANDLE REJECT] Failed to decline:', error);
                              // Ideally we would show it again or show toast, but for now just log
                          } else {
                              console.log('[HANDLE REJECT] Booking declined successfully');
                          }
                      }
                  }
              ]
          );
      };

    // No blocking loading guard - page is always visible immediately

    // Render - SINGLE list showing ALL rides
    return (
        <SafeAreaView testID="driver.requests" accessibilityLabel="driver.requests" className="flex-1 bg-white">
            <View className="px-5 pt-5 pb-20 flex-1">
                {/* Header */}
                <View className="mb-6">
                    <Text className="text-gray-900 text-3xl font-JakartaBold mb-2">
                        {t('myRides') || 'My Rides'}
                    </Text>
                    <Text className="text-gray-500 text-sm">
                        {allRides.length} {allRides.length === 1 ? 'ride' : 'rides'} total
                    </Text>
                </View>

                {/* Background loading banner - shown while fetching, never blocks the page */}
                {loading && (
                    <Animated.View
                        style={{ opacity: pulseAnim }}
                        className="flex-row items-center bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-4"
                    >
                        <ActivityIndicator size="small" color="#2563eb" />
                        <Text className="text-blue-600 font-JakartaMedium text-sm ml-3">
                            {t('findingNearbyRequests') || 'Finding nearby ride requests...'}
                        </Text>
                    </Animated.View>
                )}

                {allRides.length === 0 && !loading ? (
                    <View className="bg-gray-50 rounded-2xl p-8 border border-gray-200 items-center">
                        <Ionicons name="car-outline" size={64} color="#9ca3af" />
                        <Text className="text-gray-500 text-center mt-4 font-JakartaMedium text-lg">
                            No rides yet
                        </Text>
                        <Text className="text-gray-400 text-center text-sm mt-2">
                            When you accept ride requests or complete trips, they'll appear here
                        </Text>
                    </View>
                ) : (
                    <ScrollView
                        refreshControl={
                            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                        }
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={{ paddingBottom: 100 }}
                    >
                        {/* SINGLE LIST - All rides together */}
                        {allRides.map((ride, index) => {
                            // Check if it's an available request (pending) or active/completed ride
                            const isPending = ride.status === 'pending';
                            const isQueued = ride.status === 'queued';
                            const isOngoing = ['accepted', 'driver_arrived', 'in_progress'].includes(ride.status);
                            const isCompleted = ride.status === 'completed';
                            
                            if (isPending) {
                                return (
                                    <RideRequestCard
                                        key={ride.id}
                                        request={ride}
                                        index={index}
                                        onAccept={handleAccept}
                                        onReject={handleDecline}
                                    />
                                );
                            } else if (isQueued) {
                                return (
                                    <QueuedRideCard
                                        key={ride.id}
                                        booking={ride}
                                    />
                                );
                            } else if (isOngoing) {
                                return (
                                    <ActiveRideCard
                                        key={ride.id}
                                        booking={ride}
                                    />
                                );
                            } else if (isCompleted) {
                                return (
                                    <HistoryRideCard
                                        key={ride.id}
                                        booking={ride}
                                    />
                                );
                            }
                            return null;
                        })}
                    </ScrollView>
                )}
            </View>
        </SafeAreaView>
    );
};

export default DriverRequests;



