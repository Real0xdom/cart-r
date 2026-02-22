import { View, Text, TouchableOpacity, ScrollView, RefreshControl, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useCallback, useEffect } from 'react';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { getAvailableBookings, subscribeToAvailableBookings, acceptBooking, declineBooking, Booking } from '@/lib/bookings';
import * as Location from 'expo-location';

// Countdown timer hook for expiration
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

const RideRequestCard = ({ request, onAccept, onReject }: { request: Booking, onAccept: (id: string) => void, onReject: (id: string) => void }) => {
    const { t } = useLanguage();
    const { timeLeft, isExpired } = useCountdown(request.expires_at || null);
    
    // Don't render expired requests
    if (isExpired) return null;
    
    return (
        <View className="bg-white rounded-2xl p-4 mb-4 border border-gray-200 shadow-sm">
            {/* Expiration Timer Badge */}
            {timeLeft && (
                <View className={`absolute top-3 right-3 px-2 py-1 rounded-full ${
                    parseInt(timeLeft) < 1 ? 'bg-red-500' : 'bg-blue-500'
                }`}>
                    <Text className="text-white font-JakartaBold text-xs">⏱ {timeLeft}</Text>
                </View>
            )}
            
            {/* Increased Fare Badge */}
            {((request.tip_amount && request.tip_amount > 0) || (request.fare_multiplier && request.fare_multiplier > 1)) && (
                <View className="bg-orange-500 px-3 py-1 rounded-full self-start mb-2 flex-row items-center">
                    <Text className="text-white font-JakartaBold text-xs">🔥 {t('increasedFare')}</Text>
                    {request.tip_amount && request.tip_amount > 0 && (
                        <Text className="text-white font-JakartaMedium text-xs ml-1">+₹{request.tip_amount} tip</Text>
                    )}
                </View>
            )}

            {/* Addons - driver sees addon names and updated price before accepting */}
            {request.booking_addons && request.booking_addons.length > 0 && (
                <View className="bg-amber-50 border border-amber-200 px-3 py-2 rounded-xl mb-3">
                    <Text className="text-amber-700 font-JakartaBold text-xs mb-1">{t('addonsLabel')}</Text>
                    {request.booking_addons.map((ba: any, i: number) => (
                        <Text key={i} className="text-amber-800 font-JakartaMedium text-xs" numberOfLines={1}>
                            • {ba.addon_services?.name ?? t('addon')} — ₹{(ba.quantity || 1) * (ba.unit_price || 0)}
                        </Text>
                    ))}
                    {request.addon_charges != null && request.addon_charges > 0 && (
                        <Text className="text-amber-700 font-JakartaSemiBold text-xs mt-1">{t('totalAddons')}: ₹{request.addon_charges}</Text>
                    )}
                </View>
            )}
            
            <View className="flex-row justify-between items-start mb-4">
                <View className="flex-1 pr-16">
                    <Text className="text-gray-500 text-xs mb-1">{t('pickup')}</Text>
                    <Text className="text-gray-900 font-JakartaSemiBold text-base" numberOfLines={2}>
                        {request.origin_address}
                    </Text>
                </View>
                <View className="bg-green-100 px-3 py-1 rounded-full ml-2 absolute right-0 top-6">
                    <Text className="text-green-700 font-JakartaBold">₹{request.driver_payout || request.total_fare}</Text>
                </View>
            </View>

            <View className="mb-4">
                <Text className="text-gray-500 text-xs mb-1">DROP-OFF</Text>
                <Text className="text-gray-900 font-JakartaSemiBold text-base" numberOfLines={2}>
                    {request.destination_address}
                </Text>
            </View>

            <View className="flex-row gap-4 mb-4">
                <View className="flex-1 bg-gray-50 p-3 rounded-xl border border-gray-200">
                    <Text className="text-gray-500 text-xs">{t('distance')}</Text>
                    <Text className="text-gray-900 font-JakartaSemiBold">
                        {request.estimated_distance ? `${request.estimated_distance.toFixed(1)} km` : '-'}
                    </Text>
                </View>
                <View className="flex-1 bg-gray-50 p-3 rounded-xl border border-gray-200">
                    <Text className="text-gray-500 text-xs">Est. Time</Text>
                    <Text className="text-gray-900 font-JakartaSemiBold">
                        {request.estimated_duration ? `${request.estimated_duration.toFixed(0)} min` : '-'}
                    </Text>
                </View>
                <View className="flex-1 bg-gray-50 p-3 rounded-xl border border-gray-200">
                    <Text className="text-gray-500 text-xs">{t('payment')}</Text>
                    <Text className="text-gray-900 font-JakartaSemiBold capitalize">{request.payment_method}</Text>
                </View>
            </View>

            <View className="flex-row gap-3">
                <TouchableOpacity
                    onPress={() => onReject(request.id)}
                    className="flex-1 bg-red-50 p-4 rounded-xl border border-red-200"
                >
                    <Text className="text-red-600 text-center font-JakartaBold">{t('decline')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => onAccept(request.id)}
                    className="flex-1 bg-green-500 p-4 rounded-xl"
                >
                    <Text className="text-white text-center font-JakartaBold">{t('accept')}</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const DriverRequests = () => {
    const { driverProfile, profile } = useAuth();
    const { t } = useLanguage();
    const [requests, setRequests] = useState<Booking[]>([]);
    const [refreshing, setRefreshing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [location, setLocation] = useState<{latitude: number, longitude: number} | null>(null);

    const fetchRequests = async () => {
        console.log('========================================');
        console.log('[DRIVER REQUESTS] Fetching available bookings...');
        console.log('[DRIVER REQUESTS] Location:', location);
        console.log('[DRIVER REQUESTS] Driver vehicle type:', driverProfile?.vehicle_type);
        console.log('========================================');
        
        if (!location || !driverProfile?.vehicle_type) {
            console.log('[DRIVER REQUESTS] Missing location or vehicle type, skipping fetch');
            return; // Wait for location and driver profile
        }
        
        const { data, error } = await getAvailableBookings(
            location.latitude,
            location.longitude,
            driverProfile.vehicle_type, // Only show bookings matching driver's vehicle
            20 // 20km radius
        );
        
        if (error) {
            console.error("[DRIVER REQUESTS] Error fetching requests:", error);
            // Don't show alert on auto-refresh to avoid annoyance
        } else {
            console.log('[DRIVER REQUESTS] Found bookings:', data.length);
            console.log('[DRIVER REQUESTS] Bookings:', JSON.stringify(data, null, 2));
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

    // Fetch requests when location and driver profile are available
    useEffect(() => {
        if (location && driverProfile?.vehicle_type) {
            fetchRequests();

            // Subscribe to real-time updates - filtered by vehicle type
            const unsubscribe = subscribeToAvailableBookings(
                driverProfile.vehicle_type,
                (newBooking: Booking) => {
                    setRequests(prev => [newBooking, ...prev]);
                },
                (removedBookingId: string) => {
                    setRequests(prev => prev.filter(b => b.id !== removedBookingId));
                },
                (updatedBooking: Booking) => {
                    // Customer retried with tip - update driver_payout, tip_amount, expires_at
                    setRequests(prev => {
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

        console.log('[HANDLE ACCEPT] Calling acceptBooking...');
        const { success, error } = await acceptBooking(id, driverProfile.id);
        
        console.log('[HANDLE ACCEPT] Accept result:', { success, error });
        
        if (success) {
            console.log('[HANDLE ACCEPT] Booking accepted successfully');
            console.log('[HANDLE ACCEPT] Navigating to /ride/' + id);
            Alert.alert("Success", "Booking accepted! Navigate to pickup location.");
            // Navigate to active ride screen
            router.push(`/ride/${id}`);
            console.log('[HANDLE ACCEPT] Navigation triggered');
        } else {
            console.error('[HANDLE ACCEPT] Failed to accept:', error);
            Alert.alert("Error", error || "Failed to accept booking. It might have been taken.");
            // Refresh list
            fetchRequests();
        }
    };

    const handleReject = async (id: string) => {
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
                          setRequests(prev => prev.filter(r => r.id !== id));
                          
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

    if (loading && !requests.length) {
        return (
            <SafeAreaView className="flex-1 bg-white justify-center items-center">
                <ActivityIndicator size="large" color="#22c55e" />
                <Text className="text-white mt-4">Finding nearby requests...</Text>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-white">
            <View className="p-5">
                <Text className="text-gray-900 text-2xl font-JakartaBold mb-2">{t('rideRequests')}</Text>
                <Text className="text-gray-500 mb-4">
                    {requests.length} {requests.length === 1 ? t('request') : t('requests')} {t('availableNearby')}
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
                        <Text className="text-gray-900 text-xl font-JakartaBold mb-2">{t('noRequestsTitle')}</Text>
                        <Text className="text-gray-500 text-center">
                            {t('newRideRequestsAppear')}{'\n'}{t('makeSureOnline')}
                        </Text>
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
};

export default DriverRequests;
