import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
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

import { useIsFocused } from "@react-navigation/native";
import { isLocationSupported } from "@/lib/serviceArea";

import { getSavedAddresses, SavedAddress, getPlaceIoniconName } from "@/lib/savedPlaces";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const Home = () => {
  const { profile } = useAuth();
  const { t } = useLanguage();
  const { userAddress, userLatitude, userLongitude, setUserLocation } = useLocationStore();
  const isFocused = useIsFocused();
  
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [activeBookings, setActiveBookings] = useState<Booking[]>([]);
  const [recentBookings, setRecentBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Service Area Check State
  const [isSupportedLocation, setIsSupportedLocation] = useState(true);
  const [loadingLocationCheck, setLoadingLocationCheck] = useState(false);

  // Check if location is supported whenever screen is focused or location changes
  useEffect(() => {
    const checkLocation = async () => {
      if (userLatitude && userLongitude) {
        // Only show loading indicator if we don't have a status yet or if explicitly refreshing
        // But for "constant refresh" feel, we might want to do it silently in background
        if (loading) setLoadingLocationCheck(true);
        
        const { supported } = await isLocationSupported(userLatitude, userLongitude);
        setIsSupportedLocation(supported);
        
        setLoadingLocationCheck(false);
      }
    };

    if (isFocused) {
      checkLocation();
    }
  }, [userLatitude, userLongitude, isFocused]);

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
      
      if (data && !error) {
        // Find ALL active bookings (accepted, driver arrived, pending, in progress)
        // We exclude 'pending' if you only want to show assigned rides, but usually pending is also "active"
        const active = data.filter(b => 
          b.status === 'pending' ||
          b.status === 'accepted' || 
          b.status === 'driver_arrived' || 
          b.status === 'in_progress'
        );
        
        console.log('[HOME] Active bookings count:', active.length);
        setActiveBookings(active);
        
        // Get recent completed bookings for history
        const recentCompleted = data
          .filter(b => b.status === 'completed' || b.status === 'cancelled')
          .slice(0, 5);
        
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

  const fetchSavedPlaces = useCallback(async () => {
    const { data } = await getSavedAddresses();
    if (data) setSavedAddresses(data);
  }, []);

  useEffect(() => {
    if (isFocused) {
      fetchBookings();
      fetchSavedPlaces();
    }
  }, [fetchBookings, fetchSavedPlaces, isFocused]);

  // Format date for cards
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', { 
      day: 'numeric', 
      month: 'short'
    });
  };

  // Pending booking expired? (no driver + expires_at passed)
  const isPendingExpired = (b: Booking) =>
    b.status === 'pending' && !b.driver_id && b.expires_at && new Date(b.expires_at) < new Date();

  // Get status color
  const getStatusColor = (status: string, expired = false) => {
    if (expired) return { bg: '#FFF3E0', text: '#F97316' };
    switch (status) {
      case 'completed': return { bg: '#E8F5E9', text: '#4CAF50' };
      case 'in_progress': return { bg: '#FFF3E0', text: '#FF9800' };
      case 'cancelled': return { bg: '#FFEBEE', text: '#F44336' };
      case 'pending': return { bg: '#E3F2FD', text: '#2196F3' };
      default: return { bg: '#F5F5F5', text: '#757575' };
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-general-900">
      <View className="flex-1 bg-general-900">
        {/* Sticky Service Unavailable Banner */}
        {!isSupportedLocation && !loadingLocationCheck && (
          <TouchableOpacity
            onPress={() => router.push("/find-ride")}
            activeOpacity={0.9}
            className="bg-red-500 px-4 py-3 flex-row items-center justify-between shadow-md z-50"
          >
            <View className="flex-row items-center flex-1 mr-2">
              <MaterialIcons name="location-off" size={20} color="white" />
              <Text className="text-white text-xs font-JakartaMedium ml-2 flex-1">
                {t("gpsOutsideServiceArea")}
              </Text>
            </View>
            <View className="bg-white/20 rounded-lg px-2 py-1">
              <Text className="text-white text-xs font-JakartaBold">{t("selectAction")}</Text>
            </View>
          </TouchableOpacity>
        )}

      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {/* Horizontal Banner (Replaces Header) */}
        <View className="w-full h-48 items-center justify-center overflow-hidden">
          <Image 
            source={images.homeBanner}
            className="w-full h-full"
            resizeMode="cover"
          />
        </View>

        {/* Pickup Location Field (Auto-detected/Preferred) */}
        <View className="mx-5 -mt-4">
          <Text className="text-xs font-JakartaBold text-gray-500 mb-2 uppercase tracking-wider">
            {t("pickUpFrom")}
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
                {userAddress || t("detectingLocation")}
              </Text>
              <Text className="text-gray-400 text-xs font-JakartaMedium mt-0.5">
                {t("putPreferredLocation")}
              </Text>
            </View>
            <Feather name="edit-2" size={16} color="#A0A0A0" />
          </TouchableOpacity>

          {/* Quick selection of saved addresses on Home */}
          {savedAddresses.length > 0 && (
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false} 
              className="mt-3"
              contentContainerStyle={{ paddingRight: 20 }}
            >
              {savedAddresses.map((place) => (
                <TouchableOpacity
                  key={place.id}
                  onPress={() => {
                    setUserLocation({
                      latitude: Number(place.latitude),
                      longitude: Number(place.longitude),
                      address: place.address
                    });
                    router.push("/find-ride");
                  }}
                  className="flex-row items-center bg-white border border-gray-100 rounded-2xl px-4 py-2.5 mr-3 shadow-sm"
                >
                  <View className="w-6 h-6 bg-brand-50 rounded-full items-center justify-center mr-2">
                    <Ionicons name={getPlaceIoniconName(place.icon_type) as any} size={14} color="#FF9800" />
                  </View>
                  <Text className="text-sm font-JakartaBold text-gray-800">{place.label}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity 
                onPress={() => router.push("/saved-addresses")}
                className="flex-row items-center bg-gray-50 border border-dashed border-gray-200 rounded-2xl px-4 py-2.5"
              >
                  <Feather name="plus" size={14} color="#A0A0A0" />
                  <Text className="ml-2 text-sm font-JakartaMedium text-gray-400">{t("addNew")}</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
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
            {t("whereSending")}
          </Text>
          <View className="w-10 h-10 bg-black rounded-xl items-center justify-center">
             <Feather name="arrow-right" size={18} color="white" />
          </View>
        </TouchableOpacity>

        {/* Current Shipments Section */}
        {loading ? (
          <View className="mt-8 items-center py-10">
            <ActivityIndicator size="large" color="#FF9800" />
            <Text className="text-gray-500 font-JakartaMedium mt-3">{t("loadingShipments")}</Text>
          </View>
        ) : activeBookings.length > 0 ? (
          <>
            {/* Current Shipment Header */}
            <View className="mx-5 mt-8 flex-row items-center justify-between mb-4">
              <Text className="text-lg font-JakartaBold text-black">{t("currentShipments")}</Text>
              <TouchableOpacity onPress={() => router.push("/(tabs)/rides")}>
                <Text className="text-brand-500 font-JakartaMedium text-sm">{t("seeAll")}</Text>
              </TouchableOpacity>
            </View>

            {/* Active Bookings Horizontal Scroll */}
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20, gap: 15 }}
            >
              {activeBookings.map((booking) => {
                const expired = isPendingExpired(booking);
                const statusInfo = getStatusColor(booking.status, expired);
                const isPending = booking.status === 'pending';
                
                return (
                  <TouchableOpacity 
                    key={booking.id}
                    activeOpacity={0.9}
                    className="bg-white rounded-3xl overflow-hidden shadow-md border border-gray-100"
                    style={{ width: SCREEN_WIDTH * 0.85 }}
                    onPress={() => router.push({
                      pathname: isPending ? "/waiting-for-driver" : "/track-ride",
                      params: { bookingId: booking.id }
                    })}
                  >
                    {/* Card Header with Status */}
                    <View className="p-5 pb-0">
                      <View className="flex-row items-center justify-between">
                        <View className="flex-row items-center">
                          <View className={`px-3 py-1.5 rounded-full flex-row items-center`} style={{ backgroundColor: statusInfo.bg }}>
                            <View className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: statusInfo.text }} />
                            <Text className="text-xs font-JakartaBold capitalize" style={{ color: statusInfo.text }}>
                              {expired ? t("searchExpired") : booking.status.replace('_', ' ')}
                            </Text>
                          </View>
                          {booking.estimated_duration != null && booking.estimated_duration > 0 ? (
                            <Text className="text-gray-400 text-xs font-JakartaMedium ml-3">
                              ~{booking.estimated_duration} min
                            </Text>
                          ) : null}
                        </View>
                        <TouchableOpacity className="w-8 h-8 bg-gray-100 rounded-full items-center justify-center">
                          <Feather name="chevron-right" size={16} color="#666" />
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Truck Image */}
                    <View className="items-center py-2">
                       <Image 
                        source={images.truckTransparent}
                        className="w-40 h-24"
                        resizeMode="contain"
                      />
                    </View>

                    {/* Show Progress Bar only if active (not pending) */}
                    {!isPending && (
                        <View className="px-5">
                            <View className="h-1.5 bg-gray-100 rounded-full relative flex-row items-center overflow-hidden">
                            <View className="w-2/3 h-full bg-orange-400 rounded-full" />
                            </View>
                        </View>
                    )}

                    {/* Locations */}
                    <View className="px-5 pt-4 pb-2 flex-row justify-between">
                        <View className="flex-1 pr-2">
                        <View className="flex-row items-center mb-1">
                          <View className="w-2 h-2 bg-brand-500 rounded-full mr-2" />
                          <Text className="text-gray-400 text-xs font-JakartaMedium">{t("from")}</Text>
                        </View>
                        <Text className="text-black font-JakartaBold text-sm" numberOfLines={1}>
                          {booking.origin_address}
                        </Text>
                      </View>
                      <View className="flex-1 items-end pl-2">
                        <View className="flex-row items-center mb-1">
                          <View className="w-2 h-2 bg-green-500 rounded-full mr-2" />
                          <Text className="text-gray-400 text-xs font-JakartaMedium">{t("to")}</Text>
                        </View>
                        <Text className="text-black font-JakartaBold text-sm text-right" numberOfLines={1}>
                          {booking.destination_address}
                        </Text>
                      </View>
                    </View>
                    
                    {/* Footer */}
                    <View className="mt-4 flex-row items-center justify-between bg-gray-50 p-4 border-t border-gray-100">
                      <View className="flex-row items-center flex-1">
                        <View className="w-8 h-8 bg-gray-200 rounded-full items-center justify-center mr-3">
                          <Feather name={isPending ? "clock" : "user"} size={16} color="#666" />
                        </View>
                        <View className="flex-1">
                          <Text className="text-gray-500 text-[10px] font-JakartaMedium uppercase">
                            {isPending ? (expired ? t("searchExpired") : t("findingDriver")) : t("driver")}
                          </Text>
                          <Text className="text-black font-JakartaSemiBold text-sm">
                            {isPending ? (expired ? t("increaseTipRetry") : t("waitingForAcceptance")) : (booking.driver?.user?.name || t("assigned"))}
                          </Text>
                        </View>
                      </View>
                      <View>
                          <Text className="text-xs text-gray-400 font-JakartaMedium text-right">{t("fare")}</Text>
                          <Text className="text-brand-500 font-JakartaBold text-lg">₹{booking.total_fare}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
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
              {t("noActiveDeliveries")}
            </Text>
            <Text className="text-gray-500 font-JakartaMedium text-sm text-center mb-5 px-4">
              {t("noShipmentsTransit")}
            </Text>
            <TouchableOpacity 
              onPress={() => router.push("/find-ride")}
              className="bg-brand-500 w-full py-4 rounded-2xl flex-row items-center justify-center shadow-md"
              activeOpacity={0.8}
            >
              <MaterialIcons name="local-shipping" size={20} color="white" />
              <Text className="text-white font-JakartaBold ml-2">{t("bookDelivery")}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Recent Shipments Section */}
        {recentBookings.length > 0 && (
          <>
            <View className="mx-5 mt-8 flex-row items-center justify-between mb-4">
              <Text className="text-lg font-JakartaBold text-black">{t("recentHistory")}</Text>
              <TouchableOpacity onPress={() => router.push("/(tabs)/rides")}>
                <Text className="text-brand-500 font-JakartaMedium text-sm">{t("seeAll")}</Text>
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
      </View>
    </SafeAreaView>
  );
};

export default Home;
