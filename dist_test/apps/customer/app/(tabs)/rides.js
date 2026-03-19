"use strict";
// Customer Trip History Screen
// Shows all past and current bookings
Object.defineProperty(exports, "__esModule", { value: true });
const AuthContext_1 = require("@/contexts/AuthContext");
const react_native_1 = require("react-native");
const react_native_safe_area_context_1 = require("react-native-safe-area-context");
const react_1 = require("react");
const expo_router_1 = require("expo-router");
const vector_icons_1 = require("@expo/vector-icons");
const constants_1 = require("@/constants");
const bookings_1 = require("@/lib/bookings");
// Status badge colors
const getStatusConfig = (status) => {
    switch (status) {
        case 'pending':
            return { label: 'Finding Driver', color: 'bg-yellow-500', textColor: 'text-yellow-500' };
        case 'accepted':
            return { label: 'Driver On The Way', color: 'bg-blue-500', textColor: 'text-blue-500' };
        case 'driver_arrived':
            return { label: 'Driver Arrived', color: 'bg-blue-500', textColor: 'text-blue-500' };
        case 'in_progress':
            return { label: 'In Transit', color: 'bg-green-500', textColor: 'text-green-500' };
        case 'completed':
            return { label: 'Completed', color: 'bg-gray-400', textColor: 'text-gray-500' };
        case 'cancelled':
            return { label: 'Cancelled', color: 'bg-red-500', textColor: 'text-red-500' };
        default:
            return { label: status, color: 'bg-gray-500', textColor: 'text-gray-500' };
    }
};
// Booking card component
const BookingCard = ({ booking, onPress }) => {
    const statusConfig = getStatusConfig(booking.status);
    const isActive = ['pending', 'accepted', 'driver_arrived', 'in_progress'].includes(booking.status);
    return (<react_native_1.TouchableOpacity onPress={onPress} className={`bg-white rounded-xl p-4 mb-3 border ${isActive ? 'border-green-200' : 'border-gray-100'} shadow-sm`}>
      {/* Header with status and date */}
      <react_native_1.View className="flex-row justify-between items-center mb-3">
        <react_native_1.View className={`${statusConfig.color} px-2 py-1 rounded-full`}>
          <react_native_1.Text className="text-white text-xs font-JakartaBold">{statusConfig.label}</react_native_1.Text>
        </react_native_1.View>
        <react_native_1.Text className="text-gray-400 text-xs font-JakartaMedium">
          {new Date(booking.created_at).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
        })}
        </react_native_1.Text>
      </react_native_1.View>

      {/* Route */}
      <react_native_1.View className="flex-row mb-3">
        <react_native_1.View className="items-center mr-3">
          <react_native_1.View className="w-3 h-3 bg-green-500 rounded-full"/>
          <react_native_1.View className="w-0.5 h-8 bg-gray-200"/>
          <react_native_1.View className="w-3 h-3 bg-red-500 rounded-full"/>
        </react_native_1.View>
        <react_native_1.View className="flex-1">
          <react_native_1.Text className="text-gray-800 font-JakartaMedium text-sm" numberOfLines={1}>
            {booking.origin_address}
          </react_native_1.Text>
          <react_native_1.View className="h-4"/>
          <react_native_1.Text className="text-gray-800 font-JakartaMedium text-sm" numberOfLines={1}>
            {booking.destination_address}
          </react_native_1.Text>
        </react_native_1.View>
      </react_native_1.View>

      {/* Footer with fare and vehicle */}
      <react_native_1.View className="flex-row justify-between items-center pt-3 border-t border-gray-100">
        <react_native_1.View className="flex-row items-center">
          <vector_icons_1.Feather name="truck" size={14} color="#6b7280"/>
          <react_native_1.Text className="ml-1 text-gray-500 text-xs capitalize font-JakartaMedium">
            {booking.vehicle_type}
          </react_native_1.Text>
          {booking.estimated_distance && (<>
              <react_native_1.Text className="text-gray-300 mx-2">•</react_native_1.Text>
              <react_native_1.Text className="text-gray-500 text-xs font-JakartaMedium">
                {booking.estimated_distance.toFixed(1)} km
              </react_native_1.Text>
            </>)}
        </react_native_1.View>
        <react_native_1.Text className="text-green-600 font-JakartaBold">
          ₹{booking.total_fare}
        </react_native_1.Text>
      </react_native_1.View>

      {/* Active trip indicator */}
      {isActive && (<react_native_1.View className="flex-row items-center mt-3 pt-3 border-t border-green-100 bg-green-50 -mx-4 -mb-4 px-4 py-3 rounded-b-xl">
          <react_native_1.View className="w-2 h-2 bg-green-500 rounded-full animate-pulse mr-2"/>
          <react_native_1.Text className="text-green-700 font-JakartaSemiBold text-sm flex-1">
            Tap to track your shipment
          </react_native_1.Text>
          <vector_icons_1.Feather name="chevron-right" size={18} color="#22c55e"/>
        </react_native_1.View>)}
    </react_native_1.TouchableOpacity>);
};
const Rides = () => {
    const { profile } = (0, AuthContext_1.useAuth)();
    const [bookings, setBookings] = (0, react_1.useState)([]);
    const [loading, setLoading] = (0, react_1.useState)(true);
    const [refreshing, setRefreshing] = (0, react_1.useState)(false);
    const fetchBookings = (0, react_1.useCallback)(async () => {
        if (!(profile === null || profile === void 0 ? void 0 : profile.id))
            return;
        const { data, error } = await (0, bookings_1.getCustomerBookings)(profile.id);
        if (data) {
            setBookings(data);
        }
        setLoading(false);
        setRefreshing(false);
    }, [profile === null || profile === void 0 ? void 0 : profile.id]);
    (0, react_1.useEffect)(() => {
        fetchBookings();
    }, [fetchBookings]);
    const handleRefresh = () => {
        setRefreshing(true);
        fetchBookings();
    };
    const handleBookingPress = (booking) => {
        // Navigate to appropriate screen based on status
        if (['pending', 'accepted', 'driver_arrived', 'in_progress'].includes(booking.status)) {
            if (booking.status === 'pending') {
                expo_router_1.router.push({
                    pathname: '/waiting-for-driver',
                    params: { bookingId: booking.id },
                });
            }
            else {
                expo_router_1.router.push({
                    pathname: '/track-ride',
                    params: { bookingId: booking.id },
                });
            }
        }
        else {
            // For completed/cancelled trips
            expo_router_1.router.push({
                pathname: '/ride-details/[id]',
                params: { id: booking.id }
            });
        }
    };
    return (<react_native_safe_area_context_1.SafeAreaView className="flex-1 bg-gray-50">
      <react_native_1.FlatList data={bookings} renderItem={({ item }) => (<BookingCard booking={item} onPress={() => handleBookingPress(item)}/>)} keyExtractor={(item) => item.id} className="px-4" contentContainerStyle={{ paddingBottom: 100, paddingTop: 10 }} refreshControl={<react_native_1.RefreshControl refreshing={refreshing} onRefresh={handleRefresh}/>} ListEmptyComponent={() => (<react_native_1.View className="flex-1 items-center justify-center py-20">
            {!loading ? (<>
                <react_native_1.Image source={constants_1.images.noResult} className="w-32 h-32 mb-4" resizeMode="contain"/>
                <react_native_1.Text className="text-gray-500 font-JakartaMedium text-center">
                  No trips yet
                </react_native_1.Text>
                <react_native_1.Text className="text-gray-400 font-Jakarta text-sm text-center mt-1">
                  Your booking history will appear here
                </react_native_1.Text>
                <react_native_1.TouchableOpacity onPress={() => expo_router_1.router.push('/(tabs)/home')} className="mt-6 bg-green-500 px-6 py-3 rounded-xl">
                  <react_native_1.Text className="text-white font-JakartaBold">Book a Ride</react_native_1.Text>
                </react_native_1.TouchableOpacity>
              </>) : (<react_native_1.ActivityIndicator size="large" color="#FF9800"/>)}
          </react_native_1.View>)} ListHeaderComponent={<>
            <react_native_1.Text className="text-2xl font-JakartaBold mb-4 text-gray-800">My Trips</react_native_1.Text>
            

          </>} stickyHeaderIndices={[]}/>
    </react_native_safe_area_context_1.SafeAreaView>);
};
exports.default = Rides;
