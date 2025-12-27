// Track Ride Screen
// Live tracking of driver location during shipment

import { useBookingStore, useLocationStore } from "@/store";
import { router, useLocalSearchParams } from "expo-router";
import { useState, useEffect } from "react";
import { 
  Text, 
  View, 
  TouchableOpacity,
  Linking,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import Map from "@/components/Map";
import { subscribeToBooking, subscribeToDriverLocation, getBookingById } from "@/lib/bookings";
import type { Booking } from "@/types/type";

const TrackRidePage = () => {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const { currentBooking, setCurrentBooking } = useBookingStore();
  const { destinationAddress } = useLocationStore();

  const [booking, setBooking] = useState<Booking | null>(currentBooking);
  const [driverLocation, setDriverLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch booking and set up subscriptions
  useEffect(() => {
    if (!bookingId) {
      router.replace("/(tabs)/home");
      return;
    }

    // Fetch latest booking data
    getBookingById(bookingId).then(({ data }) => {
      if (data) {
        setBooking(data);
        setCurrentBooking(data);
        setIsLoading(false);
      }
    });

    // Subscribe to booking status updates
    const unsubscribeBooking = subscribeToBooking(bookingId, (updatedBooking) => {
      setBooking(updatedBooking);
      setCurrentBooking(updatedBooking);

      // If completed, show completion screen
      if (updatedBooking.status === 'completed') {
        router.replace({
          pathname: "/ride-complete",
          params: { bookingId },
        });
      }
    });

    return () => unsubscribeBooking();
  }, [bookingId]);

  // Subscribe to driver location when we have driver info
  useEffect(() => {
    if (!booking?.driver_id) return;

    const unsubscribeLocation = subscribeToDriverLocation(
      booking.driver_id,
      setDriverLocation
    );

    return () => unsubscribeLocation();
  }, [booking?.driver_id]);

  // Call driver
  const handleCallDriver = () => {
    if (booking?.driver?.user?.phone) {
      Linking.openURL(`tel:${booking.driver.user.phone}`);
    }
  };

  // Get status message
  const getStatusMessage = () => {
    switch (booking?.status) {
      case 'accepted':
        return { text: 'Driver is on the way to pickup', color: 'bg-blue-500' };
      case 'driver_arrived':
        return { text: 'Driver has arrived at pickup', color: 'bg-yellow-500' };
      case 'in_progress':
        return { text: 'Shipment in progress', color: 'bg-green-500' };
      default:
        return { text: 'Tracking shipment...', color: 'bg-gray-500' };
    }
  };

  const status = getStatusMessage();

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color="#0286FF" />
        <Text className="mt-4 text-gray-500 font-JakartaMedium">Loading tracking...</Text>
      </SafeAreaView>
    );
  }

  return (
    <View className="flex-1 bg-white">
      {/* Map */}
      <View className="absolute inset-0 h-[55%]">
        <Map />
      </View>

      {/* Header */}
      <SafeAreaView className="z-10 bg-transparent pointer-events-box-none">
        <View className="flex-row items-center justify-between px-5 pt-2">
          <TouchableOpacity 
            onPress={() => router.back()}
            className="w-12 h-12 bg-white rounded-full items-center justify-center shadow-sm"
          >
            <Feather name="chevron-left" size={24} color="black" />
          </TouchableOpacity>
          <Text className="text-xl font-JakartaBold text-black">Track Shipment</Text>
          <TouchableOpacity 
            className="w-12 h-12 bg-white rounded-full items-center justify-center shadow-sm"
          >
            <Feather name="more-vertical" size={24} color="black" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* Bottom Sheet */}
      <View className="absolute bottom-0 w-full bg-white rounded-t-[32px] pt-6 pb-8 px-6 h-[50%] shadow-lg">
        {/* Status Badge */}
        <View className="items-center mb-4">
          <View className={`${status.color} px-4 py-2 rounded-full`}>
            <Text className="text-white font-JakartaSemiBold">{status.text}</Text>
          </View>
        </View>

        {/* Driver Info */}
        {booking?.driver && (
          <View className="bg-gray-50 rounded-2xl p-4 mb-4">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center">
                <View className="w-14 h-14 bg-gray-200 rounded-full items-center justify-center mr-3">
                  <Feather name="user" size={24} color="#666" />
                </View>
                <View>
                  <Text className="text-lg font-JakartaBold text-gray-800">
                    {booking.driver.user?.name || 'Driver'}
                  </Text>
                  <View className="flex-row items-center">
                    <Text className="text-gray-500 text-sm font-JakartaMedium mr-2">
                      {booking.driver.vehicle_number}
                    </Text>
                    <Feather name="star" size={12} color="#f59e0b" />
                    <Text className="text-gray-500 text-sm ml-1">
                      {booking.driver.rating}
                    </Text>
                  </View>
                </View>
              </View>

              <TouchableOpacity 
                onPress={handleCallDriver}
                className="w-12 h-12 bg-green-500 rounded-full items-center justify-center"
              >
                <Feather name="phone" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Trip Info */}
        <View className="bg-gray-50 rounded-2xl p-4 mb-4 flex-1">
          <View className="flex-row justify-between mb-3">
            <View>
              <Text className="text-xs text-gray-500 font-JakartaMedium">DROP LOCATION</Text>
              <Text className="text-sm font-JakartaSemiBold text-gray-800" numberOfLines={1}>
                {destinationAddress || booking?.destination_address}
              </Text>
            </View>
          </View>

          <View className="h-px bg-gray-200 my-2" />

          <View className="flex-row justify-between">
            <View className="items-center flex-1">
              <Text className="text-xs text-gray-500">Receiver</Text>
              <Text className="text-sm font-JakartaSemiBold text-gray-800">
                {booking?.receiver_name}
              </Text>
            </View>
            <View className="items-center flex-1">
              <Text className="text-xs text-gray-500">OTP</Text>
              <Text className="text-lg font-JakartaBold text-blue-600">
                {booking?.pickup_otp}
              </Text>
            </View>
            <View className="items-center flex-1">
              <Text className="text-xs text-gray-500">Fare</Text>
              <Text className="text-sm font-JakartaBold text-green-600">
                ₹{booking?.driver_payout || booking?.total_fare}
              </Text>
            </View>
          </View>
        </View>

        {/* SOS Button */}
        <TouchableOpacity className="bg-red-500 py-4 rounded-xl flex-row items-center justify-center">
          <Feather name="alert-triangle" size={20} color="#fff" />
          <Text className="ml-2 text-white font-JakartaBold">Emergency SOS</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default TrackRidePage;
