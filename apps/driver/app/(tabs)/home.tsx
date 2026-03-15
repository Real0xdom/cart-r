import { View, Text, TouchableOpacity, ScrollView, Switch, Alert, ActivityIndicator } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useState, useEffect, useRef } from 'react';
import { router } from 'expo-router';
import { startLocationTracking, stopLocationTracking, requestLocationPermissions, checkLocationServices } from '@/lib/location';
import { getDriverActiveBookings, getDriverActiveBooking, getDriverCompletedTrips, Booking, getAvailableBookings, subscribeToAvailableBookings } from '@/lib/bookings';
import * as Location from 'expo-location';

// Countdown timer hook for ride requests - MUST be called at top level
const useCountdown = (expiresAt: string | null) => {
    const [timeLeft, setTimeLeft] = useState<string>('');
    const [isExpired, setIsExpired] = useState(false);

    useEffect(() => {
        if (!expiresAt) {
            setTimeLeft('');
            return;
        }

        const updateCountdown = () => {
            const now = new Date().getTime();
            const expiry = new Date(expiresAt).getTime();
            const diff = expiry - now;

            if (diff <= 0) {
                setTimeLeft('Expired');
                setIsExpired(true);
            } else {
                const mins = Math.floor(diff / 60000);
                const secs = Math.floor((diff % 60000) / 1000);
                setTimeLeft(`${mins}:${secs.toString().padStart(2, '0')}`);
                setIsExpired(false);
            }
        };

        updateCountdown();
        const interval = setInterval(updateCountdown, 1000);
        return () => clearInterval(interval);
    }, [expiresAt]);

    return { timeLeft, isExpired };
};

