// Waiting for Driver Screen
// Shows searching animation, subscribes to booking updates, handles timeout

import { useAuth } from "@/contexts/AuthContext";
import { useBookingStore, useRideStore, useLocationStore } from "@/store";
import { router, useLocalSearchParams } from "expo-router";
import { useState, useEffect, useCallback, useRef } from "react";
import { 
  Text, 
  View, 
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { subscribeToBooking, cancelBooking, getBookingById } from "@/lib/bookings";
import type { Booking } from "@/types/type";

// Timeout duration in seconds (3 minutes)
const SEARCH_TIMEOUT_SECONDS = 180;

const WaitingForDriverPage = () => {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const { profile } = useAuth();
  const { currentBooking, setCurrentBooking, clearAll } = useBookingStore();
  const { clearSelectedVehicle } = useRideStore();
  const { destinationAddress } = useLocationStore();

  const [timeRemaining, setTimeRemaining] = useState(SEARCH_TIMEOUT_SECONDS);
  const [driverAccepted, setDriverAccepted] = useState(false);
  const [booking, setBooking] = useState<Booking | null>(currentBooking);
  const [isCancelling, setIsCancelling] = useState(false);

  // Animation for pulsing effect
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Start pulse animation
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  // Countdown timer
  useEffect(() => {
    if (driverAccepted) return;

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          // Timeout - navigate to raise price screen
          router.replace({
            pathname: "/raise-price",
            params: { bookingId },
          });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [driverAccepted, bookingId]);

  // Subscribe to booking updates
  useEffect(() => {
    if (!bookingId) {
      router.replace("/find-ride");
      return;
    }

    // Fetch latest booking data
    getBookingById(bookingId).then(({ data }) => {
      if (data) {
        setBooking(data);
        if (data.status === 'accepted' && data.driver) {
          setDriverAccepted(true);
        }
      }
    });

    // Subscribe to real-time updates
    const unsubscribe = subscribeToBooking(bookingId, (updatedBooking) => {
      setBooking(updatedBooking);
      setCurrentBooking(updatedBooking);

      if (updatedBooking.status === 'accepted') {
        setDriverAccepted(true);
        // Fetch full booking with driver details
        getBookingById(bookingId).then(({ data }) => {
          if (data) {
            setBooking(data);
            setCurrentBooking(data);
          }
        });
      }
    });

    return () => unsubscribe();
  }, [bookingId]);

  // Handle cancel booking
  const handleCancel = async () => {
    Alert.alert(
      "Cancel Booking",
      "Are you sure you want to cancel this booking?",
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes, Cancel",
          style: "destructive",
          onPress: async () => {
            if (!bookingId || !profile?.id) return;
            setIsCancelling(true);
            
            const { success, error } = await cancelBooking(bookingId, profile.id, "Cancelled by customer");
            
            if (success) {
              clearAll();
              clearSelectedVehicle();
              router.replace("/(tabs)/home");
            } else {
              Alert.alert("Error", error || "Failed to cancel booking");
              setIsCancelling(false);
            }
          },
        },
      ]
    );
  };

  // Handle proceed to tracking
  const handleTrackDriver = () => {
    router.replace({
      pathname: "/track-ride",
      params: { bookingId },
    });
  };

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Driver accepted state
  if (driverAccepted && booking?.driver) {
    return (
      <SafeAreaView className="flex-1 bg-green-500">
        <View className="flex-1 items-center justify-center px-6">
          <View className="bg-white rounded-full p-6 mb-6">
            <Feather name="check" size={60} color="#22c55e" />
          </View>
          
          <Text className="text-3xl font-JakartaBold text-white text-center mb-2">
            Driver Found! 🎉
          </Text>
          
          <Text className="text-lg font-JakartaMedium text-white/90 text-center mb-8">
            Your driver is on the way to pick up your goods
          </Text>

          {/* Driver Card */}
          <View className="bg-white rounded-3xl p-6 w-full mb-6">
            <View className="flex-row items-center mb-4">
              <View className="w-16 h-16 bg-gray-100 rounded-full items-center justify-center mr-4">
                <Feather name="user" size={32} color="#666" />
              </View>
              <View className="flex-1">
                <Text className="text-xl font-JakartaBold text-gray-800">
                  {booking.driver.user?.name || "Driver"}
                </Text>
                <View className="flex-row items-center mt-1">
                  <Feather name="star" size={14} color="#f59e0b" />
                  <Text className="ml-1 text-gray-600 font-JakartaMedium">
                    {booking.driver.rating || 4.5}
                  </Text>
                </View>
              </View>
            </View>

            <View className="bg-gray-50 rounded-xl p-3 flex-row justify-between">
              <View className="items-center">
                <Text className="text-xs text-gray-500 font-JakartaMedium">Vehicle</Text>
                <Text className="text-sm font-JakartaBold text-gray-800">{booking.driver.vehicle_model}</Text>
              </View>
              <View className="items-center">
                <Text className="text-xs text-gray-500 font-JakartaMedium">Number</Text>
                <Text className="text-sm font-JakartaBold text-gray-800">{booking.driver.vehicle_number}</Text>
              </View>
              <View className="items-center">
                <Text className="text-xs text-gray-500 font-JakartaMedium">OTP</Text>
                <Text className="text-sm font-JakartaBold text-blue-600">{booking.pickup_otp}</Text>
              </View>
            </View>
          </View>

          {/* Actions */}
          <TouchableOpacity
            onPress={handleTrackDriver}
            className="bg-white w-full py-4 rounded-xl flex-row items-center justify-center mb-3"
          >
            <Feather name="map" size={20} color="#22c55e" />
            <Text className="ml-2 font-JakartaBold text-green-600 text-lg">
              Track Your Shipment
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {/* TODO: Call driver */}}
            className="bg-white/20 w-full py-4 rounded-xl flex-row items-center justify-center"
          >
            <Feather name="phone" size={20} color="#fff" />
            <Text className="ml-2 font-JakartaBold text-white text-lg">
              Call Driver
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Searching state
  return (
    <SafeAreaView className="flex-1 bg-blue-500">
      <View className="flex-1 items-center justify-center px-6">
        {/* Animated Search Icon */}
        <Animated.View
          style={{ transform: [{ scale: pulseAnim }] }}
          className="bg-white rounded-full p-8 mb-8"
        >
          <Feather name="search" size={60} color="#3b82f6" />
        </Animated.View>

        <Text className="text-3xl font-JakartaBold text-white text-center mb-2">
          Finding Drivers...
        </Text>
        
        <Text className="text-lg font-JakartaMedium text-white/80 text-center mb-6">
          We're notifying nearby drivers about your shipment
        </Text>

        {/* Destination Preview */}
        <View className="bg-white/20 rounded-xl p-4 w-full mb-6">
          <View className="flex-row items-center">
            <Feather name="map-pin" size={20} color="#fff" />
            <Text className="ml-2 text-white font-JakartaMedium flex-1" numberOfLines={1}>
              Drop: {destinationAddress}
            </Text>
          </View>
        </View>

        {/* Fare Info */}
        <View className="bg-white rounded-xl p-4 w-full mb-6">
          <View className="flex-row justify-between items-center">
            <Text className="text-gray-600 font-JakartaMedium">Trip Fare</Text>
            <Text className="text-xl font-JakartaBold text-green-600">
              ₹{booking?.total_fare || booking?.driver_payout || 0}
            </Text>
          </View>
        </View>

        {/* Timer */}
        <View className="bg-white/10 rounded-full px-6 py-3 mb-8">
          <Text className="text-white font-JakartaSemiBold text-center">
            Timeout in {formatTime(timeRemaining)}
          </Text>
        </View>

        {/* Cancel Button */}
        <TouchableOpacity
          onPress={handleCancel}
          disabled={isCancelling}
          className="bg-white/20 w-full py-4 rounded-xl flex-row items-center justify-center"
        >
          {isCancelling ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Feather name="x" size={20} color="#fff" />
              <Text className="ml-2 font-JakartaBold text-white text-lg">
                Cancel Booking
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default WaitingForDriverPage;
