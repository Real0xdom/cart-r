import { View, Text, TouchableOpacity, ScrollView, Switch, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect } from 'react';
import { router } from 'expo-router';
import { startLocationTracking, stopLocationTracking, requestLocationPermissions } from '@/lib/location';
import { getDriverActiveBooking, getDriverCompletedTrips, Booking } from '@/lib/bookings';

const DriverHome = () => {
    const { signOut, driverProfile, toggleDriverOnline, profile } = useAuth();
    const [isOnline, setIsOnline] = useState(driverProfile?.is_online || false);
    const [isTogglingStatus, setIsTogglingStatus] = useState(false);
    const [activeBooking, setActiveBooking] = useState<Booking | null>(null);
    const [todayStats, setTodayStats] = useState({ earnings: 0, trips: 0 });
    const [isLoadingStats, setIsLoadingStats] = useState(true);

    useEffect(() => {
        setIsOnline(driverProfile?.is_online || false);
    }, [driverProfile]);

    // Check for active booking and fetch today's stats
    useEffect(() => {
        if (!driverProfile?.id) return;

        const fetchData = async () => {
            // Check for active booking
            const { data: activeRide } = await getDriverActiveBooking(driverProfile.id);
            if (activeRide) {
                setActiveBooking(activeRide);
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
        setIsTogglingStatus(true);
        
        try {
            if (value) {
                // Going online - request permissions and start tracking
                const hasPermissions = await requestLocationPermissions();
                if (!hasPermissions) {
                    Alert.alert(
                        'Location Permission Required',
                        'Please enable location access to go online and receive ride requests.',
                        [{ text: 'OK' }]
                    );
                    setIsTogglingStatus(false);
                    return;
                }
                
                // First toggle online status so location updates can be saved
                await toggleDriverOnline(value);
                setIsOnline(value);
                
                // Get and save current location immediately (don't wait for background task)
                try {
                    const Location = require('expo-location');
                    const location = await Location.getCurrentPositionAsync({
                        accuracy: Location.Accuracy.Balanced,
                    });
                    if (location && profile?.id) {
                        // Update location in database
                        const { supabase } = require('@/lib/supabase');
                        await supabase
                            .from('drivers')
                            .update({
                                current_latitude: location.coords.latitude,
                                current_longitude: location.coords.longitude,
                                last_location_update: new Date().toISOString(),
                            })
                            .eq('user_id', profile.id);
                        console.log('📍 Initial location set:', location.coords.latitude, location.coords.longitude);
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
                
                // Start background location tracking
                await startLocationTracking();
            } else {
                // Going offline - stop tracking
                await stopLocationTracking();
                setIsOnline(value);
                await toggleDriverOnline(value);
            }
        } catch (error) {
            console.error('Failed to toggle online status:', error);
            Alert.alert('Error', 'Failed to update online status. Please try again.');
        } finally {
            setIsTogglingStatus(false);
        }
    };

    const navigateToActiveRide = () => {
        if (activeBooking) {
            router.push(`/ride/${activeBooking.id}` as any);
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-gray-900">
            <ScrollView className="p-5" contentContainerStyle={{ paddingBottom: 100 }}>
                {/* Header */}
                <View className="flex-row justify-between items-center mb-6">
                    <View>
                        <Text className="text-gray-400 text-sm">Welcome back,</Text>
                        <Text className="text-white text-2xl font-JakartaBold">
                            {profile?.name || 'Driver'}
                        </Text>
                    </View>
                    <TouchableOpacity
                        onPress={signOut}
                        className="bg-red-500/20 px-4 py-2 rounded-full"
                    >
                        <Text className="text-red-400 font-JakartaSemiBold">Logout</Text>
                    </TouchableOpacity>
                </View>

                {/* Active Ride Banner */}
                {activeBooking && (
                    <TouchableOpacity 
                        onPress={navigateToActiveRide}
                        className="bg-blue-500 rounded-2xl p-4 mb-6 flex-row items-center"
                    >
                        <View className="w-12 h-12 bg-blue-400 rounded-full items-center justify-center mr-4">
                            <Text className="text-2xl">🚗</Text>
                        </View>
                        <View className="flex-1">
                            <Text className="text-white font-JakartaBold text-lg">Active Ride</Text>
                            <Text className="text-blue-100 text-sm" numberOfLines={1}>
                                {activeBooking.status === 'accepted' && 'Head to pickup →'}
                                {activeBooking.status === 'driver_arrived' && 'Verify OTP to start →'}
                                {activeBooking.status === 'in_progress' && 'Trip in progress →'}
                            </Text>
                        </View>
                        <Text className="text-white text-2xl">›</Text>
                    </TouchableOpacity>
                )}

                {/* Online Status Card */}
                <View className="bg-gray-800 p-6 rounded-2xl mb-6">
                    <View className="flex-row justify-between items-center">
                        <View>
                            <Text className="text-gray-400 text-sm mb-1">Status</Text>
                            <Text className={`text-2xl font-JakartaBold ${isOnline ? 'text-green-400' : 'text-red-400'}`}>
                                {isOnline ? '🟢 Online' : '🔴 Offline'}
                            </Text>
                        </View>
                        <Switch
                            value={isOnline}
                            onValueChange={handleToggleOnline}
                            trackColor={{ false: '#374151', true: '#22c55e' }}
                            thumbColor={isOnline ? '#ffffff' : '#9ca3af'}
                            disabled={isTogglingStatus}
                        />
                    </View>
                    <Text className="text-gray-500 text-sm mt-3">
                        {isTogglingStatus 
                            ? 'Updating status...' 
                            : isOnline 
                                ? 'You are visible to customers • GPS active' 
                                : 'Go online to receive ride requests'}
                    </Text>
                </View>

                {/* Today's Stats */}
                <Text className="text-white text-xl font-JakartaBold mb-4">Today's Summary</Text>
                <View className="flex-row gap-3 mb-6">
                    <View className="flex-1 bg-blue-500/20 p-4 rounded-xl">
                        <Text className="text-blue-400 text-sm mb-1">Earnings</Text>
                        {isLoadingStats ? (
                            <ActivityIndicator size="small" color="#60a5fa" />
                        ) : (
                            <Text className="text-white text-2xl font-JakartaBold">
                                ₹{todayStats.earnings.toLocaleString()}
                            </Text>
                        )}
                    </View>
                    <View className="flex-1 bg-purple-500/20 p-4 rounded-xl">
                        <Text className="text-purple-400 text-sm mb-1">Trips</Text>
                        {isLoadingStats ? (
                            <ActivityIndicator size="small" color="#a78bfa" />
                        ) : (
                            <Text className="text-white text-2xl font-JakartaBold">{todayStats.trips}</Text>
                        )}
                    </View>
                    <View className="flex-1 bg-green-500/20 p-4 rounded-xl">
                        <Text className="text-green-400 text-sm mb-1">Rating</Text>
                        <Text className="text-white text-2xl font-JakartaBold">
                            {driverProfile?.rating?.toFixed(1) || '5.0'}
                        </Text>
                    </View>
                </View>

                {/* Quick Actions */}
                <Text className="text-white text-xl font-JakartaBold mb-4">Quick Actions</Text>
                <View className="gap-3">
                    <TouchableOpacity 
                        onPress={() => router.push('/(tabs)/requests')}
                        className="bg-gray-800 p-4 rounded-xl flex-row items-center"
                    >
                        <View className="w-12 h-12 bg-blue-500/20 rounded-full items-center justify-center mr-4">
                            <Text className="text-2xl">📋</Text>
                        </View>
                        <View className="flex-1">
                            <Text className="text-white font-JakartaSemiBold">View Requests</Text>
                            <Text className="text-gray-400 text-sm">Check available ride requests</Text>
                        </View>
                    </TouchableOpacity>

                    <TouchableOpacity 
                        onPress={() => router.push('/(tabs)/earnings')}
                        className="bg-gray-800 p-4 rounded-xl flex-row items-center"
                    >
                        <View className="w-12 h-12 bg-green-500/20 rounded-full items-center justify-center mr-4">
                            <Text className="text-2xl">💰</Text>
                        </View>
                        <View className="flex-1">
                            <Text className="text-white font-JakartaSemiBold">Earnings</Text>
                            <Text className="text-gray-400 text-sm">
                                Total: ₹{(driverProfile?.total_earnings || 0).toLocaleString()}
                            </Text>
                        </View>
                    </TouchableOpacity>

                    <TouchableOpacity 
                        onPress={() => Alert.alert('Support', 'Contact us at drivers@cart-r.com')}
                        className="bg-gray-800 p-4 rounded-xl flex-row items-center"
                    >
                        <View className="w-12 h-12 bg-orange-500/20 rounded-full items-center justify-center mr-4">
                            <Text className="text-2xl">📞</Text>
                        </View>
                        <View className="flex-1">
                            <Text className="text-white font-JakartaSemiBold">Support</Text>
                            <Text className="text-gray-400 text-sm">Get help from our team</Text>
                        </View>
                    </TouchableOpacity>
                </View>

            </ScrollView>
        </SafeAreaView>
    );
};

export default DriverHome;
