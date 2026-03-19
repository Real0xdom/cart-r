"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const react_native_1 = require("react-native");
const react_native_safe_area_context_1 = require("react-native-safe-area-context");
const AuthContext_1 = require("@/contexts/AuthContext");
const react_1 = require("react");
const expo_router_1 = require("expo-router");
const location_1 = require("@/lib/location");
const bookings_1 = require("@/lib/bookings");
const DriverHome = () => {
    var _a;
    const { signOut, driverProfile, toggleDriverOnline, profile } = (0, AuthContext_1.useAuth)();
    const [isOnline, setIsOnline] = (0, react_1.useState)((driverProfile === null || driverProfile === void 0 ? void 0 : driverProfile.is_online) || false);
    const [isTogglingStatus, setIsTogglingStatus] = (0, react_1.useState)(false);
    const [activeBooking, setActiveBooking] = (0, react_1.useState)(null);
    const [todayStats, setTodayStats] = (0, react_1.useState)({ earnings: 0, trips: 0 });
    const [isLoadingStats, setIsLoadingStats] = (0, react_1.useState)(true);
    (0, react_1.useEffect)(() => {
        setIsOnline((driverProfile === null || driverProfile === void 0 ? void 0 : driverProfile.is_online) || false);
    }, [driverProfile]);
    // Check for active booking and fetch today's stats
    (0, react_1.useEffect)(() => {
        if (!(driverProfile === null || driverProfile === void 0 ? void 0 : driverProfile.id))
            return;
        const fetchData = async () => {
            // Check for active booking
            const { data: activeRide } = await (0, bookings_1.getDriverActiveBooking)(driverProfile.id);
            if (activeRide) {
                setActiveBooking(activeRide);
            }
            // Fetch today's stats
            const { data: trips } = await (0, bookings_1.getDriverCompletedTrips)(driverProfile.id, 50);
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
    }, [driverProfile === null || driverProfile === void 0 ? void 0 : driverProfile.id]);
    const handleToggleOnline = async (value) => {
        setIsTogglingStatus(true);
        try {
            if (value) {
                // Going online - request permissions and start tracking
                const hasPermissions = await (0, location_1.requestLocationPermissions)();
                if (!hasPermissions) {
                    react_native_1.Alert.alert('Location Permission Required', 'Please enable location access to go online and receive ride requests.', [{ text: 'OK' }]);
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
                    if (location && (profile === null || profile === void 0 ? void 0 : profile.id)) {
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
                }
                catch (locError) {
                    console.error('Failed to set initial location:', locError);
                }
                // Register push token for notifications
                try {
                    const { registerPushToken } = require('@/lib/notifications');
                    const { supabase } = require('@/lib/supabase');
                    if (profile === null || profile === void 0 ? void 0 : profile.id) {
                        await registerPushToken(supabase, profile.id);
                    }
                }
                catch (pushError) {
                    console.error('Failed to register push token:', pushError);
                }
                // Start background location tracking
                await (0, location_1.startLocationTracking)();
            }
            else {
                // Going offline - stop tracking
                await (0, location_1.stopLocationTracking)();
                setIsOnline(value);
                await toggleDriverOnline(value);
            }
        }
        catch (error) {
            console.error('Failed to toggle online status:', error);
            react_native_1.Alert.alert('Error', 'Failed to update online status. Please try again.');
        }
        finally {
            setIsTogglingStatus(false);
        }
    };
    const navigateToActiveRide = () => {
        if (activeBooking) {
            expo_router_1.router.push(`/ride/${activeBooking.id}`);
        }
    };
    return (<react_native_safe_area_context_1.SafeAreaView className="flex-1 bg-gray-900">
            <react_native_1.ScrollView className="p-5" contentContainerStyle={{ paddingBottom: 100 }}>
                {/* Header */}
                <react_native_1.View className="flex-row justify-between items-center mb-6">
                    <react_native_1.View>
                        <react_native_1.Text className="text-gray-400 text-sm">Welcome back,</react_native_1.Text>
                        <react_native_1.Text className="text-white text-2xl font-JakartaBold">
                            {(profile === null || profile === void 0 ? void 0 : profile.name) || 'Driver'}
                        </react_native_1.Text>
                    </react_native_1.View>
                    <react_native_1.TouchableOpacity onPress={signOut} className="bg-red-500/20 px-4 py-2 rounded-full">
                        <react_native_1.Text className="text-red-400 font-JakartaSemiBold">Logout</react_native_1.Text>
                    </react_native_1.TouchableOpacity>
                </react_native_1.View>

                {/* Active Ride Banner */}
                {activeBooking && (<react_native_1.TouchableOpacity onPress={navigateToActiveRide} className="bg-blue-500 rounded-2xl p-4 mb-6 flex-row items-center">
                        <react_native_1.View className="w-12 h-12 bg-blue-400 rounded-full items-center justify-center mr-4">
                            <react_native_1.Text className="text-2xl">🚗</react_native_1.Text>
                        </react_native_1.View>
                        <react_native_1.View className="flex-1">
                            <react_native_1.Text className="text-white font-JakartaBold text-lg">Active Ride</react_native_1.Text>
                            <react_native_1.Text className="text-blue-100 text-sm" numberOfLines={1}>
                                {activeBooking.status === 'accepted' && 'Head to pickup →'}
                                {activeBooking.status === 'driver_arrived' && 'Verify OTP to start →'}
                                {activeBooking.status === 'in_progress' && 'Trip in progress →'}
                            </react_native_1.Text>
                        </react_native_1.View>
                        <react_native_1.Text className="text-white text-2xl">›</react_native_1.Text>
                    </react_native_1.TouchableOpacity>)}

                {/* Online Status Card */}
                <react_native_1.View className="bg-gray-800 p-6 rounded-2xl mb-6">
                    <react_native_1.View className="flex-row justify-between items-center">
                        <react_native_1.View>
                            <react_native_1.Text className="text-gray-400 text-sm mb-1">Status</react_native_1.Text>
                            <react_native_1.Text className={`text-2xl font-JakartaBold ${isOnline ? 'text-green-400' : 'text-red-400'}`}>
                                {isOnline ? '🟢 Online' : '🔴 Offline'}
                            </react_native_1.Text>
                        </react_native_1.View>
                        <react_native_1.Switch value={isOnline} onValueChange={handleToggleOnline} trackColor={{ false: '#374151', true: '#22c55e' }} thumbColor={isOnline ? '#ffffff' : '#9ca3af'} disabled={isTogglingStatus}/>
                    </react_native_1.View>
                    <react_native_1.Text className="text-gray-500 text-sm mt-3">
                        {isTogglingStatus
            ? 'Updating status...'
            : isOnline
                ? 'You are visible to customers • GPS active'
                : 'Go online to receive ride requests'}
                    </react_native_1.Text>
                </react_native_1.View>

                {/* Today's Stats */}
                <react_native_1.Text className="text-white text-xl font-JakartaBold mb-4">Today's Summary</react_native_1.Text>
                <react_native_1.View className="flex-row gap-3 mb-6">
                    <react_native_1.View className="flex-1 bg-blue-500/20 p-4 rounded-xl">
                        <react_native_1.Text className="text-blue-400 text-sm mb-1">Earnings</react_native_1.Text>
                        {isLoadingStats ? (<react_native_1.ActivityIndicator size="small" color="#60a5fa"/>) : (<react_native_1.Text className="text-white text-2xl font-JakartaBold">
                                ₹{todayStats.earnings.toLocaleString()}
                            </react_native_1.Text>)}
                    </react_native_1.View>
                    <react_native_1.View className="flex-1 bg-purple-500/20 p-4 rounded-xl">
                        <react_native_1.Text className="text-purple-400 text-sm mb-1">Trips</react_native_1.Text>
                        {isLoadingStats ? (<react_native_1.ActivityIndicator size="small" color="#a78bfa"/>) : (<react_native_1.Text className="text-white text-2xl font-JakartaBold">{todayStats.trips}</react_native_1.Text>)}
                    </react_native_1.View>
                    <react_native_1.View className="flex-1 bg-green-500/20 p-4 rounded-xl">
                        <react_native_1.Text className="text-green-400 text-sm mb-1">Rating</react_native_1.Text>
                        <react_native_1.Text className="text-white text-2xl font-JakartaBold">
                            {((_a = driverProfile === null || driverProfile === void 0 ? void 0 : driverProfile.rating) === null || _a === void 0 ? void 0 : _a.toFixed(1)) || '5.0'}
                        </react_native_1.Text>
                    </react_native_1.View>
                </react_native_1.View>

                {/* Quick Actions */}
                <react_native_1.Text className="text-white text-xl font-JakartaBold mb-4">Quick Actions</react_native_1.Text>
                <react_native_1.View className="gap-3">
                    <react_native_1.TouchableOpacity onPress={() => expo_router_1.router.push('/(tabs)/requests')} className="bg-gray-800 p-4 rounded-xl flex-row items-center">
                        <react_native_1.View className="w-12 h-12 bg-blue-500/20 rounded-full items-center justify-center mr-4">
                            <react_native_1.Text className="text-2xl">📋</react_native_1.Text>
                        </react_native_1.View>
                        <react_native_1.View className="flex-1">
                            <react_native_1.Text className="text-white font-JakartaSemiBold">View Requests</react_native_1.Text>
                            <react_native_1.Text className="text-gray-400 text-sm">Check available ride requests</react_native_1.Text>
                        </react_native_1.View>
                    </react_native_1.TouchableOpacity>

                    <react_native_1.TouchableOpacity onPress={() => expo_router_1.router.push('/(tabs)/earnings')} className="bg-gray-800 p-4 rounded-xl flex-row items-center">
                        <react_native_1.View className="w-12 h-12 bg-green-500/20 rounded-full items-center justify-center mr-4">
                            <react_native_1.Text className="text-2xl">💰</react_native_1.Text>
                        </react_native_1.View>
                        <react_native_1.View className="flex-1">
                            <react_native_1.Text className="text-white font-JakartaSemiBold">Earnings</react_native_1.Text>
                            <react_native_1.Text className="text-gray-400 text-sm">
                                Total: ₹{((driverProfile === null || driverProfile === void 0 ? void 0 : driverProfile.total_earnings) || 0).toLocaleString()}
                            </react_native_1.Text>
                        </react_native_1.View>
                    </react_native_1.TouchableOpacity>

                    <react_native_1.TouchableOpacity onPress={() => react_native_1.Alert.alert('Support', 'Contact us at drivers@cart-r.com')} className="bg-gray-800 p-4 rounded-xl flex-row items-center">
                        <react_native_1.View className="w-12 h-12 bg-orange-500/20 rounded-full items-center justify-center mr-4">
                            <react_native_1.Text className="text-2xl">📞</react_native_1.Text>
                        </react_native_1.View>
                        <react_native_1.View className="flex-1">
                            <react_native_1.Text className="text-white font-JakartaSemiBold">Support</react_native_1.Text>
                            <react_native_1.Text className="text-gray-400 text-sm">Get help from our team</react_native_1.Text>
                        </react_native_1.View>
                    </react_native_1.TouchableOpacity>
                </react_native_1.View>

            </react_native_1.ScrollView>
        </react_native_safe_area_context_1.SafeAreaView>);
};
exports.default = DriverHome;