const RideRequestCard = ({ request, onAccept, onReject }: { request: Booking; onAccept: (id: string) => void; onReject: (id: string) => void }) => {
    const { t } = useLanguage();
    const { timeLeft, isExpired } = useCountdown(request.expires_at || null);
    
    return (
        <View className="bg-white rounded-2xl p-4 mb-3 border border-gray-200 shadow-sm">
            {/* Expiration Timer Badge */}
            {timeLeft && (
                <View className={`absolute top-3 right-3 px-2 py-1 rounded-full ${
                    isExpired ? 'bg-gray-500' : (parseInt(timeLeft) < 1 ? 'bg-red-500' : 'bg-blue-500')
                }`}>
                    <View className="flex-row items-center">
                        <Ionicons name={isExpired ? "close-circle-outline" : "time-outline"} size={12} color="#fff" />
                        <Text className="ml-1 text-white font-JakartaBold text-xs">{isExpired ? 'Expired' : timeLeft}</Text>
                    </View>
                </View>
            )}

            {/* Increased Fare Badge */}
            {((request.tip_amount && request.tip_amount > 0) || (request.fare_multiplier && request.fare_multiplier > 1)) && (
                <View className="bg-orange-500 px-3 py-1 rounded-full self-start mb-2 flex-row items-center">
                    <Ionicons name="flash-outline" size={12} color="#fff" />
                    <Text className="ml-1 text-white font-JakartaBold text-xs">{t('increasedFare')}</Text>
                    {request.tip_amount && request.tip_amount > 0 && (
                        <Text className="text-white font-JakartaMedium text-xs ml-1">+₹{request.tip_amount} tip</Text>
                    )}
                </View>
            )}

            {/* Pickup Location */}
            <View className="flex-row justify-between items-start mb-3">
                <View className="flex-1 pr-16">
                    <Text className="text-gray-500 text-xs mb-1">{t('pickup')}</Text>
                    <Text className="text-gray-900 font-JakartaSemiBold text-base" numberOfLines={2}>
                        {request.origin_address}
                    </Text>
                </View>
                <View className="bg-green-100 px-3 py-1 rounded-full ml-2 absolute right-0 top-6">
                    <Text className="text-green-700 font-JakartaBold">₹{request.total_fare}</Text>
                </View>
            </View>

            {/* Drop-off Location */}
            <View className="mb-3">
                <Text className="text-gray-500 text-xs mb-1">DROP-OFF</Text>
                <Text className="text-gray-900 font-JakartaSemiBold text-base" numberOfLines={2}>
                    {request.destination_address}
                </Text>
            </View>

            {/* Trip Details */}
            <View className="flex-row gap-3 mb-3">
                <View className="flex-1 bg-gray-50 p-2 rounded-xl border border-gray-200">
                    <Text className="text-gray-500 text-xs">{t('distance')}</Text>
                    <Text className="text-gray-900 font-JakartaSemiBold">
                        {request.estimated_distance ? `${request.estimated_distance.toFixed(1)} km` : '-'}
                    </Text>
                </View>
                <View className="flex-1 bg-gray-50 p-2 rounded-xl border border-gray-200">
                    <Text className="text-gray-500 text-xs">Est. Time</Text>
                    <Text className="text-gray-900 font-JakartaSemiBold">
                        {request.estimated_duration ? `${request.estimated_duration.toFixed(0)} min` : '-'}
                    </Text>
                </View>
                <View className="flex-1 bg-gray-50 p-2 rounded-xl border border-gray-200">
                    <Text className="text-gray-500 text-xs">{t('payment')}</Text>
                    <Text className="text-gray-900 font-JakartaSemiBold capitalize">{request.payment_method}</Text>
                </View>
            </View>

            {/* Action Buttons */}
            <View className="flex-row gap-3">
                <TouchableOpacity
                    onPress={() => onReject(request.id)}
                    className="flex-1 bg-red-50 p-3 rounded-xl border border-red-200"
                >
                    <Text className="text-red-600 text-center font-JakartaBold">{t('decline')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => onAccept(request.id)}
                    className={`flex-1 p-3 rounded-xl ${isExpired ? 'bg-gray-300' : 'bg-green-500'}`}
                    disabled={isExpired}
                >
                    <Text className={`text-center font-JakartaBold ${isExpired ? 'text-gray-500' : 'text-white'}`}>
                        {t('accept')}
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const DriverHome = () => {
    const { signOut, driverProfile, toggleDriverOnline, profile } = useAuth();
    const { t } = useLanguage();
    const [isOnline, setIsOnline] = useState(driverProfile?.is_online || false);
    const [isTogglingStatus, setIsTogglingStatus] = useState(false);
    const [activeBookings, setActiveBookings] = useState<Booking[]>([]);
    const [rideRequests, setRideRequests] = useState<Booking[]>([]);
    const [isRidesExpanded, setIsRidesExpanded] = useState(true);
    const [todayStats, setTodayStats] = useState({ earnings: 0, trips: 0 });
    const [isLoadingStats, setIsLoadingStats] = useState(true);
    const [location, setLocation] = useState<{latitude: number, longitude: number} | null>(null);
    const hasAutoNavigated = useRef(false);

    useEffect(() => {
        setIsOnline(driverProfile?.is_online || false);
    }, [driverProfile]);

    // Get location on mount
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

                let { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted') {
                    console.log('Location permission not granted');
                    return;
                }
                
                let currentLocation = await Location.getCurrentPositionAsync({});
                setLocation({
                    latitude: currentLocation.coords.latitude,
                    longitude: currentLocation.coords.longitude
                });
            } catch (error) {
                console.error('Failed to get location:', error);
                // If it fails with "Current location is unavailable", it's usually because services are disabled
                const message = error instanceof Error ? error.message : String(error);
                if (message.includes('Location services are disabled') || message.includes('Current location is unavailable')) {
                    Alert.alert(
                        t('locationServicesDisabled') || 'Location Services Disabled',
                        t('enableLocationServices') || 'Please enable location services (GPS) to use the app properly.',
                        [{ text: t('ok') }]
                    );
                }
            }
        })();
    }, []);

    // Fetch ride requests when location and driver profile are available
    useEffect(() => {
        if (!location || !driverProfile?.vehicle_type || !isOnline) {
            return; // Only show requests when driver is online
        }

        const fetchRideRequests = async () => {
            const { data, error } = await getAvailableBookings(
                location.latitude,
                location.longitude,
                driverProfile.vehicle_type,
                20 // 20km radius
            );
            
            if (!error && data) {
                console.log('[HOME] Fetched ride requests:', data.length);
                setRideRequests(data);
            }
        };

        fetchRideRequests();

        // Subscribe to real-time updates
        const unsubscribe = subscribeToAvailableBookings(
            driverProfile.vehicle_type,
            (newBooking: Booking) => {
                console.log('[HOME SUBSCRIPTION] New booking received:', newBooking.id);
                setRideRequests(prev => {
                    // Avoid duplicates and add to top
                    if (prev.some(b => b.id === newBooking.id)) {
                        return prev;
                    }
                    return [newBooking, ...prev];
                });
            },
            (removedBookingId: string) => {
                console.log('[HOME SUBSCRIPTION] Booking removed:', removedBookingId);
                setRideRequests(prev => prev.filter(b => b.id !== removedBookingId));
            },
            (updatedBooking: Booking) => {
                console.log('[HOME SUBSCRIPTION] Booking updated:', updatedBooking.id);
                setRideRequests(prev => {
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
    }, [location, driverProfile?.vehicle_type, isOnline]);

    // Check for active booking and fetch today's stats
    useEffect(() => {
        if (!driverProfile?.id) return;

        const fetchData = async () => {
            // Check for active bookings (all of them)
            const { data: activeRides } = await getDriverActiveBookings(driverProfile.id);
            if (activeRides) {
                setActiveBookings(activeRides);

                // Auto-navigate to active ride on app launch/crash recovery
                if (!hasAutoNavigated.current && activeRides.length === 1) {
                    hasAutoNavigated.current = true;
                    console.log('[HOME] Auto-navigating to active ride:', activeRides[0].id);
                    router.push(`/ride/${activeRides[0].id}` as any);
                }
            }

            // Fetch today's stats
            const { data: trips } = await getDriverCompletedTrips(driverProfile.id, 50);
            if (trips) {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                
                const todayTrips = trips.filter(t => {
                    const tripDate = new Date(t.completed_at || t.created_at);
                    return tripDate >= today;
                });

                const earnings = todayTrips.reduce((sum, t) => sum + (t.driver_payout || t.total_fare), 0);
                setTodayStats({ earnings, trips: todayTrips.length });
            }
            setIsLoadingStats(false);
        };

        fetchData();

        // Poll for updates every 30 seconds
        const interval = setInterval(fetchData, 30000);
        return () => clearInterval(interval);
    }, [driverProfile?.id]);

    const handleToggleOnline = async (value: boolean) => {
        // [G5] Block suspended / unverified drivers from going online
        if (value && driverProfile?.verification_status !== 'approved') {
            Alert.alert(
                t('error'),
                t('accountNotApproved') || 'Your account is not approved. Please contact support.'
            );
            return;
        }

        // [G6] Require vehicle type before going online
        if (value && !driverProfile?.vehicle_type) {
            Alert.alert(
                t('error'),
                t('vehicleTypeRequired') || 'Please set your vehicle type before going online.'
            );
            return;
        }

        setIsTogglingStatus(true);

        try {
            if (value) {
                // Going online — request permissions and start tracking
                
                // Check if services are enabled first
                const servicesEnabled = await checkLocationServices();
                if (!servicesEnabled) {
                    Alert.alert(
                        t('locationServicesDisabled') || 'Location Services Disabled',
                        t('enableLocationServices') || 'Please enable location services (GPS) to use the app properly.',
                        [{ text: t('ok') }]
                    );
                    setIsTogglingStatus(false);
                    return;
                }

                const hasPermissions = await requestLocationPermissions();
                if (!hasPermissions) {
                    Alert.alert(
                        t('locationPermissionRequired'),
                        t('enableLocationAccess'),
                        [{ text: t('ok') }]
                    );
                    setIsTogglingStatus(false);
                    return;
                }

                // Update DB first, then start tracking ([G3] rollback if tracking fails)
                await toggleDriverOnline(true);
                setIsOnline(true);

                // Get and save current location immediately
                try {
                    const Location = require('expo-location');
                    const location = await Location.getCurrentPositionAsync({
                        accuracy: Location.Accuracy.Balanced,
                    });
                    if (location && profile?.id) {
                        const { supabase } = require('@/lib/supabase');
                        await supabase
                            .from('drivers')
                            .update({
                                current_latitude: location.coords.latitude,
                                current_longitude: location.coords.longitude,
                                last_location_update: new Date().toISOString(),
                            })
                            .eq('user_id', profile.id);
                        console.log('ðŸ“ Initial location set:', location.coords.latitude, location.coords.longitude);
                    }
                } catch (locError) {
                    console.error('Failed to set initial location:', locError);
                }

                // Register push token for notifications
                try {
                    const { registerPushToken } = require('@/lib/notifications');
                    const { supabase } = require('@/lib/supabase');
                    if (profile?.id) {
                        await registerPushToken(supabase, profile.id);
                    }
                } catch (pushError) {
                    console.error('Failed to register push token:', pushError);
                }

                // [G3] Start background location tracking — rollback DB if it fails
                const trackingStarted = await startLocationTracking();
                if (!trackingStarted) {
                    console.warn('[TOGGLE] Location tracking failed to start — rolling back online status');
                    await toggleDriverOnline(false);
                    setIsOnline(false);
                    Alert.alert(
                        t('error'),
                        t('locationTrackingFailed') || 'Failed to start location tracking. Please try again.'
                    );
                    return;
                }
            } else {
                // Going offline — update DB first so state is consistent ([G2])
                await toggleDriverOnline(false);
                setIsOnline(false);

                // [G1] Only stop location tracking if there is no active ride in progress
                let hasActiveRide = false;
                if (driverProfile?.id) {
                    try {
                        const { data: activeRide } = await getDriverActiveBooking(driverProfile.id);
                        hasActiveRide = !!activeRide;
                    } catch (rideCheckError) {
                        console.error('Failed to check active ride:', rideCheckError);
                    }
                }

                if (hasActiveRide) {
                    console.log('[TOGGLE] Active ride detected — keeping location tracking alive despite going offline');
                    Alert.alert(
                        t('info') || 'Info',
                        t('activeRideLocationNote') || 'You went offline, but location tracking continues for your active ride.'
                    );
                } else {
                    await stopLocationTracking();
                }
            }
        } catch (error) {
            console.error('Failed to toggle online status:', error);
            // Revert UI to match DB on error
            if (driverProfile) {
                setIsOnline(driverProfile.is_online || false);
            }
            Alert.alert(t('error'), t('failedToUpdateStatus'));
        } finally {
            setIsTogglingStatus(false);
        }
    };


    const navigateToRide = (bookingId: string) => {
        router.push(`/ride/${bookingId}` as any);
    };

    const handleAcceptRequest = async (bookingId: string) => {
        if (!driverProfile?.id) {
            Alert.alert(t('error'), t('driverProfileNotFound'));
            return;
        }

        try {
            const { acceptBooking } = await import('@/lib/bookings');
            const { success, error } = await acceptBooking(bookingId, driverProfile.id);
            
            if (success) {
                Alert.alert('Success', 'Booking accepted! Navigate to pickup location.');
                // Remove from requests list
                setRideRequests(prev => prev.filter(r => r.id !== bookingId));
                // Navigate to ride screen
                router.push(`/ride/${bookingId}` as any);
            } else {
                Alert.alert('Error', error || 'Failed to accept booking');
            }
        } catch (err) {
            console.error('Failed to accept booking:', err);
            Alert.alert('Error', 'Failed to accept booking');
        }
    };

    const handleDeclineRequest = async (bookingId: string) => {
        Alert.alert(
            t('declineRequest'),
            t('areYouSureDecline'),
            [
                { text: t('cancel'), style: 'cancel' },
                { 
                    text: t('decline'), 
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const { declineBooking } = await import('@/lib/bookings');
                            const { success } = await declineBooking(bookingId);
                            if (success) {
                                setRideRequests(prev => prev.filter(r => r.id !== bookingId));
                            }
                        } catch (err) {
                            console.error('Failed to decline booking:', err);
                        }
                    }
                }
            ]
        );
    };

    const getStatusBadge = (status: Booking['status']) => {
        switch (status) {
            case 'accepted':
                return { text: t('headToPickup'), color: 'bg-blue-500/20', textColor: 'text-blue-400' };
            case 'driver_arrived':
                return { text: t('verifyOtp'), color: 'bg-yellow-500/20', textColor: 'text-yellow-400' };
            case 'in_progress':
                return { text: t('tripInProgress'), color: 'bg-green-500/20', textColor: 'text-green-400' };
            default:
                return { text: t('unknown'), color: 'bg-gray-500/20', textColor: 'text-gray-400' };
        }
    };

    return (
        <SafeAreaView testID="driver.home" accessibilityLabel="driver.home" className="flex-1 bg-white">
            <ScrollView className="p-5" contentContainerStyle={{ paddingBottom: 100 }}>
                {/* Header */}
                <View className="flex-row justify-between items-center mb-6">
                    <View>
                        <Text className="text-gray-500 text-sm">Welcome back,</Text>
                        <Text className="text-gray-900 text-2xl font-JakartaBold">
                            {profile?.name || 'Driver'}
                        </Text>
                    </View>
                    <TouchableOpacity
                        onPress={signOut}
                        className="bg-red-50 px-4 py-2 rounded-full"
                    >
                        <Text className="text-red-600 font-JakartaSemiBold">Logout</Text>
                    </TouchableOpacity>
                </View>

                {/* Ride Requests Section - Only show when driver is online and has NON-EXPIRED requests */}
                {isOnline && rideRequests.length > 0 && (
                    <View className="mb-6">
                        <View className="flex-row justify-between items-center mb-3">
                            <Text className="text-gray-900 text-lg font-JakartaBold">
                                {t('rideRequests')} ({rideRequests.filter(r => {
                                    if (!r.expires_at) return true;
                                    return new Date(r.expires_at).getTime() > Date.now();
                                }).length})
                            </Text>
                            <TouchableOpacity onPress={() => router.push('/(tabs)/requests')}>
                                <Text className="text-blue-600 font-JakartaMedium text-sm">{t('viewAll')}</Text>
                            </TouchableOpacity>
                        </View>
                        {rideRequests
                            .filter(request => {
                                // Filter out expired requests from home screen
                                if (!request.expires_at) return true;
                                return new Date(request.expires_at).getTime() > Date.now();
                            })
                            .map((request) => (
                                <RideRequestCard
                                    key={request.id}
                                    request={request}
                                    onAccept={handleAcceptRequest}
                                    onReject={handleDeclineRequest}
                                />
                            ))
                        }
                    </View>
                )}

                {/* Online Status Card */}
                <View className="bg-gray-50 p-6 rounded-2xl mb-6 border border-gray-200">
                    <View className="flex-row justify-between items-center">
                        <View>
                            <Text className="text-gray-500 text-sm mb-1">{t('status')}</Text>
                            <Text className={`text-2xl font-JakartaBold ${isOnline ? 'text-green-600' : 'text-red-600'}`}>
                                {isOnline ? t('online') : t('offline')}
                            </Text>
                        </View>

                        <Switch
                            testID="driver.toggleOnline"
                            accessibilityLabel="driver.toggleOnline"
                            value={isOnline}
                            onValueChange={handleToggleOnline}
                            trackColor={{ false: '#d1d5db', true: '#22c55e' }}
                            thumbColor={isOnline ? '#ffffff' : '#9ca3af'}
                            disabled={isTogglingStatus}
                        />
                    </View>
                    <Text className="text-gray-500 text-sm mt-3">
                        {isTogglingStatus 
                            ? t('updatingStatus') 
                            : isOnline 
                                ? t('visibleToCustomers') 
                                : t('goOnlineToReceive')}
                    </Text>
                </View>

                {/* Today's Stats */}
                <Text className="text-gray-900 text-xl font-JakartaBold mb-4">{t('todaysSummary')}</Text>
                <View className="flex-row gap-3 mb-6">
                    <View className="flex-1 bg-blue-50 p-4 rounded-xl border border-blue-100">
                        <Text className="text-blue-600 text-sm mb-1">Earnings</Text>
                        {isLoadingStats ? (
                            <ActivityIndicator size="small" color="#2563eb" />
                        ) : (
                            <Text className="text-gray-900 text-2xl font-JakartaBold">
                                ₹{todayStats.earnings.toLocaleString()}
                            </Text>
                        )}
                    </View>
                    <View className="flex-1 bg-purple-50 p-4 rounded-xl border border-purple-100">
                        <Text className="text-purple-600 text-sm mb-1">{t('trips')}</Text>
                        {isLoadingStats ? (
                            <ActivityIndicator size="small" color="#7c3aed" />
                        ) : (
                            <Text className="text-gray-900 text-2xl font-JakartaBold">{todayStats.trips}</Text>
                        )}
                    </View>
                    <View className="flex-1 bg-green-50 p-4 rounded-xl border border-green-100">
                        <Text className="text-green-600 text-sm mb-1">Rating</Text>
                        <Text className="text-gray-900 text-2xl font-JakartaBold">
                            {driverProfile?.rating?.toFixed(1) || '5.0'}
                        </Text>
                    </View>
                </View>

                {/* Quick Actions */}
                <Text className="text-gray-900 text-xl font-JakartaBold mb-4">{t('quickActions')}</Text>
                <View className="gap-3">
                    <TouchableOpacity 
                        testID="driver.viewRequestsButton"
                        accessibilityLabel="driver.viewRequestsButton"
                        onPress={() => router.push('/(tabs)/requests')}
                        className="bg-gray-50 p-4 rounded-xl flex-row items-center border border-gray-200"
                    >
                        <View className="w-12 h-12 bg-blue-100 rounded-full items-center justify-center mr-4">
                            <Ionicons name="list" size={24} color="#3b82f6" />
                        </View>
                        <View className="flex-1">
<Text className="text-gray-900 font-JakartaSemiBold">{t('myRides') || 'My Rides'}</Text>
<Text className="text-gray-500 text-sm">{t('viewRideHistory')}</Text>
                        </View>
                    </TouchableOpacity>

                    <TouchableOpacity 
                        onPress={() => router.push('/(tabs)/earnings')}
                        className="bg-gray-50 p-4 rounded-xl flex-row items-center border border-gray-200"
                    >
                        <View className="w-12 h-12 bg-green-100 rounded-full items-center justify-center mr-4">
                            <Ionicons name="wallet" size={24} color="#22c55e" />
                        </View>
                        <View className="flex-1">
                            <Text className="text-gray-900 font-JakartaSemiBold">{t('earnings')}</Text>
                            <Text className="text-gray-500 text-xs truncate">
                                {t('total')}: ₹{(driverProfile?.total_earnings || 0).toLocaleString()}
                            </Text>
                        </View>
                    </TouchableOpacity>

                    <TouchableOpacity 
                        onPress={() => Alert.alert(t('helpSupport'), `${t('contactUsAt')} drivers@cart-r.com`)}
                        className="bg-gray-50 p-4 rounded-xl flex-row items-center border border-gray-200"
                    >
                        <View className="w-12 h-12 bg-orange-100 rounded-full items-center justify-center mr-4">
                            <Ionicons name="call" size={24} color="#f97316" />
                        </View>
                        <View className="flex-1">
                            <Text className="text-gray-900 font-JakartaSemiBold">{t('helpSupport')}</Text>
                            <Text className="text-gray-500 text-sm">{t('getHelpFromTeam')}</Text>
                        </View>
                    </TouchableOpacity>
                </View>

            </ScrollView>
        </SafeAreaView>
    );
};

export default DriverHome;




