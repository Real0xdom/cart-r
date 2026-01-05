import { useAuth } from "@/contexts/AuthContext";
import { router } from "expo-router";
import { View, Text, TouchableOpacity, Image, ScrollView, ActivityIndicator, Dimensions, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather, MaterialIcons, Ionicons } from "@expo/vector-icons";
import { images } from "@/constants";
import { useState, useEffect, useCallback } from "react";
import { getCustomerBookings } from "@/lib/bookings";
import type { Booking } from "@/types/type";
import { useLocationStore } from "@/store";
import * as SecureStore from 'expo-secure-store';

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const Home = () => {
  const { profile } = useAuth();
  const { userAddress, userLatitude, userLongitude, setUserLocation } = useLocationStore();
  const [inTransitBooking, setInTransitBooking] = useState<Booking | null>(null);
  const [recentBookings, setRecentBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Load saved location on mount
  useEffect(() => {
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
      } catch (error) {
        console.error('Failed to load saved location:', error);
      }
    };
    loadSavedLocation();
  }, []);

  // Save location whenever it changes
  useEffect(() => {
    const saveLocation = async () => {
      if (userAddress && userLatitude && userLongitude) {
        try {
          await SecureStore.setItemAsync('user_pickup_preference', JSON.stringify({
            latitude: userLatitude,
            longitude: userLongitude,
            address: userAddress
          }));
        } catch (error) {
          console.error('Failed to save location:', error);
        }
      }
    };
    saveLocation();
  }, [userAddress, userLatitude, userLongitude]);

  const fetchBookings = useCallback(async () => {
    if (!profile?.id) {
      console.log('[HOME] No profile ID, skipping fetch');
      setLoading(false);
      return;
    }
    
    console.log('[HOME] Fetching bookings for customer:', profile.id);
    
    try {
      const { data, error } = await getCustomerBookings(profile.id);
      
      console.log('[HOME] Bookings fetch result:', {
        hasData: !!data,
        error: error,
        bookingCount: data?.length || 0
      });
      
      if (data && !error) {
        console.log('[HOME] All bookings:', data.map(b => ({
          id: b.id.slice(0, 8),
          status: b.status,
          hasDriver: !!b.driver_id
        })));
        
        // Find the first active booking (accepted, driver arrived, or in progress)
        const transitBooking = data.find(b => 
          b.status === 'accepted' || 
          b.status === 'driver_arrived' || 
          b.status === 'in_progress'
        );
        
        console.log('[HOME] Active booking found:', transitBooking ? {
          id: transitBooking.id.slice(0, 8),
          status: transitBooking.status,
          hasDriver: !!transitBooking.driver_id,
          driverName: transitBooking.driver?.user?.name
        } : 'NONE');
        
        setInTransitBooking(transitBooking || null);
        
        // Get recent completed bookings for the horizontal scroll
        const recentCompleted = data
          .filter(b => b.status === 'completed' || b.status === 'cancelled')
          .slice(0, 5);
        
        console.log('[HOME] Recent completed bookings:', recentCompleted.length);
        setRecentBookings(recentCompleted);
      }
    } catch (err) {
      console.error('[HOME] Error fetching bookings:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile?.id]);

  const onRefresh = useCallback(() => {
    console.log('[HOME] Manual refresh triggered');
    setRefreshing(true);
    fetchBookings();
  }, [fetchBookings]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  // Format date for cards
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', { 
      day: 'numeric', 
      month: 'short'
    });
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return { bg: '#E8F5E9', text: '#4CAF50' };
      case 'in_progress': return { bg: '#FFF3E0', text: '#FF9800' };
      case 'cancelled': return { bg: '#FFEBEE', text: '#F44336' };
      case 'pending': return { bg: '#E3F2FD', text: '#2196F3' };
      default: return { bg: '#F5F5F5', text: '#757575' };
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-general-900" edges={['bottom', 'left', 'right']}>
      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#FF9800"
            colors={["#FF9800"]}
          />
        }
      >
        {/* Horizontal Banner (Replaces Header) */}
        <View className="w-full items-center">
          <Image 
            source={images.homeBanner}
            className="w-full h-64"
            resizeMode="contain"
          />
        </View>

        {/* Pickup Location Field (Auto-detected/Preferred) */}
        <View className="mx-5 -mt-4">
          <Text className="text-xs font-JakartaBold text-gray-500 mb-2 uppercase tracking-wider">
            Pick up from
          </Text>
          <TouchableOpacity 
            onPress={() => router.push("/find-ride")}
            className="flex-row items-center bg-white rounded-2xl p-4 shadow-sm border border-brand-100"
            activeOpacity={0.7}
          >
            <View className="w-10 h-10 bg-brand-100 rounded-full items-center justify-center mr-3">
              <Ionicons name="location" size={20} color="#FF9800" />
            </View>
            <View className="flex-1">
              <Text className="text-black font-JakartaBold text-sm" numberOfLines={1}>
                {userAddress || "Detecting location..."}
              </Text>
              <Text className="text-gray-400 text-xs font-JakartaMedium mt-0.5">
                Put your preferred location
              </Text>
            </View>
            <Feather name="edit-2" size={16} color="#A0A0A0" />
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <TouchableOpacity 
          onPress={() => router.push("/find-ride")}
          className="mx-5 mt-4 flex-row items-center bg-white rounded-2xl p-4 shadow-sm border border-gray-100"
          activeOpacity={0.8}
        >
          <View className="w-10 h-10 bg-gray-100 rounded-xl items-center justify-center">
            <Feather name="search" size={18} color="#A0A0A0" />
          </View>
          <Text className="flex-1 ml-3 font-JakartaMedium text-gray-400">
            Where are you sending?
          </Text>
          <View className="w-10 h-10 bg-black rounded-xl items-center justify-center">
             <Feather name="arrow-right" size={18} color="white" />
          </View>
        </TouchableOpacity>

        {/* Current Shipment Section */}
        {loading ? (
          <View className="mt-8 items-center py-10">
            <ActivityIndicator size="large" color="#FF9800" />
            <Text className="text-gray-500 font-JakartaMedium mt-3">Loading shipments...</Text>
          </View>
        ) : inTransitBooking ? (
          <>
            {/* Current Shipment Header */}
            <View className="mx-5 mt-8 flex-row items-center justify-between mb-4">
              <Text className="text-lg font-JakartaBold text-black">Current Shipment</Text>
              <TouchableOpacity onPress={() => router.push("/(tabs)/rides")}>
                <Text className="text-brand-500 font-JakartaMedium text-sm">See All</Text>
              </TouchableOpacity>
            </View>

            {/* Active Shipment Card */}
            <TouchableOpacity 
              activeOpacity={0.9}
              className="mx-5 bg-white rounded-3xl overflow-hidden shadow-md"
              onPress={() => router.push({
                pathname: "/track-ride",
                params: { bookingId: inTransitBooking.id }
              })}
            >
              {/* Card Header with Status */}
              <View className="p-5 pb-0">
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center">
                    <View className="bg-green-100 px-3 py-1.5 rounded-full flex-row items-center">
                      <View className="w-2 h-2 bg-green-500 rounded-full mr-2" />
                      <Text className="text-green-600 text-xs font-JakartaBold">In Transit</Text>
                    </View>
                    {inTransitBooking.estimated_duration && (
                      <Text className="text-gray-400 text-xs font-JakartaMedium ml-3">
                        ~{inTransitBooking.estimated_duration} min
                      </Text>
                    )}
                  </View>
                  <TouchableOpacity className="w-8 h-8 bg-gray-100 rounded-full items-center justify-center">
                    <Feather name="more-vertical" size={16} color="#666" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Truck Image */}
              <View className="items-center py-2">
                <Image 
                  source={images.truckTransparent}
                  className="w-52 h-32"
                  resizeMode="contain"
                />
              </View>

              {/* Progress Bar */}
              <View className="px-5">
                <View className="h-2 bg-gray-100 rounded-full relative flex-row items-center">
                  <View className="w-2/3 h-full bg-gradient-to-r from-brand-500 to-green-500 rounded-full" style={{ backgroundColor: '#FF9800' }} />
                  <View 
                    className="absolute w-5 h-5 bg-brand-500 border-[3px] border-white rounded-full items-center justify-center shadow-sm"
                    style={{ left: '60%' }}
                  >
                    <View className="w-1.5 h-1.5 bg-white rounded-full" />
                  </View>
                  <View className="absolute right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
                </View>
              </View>

              {/* Locations */}
              <View className="px-5 pt-5 flex-row justify-between">
                <View className="flex-1 pr-4">
                  <View className="flex-row items-center mb-1">
                    <View className="w-2 h-2 bg-brand-500 rounded-full mr-2" />
                    <Text className="text-gray-400 text-xs font-JakartaMedium">From</Text>
                  </View>
                  <Text className="text-black font-JakartaBold text-sm" numberOfLines={2}>
                    {inTransitBooking.origin_address}
                  </Text>
                </View>
                <View className="flex-1 items-end pl-4">
                  <View className="flex-row items-center mb-1">
                    <View className="w-2 h-2 bg-green-500 rounded-full mr-2" />
                    <Text className="text-gray-400 text-xs font-JakartaMedium">To</Text>
                  </View>
                  <Text className="text-black font-JakartaBold text-sm text-right" numberOfLines={2}>
                    {inTransitBooking.destination_address}
                  </Text>
                </View>
              </View>
              
              {/* Footer with Driver Info & Track Button */}
              <View className="mt-5 flex-row items-center justify-between bg-brand-100 p-4">
                <View className="flex-row items-center flex-1">
                  <View className="w-10 h-10 bg-brand-500 rounded-full items-center justify-center mr-3">
                    <Feather name="user" size={18} color="white" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-gray-500 text-xs font-JakartaMedium">
                      {inTransitBooking.booking_number || `#${inTransitBooking.id.slice(0, 8).toUpperCase()}`}
                    </Text>
                    <Text className="text-black font-JakartaBold text-sm">
                      {inTransitBooking.driver?.user?.name || 'Driver Assigned'}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity 
                  className="bg-black w-12 h-12 rounded-full items-center justify-center shadow-lg"
                  onPress={() => router.push({
                    pathname: "/track-ride",
                    params: { bookingId: inTransitBooking.id }
                  })}
                >
                  <Feather name="navigation" size={20} color="white" />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </>
        ) : (
          /* Empty State - No Active Shipment */
          <View className="mx-5 mt-8 bg-white rounded-3xl p-6 items-center shadow-sm">
            <View className="w-full h-32 items-center justify-center mb-4">
              <Image 
                source={images.truckTransparent}
                className="w-40 h-32"
                resizeMode="contain"
              />
            </View>
            <Text className="text-gray-800 font-JakartaBold text-xl text-center mb-2">
              No Active Deliveries
            </Text>
            <Text className="text-gray-500 font-JakartaMedium text-sm text-center mb-5 px-4">
              You don't have any shipments in transit right now. Book a delivery to get started!
            </Text>
            <TouchableOpacity 
              onPress={() => router.push("/find-ride")}
              className="bg-brand-500 w-full py-4 rounded-2xl flex-row items-center justify-center shadow-md"
              activeOpacity={0.8}
            >
              <MaterialIcons name="local-shipping" size={20} color="white" />
              <Text className="text-white font-JakartaBold ml-2">Book Delivery</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Recent Shipments Section */}
        {recentBookings.length > 0 && (
          <>
            <View className="mx-5 mt-8 flex-row items-center justify-between mb-4">
              <Text className="text-lg font-JakartaBold text-black">Recent Shipments</Text>
              <TouchableOpacity onPress={() => router.push("/(tabs)/rides")}>
                <Text className="text-brand-500 font-JakartaMedium text-sm">See All</Text>
              </TouchableOpacity>
            </View>

            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
            >
              {recentBookings.map((booking) => {
                const statusStyle = getStatusColor(booking.status);
                return (
                  <TouchableOpacity
                    key={booking.id}
                    className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100"
                    style={{ width: SCREEN_WIDTH * 0.7 }}
                    onPress={() => router.push({
                      pathname: "/track-ride",
                      params: { bookingId: booking.id }
                    })}
                    activeOpacity={0.8}
                  >
                    <View className="flex-row items-center justify-between mb-3">
                      <View 
                        className="px-3 py-1 rounded-full"
                        style={{ backgroundColor: statusStyle.bg }}
                      >
                        <Text 
                          className="text-xs font-JakartaBold capitalize"
                          style={{ color: statusStyle.text }}
                        >
                          {booking.status.replace('_', ' ')}
                        </Text>
                      </View>
                      <Text className="text-gray-400 text-xs font-JakartaMedium">
                        {formatDate(booking.created_at)}
                      </Text>
                    </View>
                    
                    <Text className="text-gray-500 text-xs font-JakartaMedium mb-1">
                      {booking.booking_number || `#${booking.id.slice(0, 8).toUpperCase()}`}
                    </Text>
                    
                    <View className="flex-row items-center mt-2">
                      <View className="w-2 h-2 bg-brand-500 rounded-full" />
                      <Text className="text-gray-700 font-JakartaMedium text-sm ml-2 flex-1" numberOfLines={1}>
                        {booking.origin_address}
                      </Text>
                    </View>
                    
                    <View className="flex-row items-center mt-2">
                      <View className="w-2 h-2 bg-green-500 rounded-full" />
                      <Text className="text-gray-700 font-JakartaMedium text-sm ml-2 flex-1" numberOfLines={1}>
                        {booking.destination_address}
                      </Text>
                    </View>

                    <View className="flex-row items-center justify-between mt-4 pt-3 border-t border-gray-100">
                      <Text className="text-black font-JakartaBold">
                        ₹{booking.total_fare?.toFixed(0) || '0'}
                      </Text>
                      <View className="flex-row items-center">
                        <Feather name="chevron-right" size={16} color="#999" />
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </>
        )}

      </ScrollView>
    </SafeAreaView>
  );
};

export default Home;
