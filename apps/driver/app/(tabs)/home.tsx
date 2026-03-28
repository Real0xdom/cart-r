import { View, Text, TouchableOpacity, ScrollView, Switch, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useState, useEffect, useRef } from 'react';
import { router } from 'expo-router';
import { startLocationTracking, stopLocationTracking, requestLocationPermissions, checkLocationServices } from '@/lib/location';
import { getDriverActiveBookings, getDriverActiveBooking, getDriverCompletedTrips, Booking } from '@/lib/bookings';
import {
    checkDriverWalletEligibility,
    getDriverWalletInfo,
    getDriverWalletRechargeNavigationTarget,
    DriverWalletInfoResponse,
} from '@/lib/wallet';
import WalletBalanceCard from '@/components/WalletBalanceCard';
import * as Location from 'expo-location';
import { refreshLocationTrackingNotification } from '@/lib/location';

let lastAutoNavigatedBookingId: string | null = null;

const DriverHome = () => {
    const { driverProfile, toggleDriverOnline, profile } = useAuth();
    const { t } = useLanguage();
    const [isOnline, setIsOnline] = useState(driverProfile?.is_online || false);
    const [isTogglingStatus, setIsTogglingStatus] = useState(false);
    const [activeBookings, setActiveBookings] = useState<Booking[]>([]);
    const [isRidesExpanded, setIsRidesExpanded] = useState(true);
    const [todayStats, setTodayStats] = useState({ earnings: 0, trips: 0 });
    const [isLoadingStats, setIsLoadingStats] = useState(true);
    const [walletInfo, setWalletInfo] = useState<DriverWalletInfoResponse | null>(null);
    const [isLoadingWallet, setIsLoadingWallet] = useState(true);
    const [isRefreshingWallet, setIsRefreshingWallet] = useState(false);
    const [location, setLocation] = useState<{latitude: number, longitude: number} | null>(null);
    const hasLoadedWalletRef = useRef(false);
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

    // Check for active booking and fetch today's stats
    useEffect(() => {
        if (!driverProfile?.id) return;

        const fetchData = async () => {
            // Check for active bookings (all of them)
            const { data: activeRides } = await getDriverActiveBookings(driverProfile.id);
            if (activeRides) {
                setActiveBookings(activeRides);

                if (activeRides.length !== 1) {
                    lastAutoNavigatedBookingId = null;
                }

                // Auto-navigate to active ride on app launch/crash recovery
                if (activeRides.length === 1 && lastAutoNavigatedBookingId !== activeRides[0].id) {
                    lastAutoNavigatedBookingId = activeRides[0].id;
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

    useEffect(() => {
        if (!driverProfile?.id) return;

        const loadWallet = async () => {
            try {
                if (hasLoadedWalletRef.current) {
                    setIsRefreshingWallet(true);
                } else {
                    setIsLoadingWallet(true);
                }
                const { data } = await getDriverWalletInfo(driverProfile.id);
                setWalletInfo(data);
                hasLoadedWalletRef.current = true;
            } catch (error) {
                console.error('Failed to load wallet:', error);
            } finally {
                setIsLoadingWallet(false);
                setIsRefreshingWallet(false);
            }
        };

        loadWallet();

        const interval = setInterval(loadWallet, 30000);
        return () => clearInterval(interval);
    }, [driverProfile?.id]);

    const openRechargeFlow = () => {
        router.push(getDriverWalletRechargeNavigationTarget() as any);
    };

    const openWithdrawFlow = () => {
        if (!walletInfo?.wallet) {
            return;
        }

        if (Number(walletInfo.wallet.available_balance || 0) <= 0) {
            Alert.alert('No Balance', 'You have no available balance to withdraw right now.');
            return;
        }

        if (Number(walletInfo.wallet.pending_withdrawals || 0) > 0) {
            Alert.alert(
                'Pending Withdrawal',
                'You already have a pending withdrawal request. Please wait for it to be processed before requesting another.'
            );
            return;
        }

        if (!walletInfo.wallet.bank_details || !walletInfo.wallet.bank_details.account_number) {
            Alert.alert(
                'Bank Account Required',
                'Please add your bank account details first to enable withdrawals.',
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Add Bank', onPress: () => router.push('/profile/bank') },
                ]
            );
            return;
        }

        router.push({
            pathname: '/(tabs)/earnings',
            params: { openWithdraw: '1' },
        } as any);
    };

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

        if (value && !driverProfile?.id) {
            Alert.alert(
                t('error'),
                t('driverProfileNotFound') || 'Driver profile not found.'
            );
            return;
        }

        const driverId = driverProfile?.id;

        setIsTogglingStatus(true);

        try {
            if (value) {
                const eligibility = await checkDriverWalletEligibility(driverId as string);
                console.log('[HOME] Go-online wallet eligibility:', eligibility);

                if (!eligibility.canAcceptRides) {
                    Alert.alert(
                        'Wallet Recharge Required',
                        `Your wallet balance is \u20b9${eligibility.currentBalance.toFixed(2)}.\n\nRecharge \u20b9${(eligibility.requiredRecharge || 0).toFixed(0)} to clear commission debt and resume accepting new rides.`,
                        [
                            { text: 'Cancel', style: 'cancel' },
                            {
                                text: 'Recharge Now',
                                onPress: openRechargeFlow,
                            },
                        ]
                    );
                    return;
                }
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
                </View>

                {/* Online Status Card */}
                <View className={`rounded-[24px] p-5 mb-6 border overflow-hidden ${
                    isOnline ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'
                }`}>
                    <View className={`absolute -top-8 -right-6 w-24 h-24 rounded-full ${
                        isOnline ? 'bg-emerald-100' : 'bg-slate-200'
                    }`} />
                    <View className={`absolute -bottom-10 -left-8 w-24 h-24 rounded-full ${
                        isOnline ? 'bg-emerald-100/80' : 'bg-slate-200/80'
                    }`} />
                    <View className="flex-row justify-between items-start">
                        <View className="flex-1 mr-4">
                            <Text className="text-gray-500 text-xs uppercase tracking-[1px] mb-2">{t('status')}</Text>
                            <View className="flex-row items-center mb-2">
                                <View className={`w-2.5 h-2.5 rounded-full mr-2 ${
                                    isOnline ? 'bg-emerald-500' : 'bg-slate-400'
                                }`} />
                                <Text className={`text-[28px] font-JakartaBold ${
                                    isOnline ? 'text-emerald-700' : 'text-slate-700'
                                }`}>
                                    {isOnline ? t('online') : t('offline')}
                                </Text>
                            </View>
                            <Text className={`text-sm leading-5 ${
                                isOnline ? 'text-emerald-700/80' : 'text-slate-600'
                            }`}>
                                {isTogglingStatus
                                    ? t('updatingStatus')
                                    : isOnline
                                        ? t('visibleToCustomers')
                                        : t('goOnlineToReceive')}
                            </Text>
                        </View>

                        <View className={`rounded-2xl px-3 py-3 min-w-[112px] items-center border ${
                            isOnline ? 'bg-white/80 border-emerald-200' : 'bg-white/90 border-slate-200'
                        }`}>
                            <Text className={`text-[11px] font-JakartaBold mb-2 uppercase ${
                                isOnline ? 'text-emerald-600' : 'text-slate-500'
                            }`}>
                                {isOnline ? 'Enabled' : 'Disabled'}
                            </Text>
                            <Switch
                                testID="driver.toggleOnline"
                                accessibilityLabel="driver.toggleOnline"
                                value={isOnline}
                                onValueChange={handleToggleOnline}
                                trackColor={{ false: '#cbd5e1', true: '#10b981' }}
                                thumbColor="#ffffff"
                                disabled={isTogglingStatus}
                            />
                        </View>
                    </View>
                </View>

                <WalletBalanceCard
                    walletInfo={walletInfo}
                    isLoading={isLoadingWallet}
                    isRefreshing={isRefreshingWallet}
                    onPressAddMoney={openRechargeFlow}
                    onPressWithdraw={openWithdrawFlow}
                    onPressDetails={() => router.push('/(tabs)/earnings')}
                />

                {!!walletInfo?.wallet?.requires_recharge && (
                    <View className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6">
                        <View className="flex-row items-start">
                            <Ionicons name="alert-circle-outline" size={22} color="#d97706" />
                            <View className="flex-1 ml-3">
                                <Text className="text-amber-900 font-JakartaBold text-base">Wallet recharge required</Text>
                                <Text className="text-amber-800 text-sm mt-1">
                                    Balance: {'\u20b9'}{Number(walletInfo.wallet.available_balance || 0).toFixed(2)}. Recharge your wallet before going online or accepting a new ride.
                                </Text>
                                <TouchableOpacity
                                    onPress={openRechargeFlow}
                                    className="mt-3 self-start bg-amber-500 px-4 py-2 rounded-xl"
                                >
                                    <Text className="text-white font-JakartaBold">Recharge Now</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                )}

                {/* Today's Stats */}
                <Text className="text-gray-900 text-xl font-JakartaBold mb-4">{t('todaysSummary')}</Text>
                <View className="mb-6">
                    <View className="bg-[#EFF6FF] p-5 rounded-[24px] border border-[#BFDBFE] mb-3 overflow-hidden">
                        <View className="absolute -top-8 -right-6 w-24 h-24 rounded-full bg-blue-200/50" />
                        <View className="flex-row justify-between items-start">
                            <View className="flex-1 mr-4">
                        <Text className="text-blue-700 text-xs uppercase tracking-[1px] mb-2">Earnings</Text>
                        {isLoadingStats ? (
                            <ActivityIndicator size="small" color="#2563eb" />
                        ) : (
                            <Text className="text-gray-900 text-2xl font-JakartaBold">
                                ₹{todayStats.earnings.toLocaleString()}
                            </Text>
                        )}
                                <Text className="text-blue-700/80 text-sm mt-2">
                                    Today's completed trip earnings
                                </Text>
                            </View>
                            <View className="w-12 h-12 rounded-2xl bg-white/80 items-center justify-center border border-blue-100">
                                <Ionicons name="cash-outline" size={24} color="#2563eb" />
                            </View>
                        </View>
                    </View>
                    <View className="flex-row gap-3">
                    <View className="flex-1 bg-[#F5F3FF] px-3 py-2.5 rounded-[16px] border border-[#DDD6FE]">
                        <View className="w-7 h-7 rounded-lg bg-white/80 items-center justify-center border border-purple-100 mb-2">
                            <Ionicons name="car-outline" size={15} color="#7c3aed" />
                        </View>
                        <Text className="text-purple-700 text-[11px] uppercase tracking-[1px] mb-1">{t('trips')}</Text>
                        {isLoadingStats ? (
                            <ActivityIndicator size="small" color="#7c3aed" />
                        ) : (
                            <Text className="text-gray-900 text-[22px] font-JakartaBold">{todayStats.trips}</Text>
                        )}
                        <Text className="text-purple-700/80 text-[10px] mt-1">Trips completed today</Text>
                    </View>
                    <View className="flex-1 bg-[#ECFDF5] px-3 py-2.5 rounded-[16px] border border-[#BBF7D0]">
                        <View className="w-7 h-7 rounded-lg bg-white/80 items-center justify-center border border-emerald-100 mb-2">
                            <Ionicons name="star-outline" size={15} color="#16a34a" />
                        </View>
                        <Text className="text-emerald-700 text-[11px] uppercase tracking-[1px] mb-1">Rating</Text>
                        <Text className="text-gray-900 text-[22px] font-JakartaBold">
                            {driverProfile?.rating?.toFixed(1) || '5.0'}
                        </Text>
                        <Text className="text-emerald-700/80 text-[10px] mt-1">Current driver rating</Text>
                    </View>
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
