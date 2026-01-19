"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const AuthContext_1 = require("@/contexts/AuthContext");
const expo_router_1 = require("expo-router");
const react_native_1 = require("react-native");
const react_native_safe_area_context_1 = require("react-native-safe-area-context");
const vector_icons_1 = require("@expo/vector-icons");
const constants_1 = require("@/constants");
const react_1 = require("react");
const bookings_1 = require("@/lib/bookings");
const store_1 = require("@/store");
const SecureStore = __importStar(require("expo-secure-store"));
const { width: SCREEN_WIDTH } = react_native_1.Dimensions.get("window");
const Home = () => {
    const { profile } = (0, AuthContext_1.useAuth)();
    const { userAddress, userLatitude, userLongitude, setUserLocation } = (0, store_1.useLocationStore)();
    // State for multiple active bookings
    const [activeBookings, setActiveBookings] = (0, react_1.useState)([]);
    const [recentBookings, setRecentBookings] = (0, react_1.useState)([]);
    const [loading, setLoading] = (0, react_1.useState)(true);
    const [refreshing, setRefreshing] = (0, react_1.useState)(false);
    // Load saved location on mount
    (0, react_1.useEffect)(() => {
        const loadSavedLocation = async () => {
            try {
                const saved = await SecureStore.getItemAsync('user_pickup_preference');
                if (saved) {
                    const parsed = JSON.parse(saved);
                    if (parsed && parsed.address) {
                        setUserLocation({
                            latitude: parsed.latitude,
                            longitude: parsed.longitude,
                            address: parsed.address
                        });
                    }
                }
            }
            catch (error) {
                console.error('Failed to load saved location:', error);
            }
        };
        loadSavedLocation();
    }, []);
    // Save location whenever it changes
    (0, react_1.useEffect)(() => {
        const saveLocation = async () => {
            if (userAddress && userLatitude && userLongitude) {
                try {
                    await SecureStore.setItemAsync('user_pickup_preference', JSON.stringify({
                        latitude: userLatitude,
                        longitude: userLongitude,
                        address: userAddress
                    }));
                }
                catch (error) {
                    console.error('Failed to save location:', error);
                }
            }
        };
        saveLocation();
    }, [userAddress, userLatitude, userLongitude]);
    const fetchBookings = (0, react_1.useCallback)(async () => {
        if (!(profile === null || profile === void 0 ? void 0 : profile.id)) {
            console.log('[HOME] No profile ID, skipping fetch');
            setLoading(false);
            return;
        }
        console.log('[HOME] Fetching bookings for customer:', profile.id);
        try {
            const { data, error } = await (0, bookings_1.getCustomerBookings)(profile.id);
            if (data && !error) {
                // Find ALL active bookings (accepted, driver arrived, pending, in progress)
                // We exclude 'pending' if you only want to show assigned rides, but usually pending is also "active"
                const active = data.filter(b => b.status === 'pending' ||
                    b.status === 'accepted' ||
                    b.status === 'driver_arrived' ||
                    b.status === 'in_progress');
                console.log('[HOME] Active bookings count:', active.length);
                setActiveBookings(active);
                // Get recent completed bookings for history
                const recentCompleted = data
                    .filter(b => b.status === 'completed' || b.status === 'cancelled')
                    .slice(0, 5);
                setRecentBookings(recentCompleted);
            }
        }
        catch (err) {
            console.error('[HOME] Error fetching bookings:', err);
        }
        finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [profile === null || profile === void 0 ? void 0 : profile.id]);
    const onRefresh = (0, react_1.useCallback)(() => {
        console.log('[HOME] Manual refresh triggered');
        setRefreshing(true);
        fetchBookings();
    }, [fetchBookings]);
    (0, react_1.useEffect)(() => {
        fetchBookings();
    }, [fetchBookings]);
    // Format date for cards
    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short'
        });
    };
    // Get status color
    const getStatusColor = (status) => {
        switch (status) {
            case 'completed': return { bg: '#E8F5E9', text: '#4CAF50' };
            case 'in_progress': return { bg: '#FFF3E0', text: '#FF9800' };
            case 'cancelled': return { bg: '#FFEBEE', text: '#F44336' };
            case 'pending': return { bg: '#E3F2FD', text: '#2196F3' };
            default: return { bg: '#F5F5F5', text: '#757575' };
        }
    };
    return (<react_native_safe_area_context_1.SafeAreaView className="flex-1 bg-general-900" edges={['bottom', 'left', 'right']}>
      <react_native_1.ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }} refreshControl={<react_native_1.RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF9800" colors={["#FF9800"]}/>}>
        {/* Horizontal Banner (Replaces Header) */}
        <react_native_1.View className="w-full items-center">
          <react_native_1.Image source={constants_1.images.homeBanner} className="w-full h-64" resizeMode="contain"/>
        </react_native_1.View>

        {/* Pickup Location Field (Auto-detected/Preferred) */}
        <react_native_1.View className="mx-5 -mt-4">
          <react_native_1.Text className="text-xs font-JakartaBold text-gray-500 mb-2 uppercase tracking-wider">
            Pick up from
          </react_native_1.Text>
          <react_native_1.TouchableOpacity onPress={() => expo_router_1.router.push("/find-ride")} className="flex-row items-center bg-white rounded-2xl p-4 shadow-sm border border-brand-100" activeOpacity={0.7}>
            <react_native_1.View className="w-10 h-10 bg-brand-100 rounded-full items-center justify-center mr-3">
              <vector_icons_1.Ionicons name="location" size={20} color="#FF9800"/>
            </react_native_1.View>
            <react_native_1.View className="flex-1">
              <react_native_1.Text className="text-black font-JakartaBold text-sm" numberOfLines={1}>
                {userAddress || "Detecting location..."}
              </react_native_1.Text>
              <react_native_1.Text className="text-gray-400 text-xs font-JakartaMedium mt-0.5">
                Put your preferred location
              </react_native_1.Text>
            </react_native_1.View>
            <vector_icons_1.Feather name="edit-2" size={16} color="#A0A0A0"/>
          </react_native_1.TouchableOpacity>
        </react_native_1.View>

        {/* Search Bar */}
        <react_native_1.TouchableOpacity onPress={() => expo_router_1.router.push("/find-ride")} className="mx-5 mt-4 flex-row items-center bg-white rounded-2xl p-4 shadow-sm border border-gray-100" activeOpacity={0.8}>
          <react_native_1.View className="w-10 h-10 bg-gray-100 rounded-xl items-center justify-center">
            <vector_icons_1.Feather name="search" size={18} color="#A0A0A0"/>
          </react_native_1.View>
          <react_native_1.Text className="flex-1 ml-3 font-JakartaMedium text-gray-400">
            Where are you sending?
          </react_native_1.Text>
          <react_native_1.View className="w-10 h-10 bg-black rounded-xl items-center justify-center">
             <vector_icons_1.Feather name="arrow-right" size={18} color="white"/>
          </react_native_1.View>
        </react_native_1.TouchableOpacity>

        {/* Current Shipments Section */}
        {loading ? (<react_native_1.View className="mt-8 items-center py-10">
            <react_native_1.ActivityIndicator size="large" color="#FF9800"/>
            <react_native_1.Text className="text-gray-500 font-JakartaMedium mt-3">Loading shipments...</react_native_1.Text>
          </react_native_1.View>) : activeBookings.length > 0 ? (<>
            {/* Current Shipment Header */}
            <react_native_1.View className="mx-5 mt-8 flex-row items-center justify-between mb-4">
              <react_native_1.Text className="text-lg font-JakartaBold text-black">Current Shipments</react_native_1.Text>
              <react_native_1.TouchableOpacity onPress={() => expo_router_1.router.push("/(tabs)/rides")}>
                <react_native_1.Text className="text-brand-500 font-JakartaMedium text-sm">See All</react_native_1.Text>
              </react_native_1.TouchableOpacity>
            </react_native_1.View>

            {/* Active Bookings Horizontal Scroll */}
            <react_native_1.ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 15 }}>
              {activeBookings.map((booking) => {
                var _a, _b;
                const statusInfo = getStatusColor(booking.status);
                const isPending = booking.status === 'pending';
                return (<react_native_1.TouchableOpacity key={booking.id} activeOpacity={0.9} className="bg-white rounded-3xl overflow-hidden shadow-md border border-gray-100" style={{ width: SCREEN_WIDTH * 0.85 }} onPress={() => expo_router_1.router.push({
                        pathname: "/track-ride",
                        params: { bookingId: booking.id }
                    })}>
                    {/* Card Header with Status */}
                    <react_native_1.View className="p-5 pb-0">
                      <react_native_1.View className="flex-row items-center justify-between">
                        <react_native_1.View className="flex-row items-center">
                          <react_native_1.View className={`px-3 py-1.5 rounded-full flex-row items-center`} style={{ backgroundColor: statusInfo.bg }}>
                            <react_native_1.View className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: statusInfo.text }}/>
                            <react_native_1.Text className="text-xs font-JakartaBold capitalize" style={{ color: statusInfo.text }}>
                              {booking.status.replace('_', ' ')}
                            </react_native_1.Text>
                          </react_native_1.View>
                          {booking.estimated_duration && (<react_native_1.Text className="text-gray-400 text-xs font-JakartaMedium ml-3">
                              ~{booking.estimated_duration} min
                            </react_native_1.Text>)}
                        </react_native_1.View>
                        <react_native_1.TouchableOpacity className="w-8 h-8 bg-gray-100 rounded-full items-center justify-center">
                          <vector_icons_1.Feather name="chevron-right" size={16} color="#666"/>
                        </react_native_1.TouchableOpacity>
                      </react_native_1.View>
                    </react_native_1.View>

                    {/* Truck Image */}
                    <react_native_1.View className="items-center py-2">
                       <react_native_1.Image source={constants_1.images.truckTransparent} className="w-40 h-24" resizeMode="contain"/>
                    </react_native_1.View>

                    {/* Show Progress Bar only if active (not pending) */}
                    {!isPending && (<react_native_1.View className="px-5">
                            <react_native_1.View className="h-1.5 bg-gray-100 rounded-full relative flex-row items-center overflow-hidden">
                            <react_native_1.View className="w-2/3 h-full bg-orange-400 rounded-full"/>
                            </react_native_1.View>
                        </react_native_1.View>)}

                    {/* Locations */}
                    <react_native_1.View className="px-5 pt-4 pb-2 flex-row justify-between">
                      <react_native_1.View className="flex-1 pr-2">
                        <react_native_1.View className="flex-row items-center mb-1">
                          <react_native_1.View className="w-2 h-2 bg-brand-500 rounded-full mr-2"/>
                          <react_native_1.Text className="text-gray-400 text-xs font-JakartaMedium">From</react_native_1.Text>
                        </react_native_1.View>
                        <react_native_1.Text className="text-black font-JakartaBold text-sm" numberOfLines={1}>
                          {booking.origin_address}
                        </react_native_1.Text>
                      </react_native_1.View>
                      <react_native_1.View className="flex-1 items-end pl-2">
                        <react_native_1.View className="flex-row items-center mb-1">
                          <react_native_1.View className="w-2 h-2 bg-green-500 rounded-full mr-2"/>
                          <react_native_1.Text className="text-gray-400 text-xs font-JakartaMedium">To</react_native_1.Text>
                        </react_native_1.View>
                        <react_native_1.Text className="text-black font-JakartaBold text-sm text-right" numberOfLines={1}>
                          {booking.destination_address}
                        </react_native_1.Text>
                      </react_native_1.View>
                    </react_native_1.View>
                    
                    {/* Footer */}
                    <react_native_1.View className="mt-4 flex-row items-center justify-between bg-gray-50 p-4 border-t border-gray-100">
                      <react_native_1.View className="flex-row items-center flex-1">
                        <react_native_1.View className="w-8 h-8 bg-gray-200 rounded-full items-center justify-center mr-3">
                          <vector_icons_1.Feather name={isPending ? "clock" : "user"} size={16} color="#666"/>
                        </react_native_1.View>
                        <react_native_1.View className="flex-1">
                          <react_native_1.Text className="text-gray-500 text-[10px] font-JakartaMedium uppercase">
                            {isPending ? 'Finding Driver...' : 'Driver'}
                          </react_native_1.Text>
                          <react_native_1.Text className="text-black font-JakartaSemiBold text-sm">
                            {isPending ? 'Waiting for acceptance' : (((_b = (_a = booking.driver) === null || _a === void 0 ? void 0 : _a.user) === null || _b === void 0 ? void 0 : _b.name) || 'Assigned')}
                          </react_native_1.Text>
                        </react_native_1.View>
                      </react_native_1.View>
                      <react_native_1.View>
                          <react_native_1.Text className="text-xs text-gray-400 font-JakartaMedium text-right">Fare</react_native_1.Text>
                          <react_native_1.Text className="text-brand-500 font-JakartaBold text-lg">₹{booking.total_fare}</react_native_1.Text>
                      </react_native_1.View>
                    </react_native_1.View>
                  </react_native_1.TouchableOpacity>);
            })}
            </react_native_1.ScrollView>
          </>) : (
        /* Empty State - No Active Shipment */
        <react_native_1.View className="mx-5 mt-8 bg-white rounded-3xl p-6 items-center shadow-sm">
            <react_native_1.View className="w-full h-32 items-center justify-center mb-4">
              <react_native_1.Image source={constants_1.images.truckTransparent} className="w-40 h-32" resizeMode="contain"/>
            </react_native_1.View>
            <react_native_1.Text className="text-gray-800 font-JakartaBold text-xl text-center mb-2">
              No Active Deliveries
            </react_native_1.Text>
            <react_native_1.Text className="text-gray-500 font-JakartaMedium text-sm text-center mb-5 px-4">
              You don't have any shipments in transit right now. Book a delivery to get started!
            </react_native_1.Text>
            <react_native_1.TouchableOpacity onPress={() => expo_router_1.router.push("/find-ride")} className="bg-brand-500 w-full py-4 rounded-2xl flex-row items-center justify-center shadow-md" activeOpacity={0.8}>
              <vector_icons_1.MaterialIcons name="local-shipping" size={20} color="white"/>
              <react_native_1.Text className="text-white font-JakartaBold ml-2">Book Delivery</react_native_1.Text>
            </react_native_1.TouchableOpacity>
          </react_native_1.View>)}

        {/* Recent Shipments Section */}
        {recentBookings.length > 0 && (<>
            <react_native_1.View className="mx-5 mt-8 flex-row items-center justify-between mb-4">
              <react_native_1.Text className="text-lg font-JakartaBold text-black">Recent History</react_native_1.Text>
              <react_native_1.TouchableOpacity onPress={() => expo_router_1.router.push("/(tabs)/rides")}>
                <react_native_1.Text className="text-brand-500 font-JakartaMedium text-sm">See All</react_native_1.Text>
              </react_native_1.TouchableOpacity>
            </react_native_1.View>

            <react_native_1.ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}>
              {recentBookings.map((booking) => {
                var _a;
                const statusStyle = getStatusColor(booking.status);
                return (<react_native_1.TouchableOpacity key={booking.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100" style={{ width: SCREEN_WIDTH * 0.7 }} onPress={() => expo_router_1.router.push({
                        pathname: "/track-ride",
                        params: { bookingId: booking.id }
                    })} activeOpacity={0.8}>
                    <react_native_1.View className="flex-row items-center justify-between mb-3">
                      <react_native_1.View className="px-3 py-1 rounded-full" style={{ backgroundColor: statusStyle.bg }}>
                        <react_native_1.Text className="text-xs font-JakartaBold capitalize" style={{ color: statusStyle.text }}>
                          {booking.status.replace('_', ' ')}
                        </react_native_1.Text>
                      </react_native_1.View>
                      <react_native_1.Text className="text-gray-400 text-xs font-JakartaMedium">
                        {formatDate(booking.created_at)}
                      </react_native_1.Text>
                    </react_native_1.View>
                    
                    <react_native_1.Text className="text-gray-500 text-xs font-JakartaMedium mb-1">
                      {booking.booking_number || `#${booking.id.slice(0, 8).toUpperCase()}`}
                    </react_native_1.Text>
                    
                    <react_native_1.View className="flex-row items-center mt-2">
                      <react_native_1.View className="w-2 h-2 bg-brand-500 rounded-full"/>
                      <react_native_1.Text className="text-gray-700 font-JakartaMedium text-sm ml-2 flex-1" numberOfLines={1}>
                        {booking.origin_address}
                      </react_native_1.Text>
                    </react_native_1.View>
                    
                    <react_native_1.View className="flex-row items-center mt-2">
                      <react_native_1.View className="w-2 h-2 bg-green-500 rounded-full"/>
                      <react_native_1.Text className="text-gray-700 font-JakartaMedium text-sm ml-2 flex-1" numberOfLines={1}>
                        {booking.destination_address}
                      </react_native_1.Text>
                    </react_native_1.View>

                    <react_native_1.View className="flex-row items-center justify-between mt-4 pt-3 border-t border-gray-100">
                      <react_native_1.Text className="text-black font-JakartaBold">
                        ₹{((_a = booking.total_fare) === null || _a === void 0 ? void 0 : _a.toFixed(0)) || '0'}
                      </react_native_1.Text>
                      <react_native_1.View className="flex-row items-center">
                        <vector_icons_1.Feather name="chevron-right" size={16} color="#999"/>
                      </react_native_1.View>
                    </react_native_1.View>
                  </react_native_1.TouchableOpacity>);
            })}
            </react_native_1.ScrollView>
          </>)}

      </react_native_1.ScrollView>
    </react_native_safe_area_context_1.SafeAreaView>);
};
exports.default = Home;
