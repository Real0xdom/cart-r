// Customer Trip History Screen
// Shows all past and current bookings

import { useAuth } from "@/contexts/AuthContext";
import { ActivityIndicator, FlatList, Image, Text, View, TouchableOpacity, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState, useEffect, useCallback } from "react";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { images } from "@/constants";
import { getCustomerBookings } from "@/lib/bookings";
import type { Booking } from "@/types/type";

// Status badge colors
const getStatusConfig = (status: Booking['status']) => {
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
const BookingCard = ({ booking, onPress }: { booking: Booking; onPress: () => void }) => {
  const statusConfig = getStatusConfig(booking.status);
  const isActive = ['pending', 'accepted', 'driver_arrived', 'in_progress'].includes(booking.status);

  return (
    <TouchableOpacity 
      onPress={onPress}
      className={`bg-white rounded-xl p-4 mb-3 border ${isActive ? 'border-green-200' : 'border-gray-100'} shadow-sm`}
    >
      {/* Header with status and date */}
      <View className="flex-row justify-between items-center mb-3">
        <View className={`${statusConfig.color} px-2 py-1 rounded-full`}>
          <Text className="text-white text-xs font-JakartaBold">{statusConfig.label}</Text>
        </View>
        <Text className="text-gray-400 text-xs font-JakartaMedium">
          {new Date(booking.created_at).toLocaleDateString('en-IN', { 
            day: 'numeric', 
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>
      </View>

      {/* Route */}
      <View className="flex-row mb-3">
        <View className="items-center mr-3">
          <View className="w-3 h-3 bg-green-500 rounded-full" />
          <View className="w-0.5 h-8 bg-gray-200" />
          <View className="w-3 h-3 bg-red-500 rounded-full" />
        </View>
        <View className="flex-1">
          <Text className="text-gray-800 font-JakartaMedium text-sm" numberOfLines={1}>
            {booking.origin_address}
          </Text>
          <View className="h-4" />
          <Text className="text-gray-800 font-JakartaMedium text-sm" numberOfLines={1}>
            {booking.destination_address}
          </Text>
        </View>
      </View>

      {/* Footer with fare and vehicle */}
      <View className="flex-row justify-between items-center pt-3 border-t border-gray-100">
        <View className="flex-row items-center">
          <Feather name="truck" size={14} color="#6b7280" />
          <Text className="ml-1 text-gray-500 text-xs capitalize font-JakartaMedium">
            {booking.vehicle_type}
          </Text>
          {booking.estimated_distance && (
            <>
              <Text className="text-gray-300 mx-2">•</Text>
              <Text className="text-gray-500 text-xs font-JakartaMedium">
                {booking.estimated_distance.toFixed(1)} km
              </Text>
            </>
          )}
        </View>
        <Text className="text-green-600 font-JakartaBold">
          ₹{booking.total_fare}
        </Text>
      </View>

      {/* Active trip indicator */}
      {isActive && (
        <View className="flex-row items-center mt-3 pt-3 border-t border-green-100 bg-green-50 -mx-4 -mb-4 px-4 py-3 rounded-b-xl">
          <View className="w-2 h-2 bg-green-500 rounded-full animate-pulse mr-2" />
          <Text className="text-green-700 font-JakartaSemiBold text-sm flex-1">
            Tap to track your shipment
          </Text>
          <Feather name="chevron-right" size={18} color="#22c55e" />
        </View>
      )}
    </TouchableOpacity>
  );
};

const Rides = () => {
  const { profile } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchBookings = useCallback(async () => {
    if (!profile?.id) return;
    
    const { data, error } = await getCustomerBookings(profile.id);
    if (data) {
      setBookings(data);
    }
    setLoading(false);
    setRefreshing(false);
  }, [profile?.id]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchBookings();
  };

  const handleBookingPress = (booking: Booking) => {
    // Navigate to appropriate screen based on status
    if (['pending', 'accepted', 'driver_arrived', 'in_progress'].includes(booking.status)) {
      if (booking.status === 'pending') {
        router.push({
          pathname: '/waiting-for-driver',
          params: { bookingId: booking.id },
        });
      } else {
        router.push({
          pathname: '/track-ride',
          params: { bookingId: booking.id },
        });
      }
    } else {
      // For completed/cancelled trips
      router.push({
        pathname: '/ride-details/[id]',
        params: { id: booking.id }
      });
    }
  };

  // Separate active and past bookings
  const activeBookings = bookings.filter(b => 
    ['pending', 'accepted', 'driver_arrived', 'in_progress'].includes(b.status)
  );
  const pastBookings = bookings.filter(b => 
    ['completed', 'cancelled'].includes(b.status)
  );

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <FlatList
        data={bookings}
        renderItem={({ item }) => (
          <BookingCard 
            booking={item} 
            onPress={() => handleBookingPress(item)} 
          />
        )}
        keyExtractor={(item) => item.id}
        className="px-4"
        contentContainerStyle={{ paddingBottom: 100, paddingTop: 10 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        ListEmptyComponent={() => (
          <View className="flex-1 items-center justify-center py-20">
            {!loading ? (
              <>
                <Image
                  source={images.noResult}
                  className="w-32 h-32 mb-4"
                  resizeMode="contain"
                />
                <Text className="text-gray-500 font-JakartaMedium text-center">
                  No trips yet
                </Text>
                <Text className="text-gray-400 font-Jakarta text-sm text-center mt-1">
                  Your booking history will appear here
                </Text>
                <TouchableOpacity 
                  onPress={() => router.push('/(tabs)/home')}
                  className="mt-6 bg-blue-500 px-6 py-3 rounded-xl"
                >
                  <Text className="text-white font-JakartaBold">Book a Ride</Text>
                </TouchableOpacity>
              </>
            ) : (
              <ActivityIndicator size="large" color="#0286FF" />
            )}
          </View>
        )}
        ListHeaderComponent={
          <>
            <Text className="text-2xl font-JakartaBold mb-4 text-gray-800">My Trips</Text>
            
            {/* Active trips section */}
            {activeBookings.length > 0 && (
              <View className="mb-4">
                <View className="flex-row items-center mb-2">
                  <View className="w-2 h-2 bg-green-500 rounded-full mr-2" />
                  <Text className="text-green-700 font-JakartaSemiBold">
                    Active ({activeBookings.length})
                  </Text>
                </View>
              </View>
            )}
          </>
        }
        stickyHeaderIndices={[]}
      />
    </SafeAreaView>
  );
};

export default Rides;