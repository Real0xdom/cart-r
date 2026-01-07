// Waiting for Driver Screen
// Uses consistent RideLayout with map showing route A→B
// Modal shows search status, driver info, or timeout options

import RideLayout from "@/components/RideLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useBookingStore, useRideStore, useLocationStore } from "@/store";
import { router, useLocalSearchParams } from "expo-router";
import { useState, useEffect, useRef, useCallback } from "react";
import { 
  Text, 
  View, 
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  TouchableOpacity,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import { subscribeToBooking, cancelBooking, getBookingById, retryBookingWithIncreasedPrice } from "@/lib/bookings";
import type { Booking } from "@/types/type";

// Timeout duration in seconds (3 minutes)
const SEARCH_TIMEOUT_SECONDS = 180;

const WaitingForDriverPage = () => {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const { profile } = useAuth();
  const { currentBooking, setCurrentBooking, clearAll } = useBookingStore();
  const { clearSelectedVehicle } = useRideStore();

  const [timeRemaining, setTimeRemaining] = useState(SEARCH_TIMEOUT_SECONDS);
  const [driverAccepted, setDriverAccepted] = useState(false);
  const [booking, setBooking] = useState<Booking | null>(currentBooking);
  const [isCancelling, setIsCancelling] = useState(false);
  const [showTimeout, setShowTimeout] = useState(false);
  
  // Tip adjustment state for timeout
  const [tipAmount, setTipAmount] = useState(booking?.tip_amount || 0);
  const [isRetrying, setIsRetrying] = useState(false);

  // Animation for pulsing effect
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Start pulse animation
  useEffect(() => {
    if (driverAccepted || showTimeout) return;
    
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.3,
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
  }, [driverAccepted, showTimeout]);

  // Watch for driverAccepted state changes
  useEffect(() => {
    console.log('[STATE CHANGE] driverAccepted changed to:', driverAccepted);
  }, [driverAccepted]);

  // Countdown timer
  useEffect(() => {
    console.log('[TIMER] Effect triggered - driverAccepted:', driverAccepted, 'showTimeout:', showTimeout);
    
    if (driverAccepted || showTimeout) {
      console.log('[TIMER] Timer should be stopped (driverAccepted or timeout)');
      return;
    }

    console.log('[TIMER] Starting countdown timer from', timeRemaining);
    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        const newValue = prev - 1;
        if (newValue % 10 === 0) { // Log every 10 seconds
          console.log('[TIMER] Time remaining:', newValue);
        }
        
        if (newValue <= 1) {
          console.log('[TIMER] Timeout reached! Showing timeout screen');
          clearInterval(timer);
          setShowTimeout(true);
          return 0;
        }
        return newValue;
      });
    }, 1000);

    return () => {
      console.log('[TIMER] Cleanup - clearing timer');
      clearInterval(timer);
    };
  }, [driverAccepted, showTimeout]);

  // Redirect if no booking ID - wrapped in useEffect to avoid setState during render
  useEffect(() => {
    if (!bookingId) {
      router.replace("/find-ride");
    }
  }, [bookingId]);

  // Subscribe to booking updates
  useEffect(() => {
    if (!bookingId) return;

    console.log('[WAITING] Setting up subscription for booking:', bookingId);

    // Fetch latest booking data
    getBookingById(bookingId).then(({ data }) => {
      if (data) {
        console.log('[WAITING] Initial booking data:', {
          status: data.status,
          hasDriver: !!data.driver
        });
        setBooking(data);
        setTipAmount(data.tip_amount || 0);
        if ((data.status === 'accepted' || data.status === 'driver_arrived' || data.status === 'in_progress') && data.driver) {
          console.log(`[WAITING] Driver already ${data.status} - stopping timer`);
          setDriverAccepted(true);
        }
      }
    });

    // Subscribe to real-time updates
    const unsubscribe = subscribeToBooking(bookingId, (updatedBooking) => {
      console.log('[WAITING] Booking updated:', {
        status: updatedBooking.status,
        hasDriver: !!updatedBooking.driver_id,
        driverObject: updatedBooking.driver
      });
      
      setBooking(updatedBooking);
      setCurrentBooking(updatedBooking);

      if (updatedBooking.status === 'accepted' || updatedBooking.status === 'driver_arrived' || updatedBooking.status === 'in_progress') {
        console.log(`[WAITING] Status changed to ${updatedBooking.status}! Fetching full details`);
        // Fetch full booking with driver details
        getBookingById(bookingId).then(({ data }) => {
          if (data && data.driver) {
            console.log('[WAITING] Full booking with driver loaded');
            console.log('[WAITING] Driver details:', data.driver);
            setBooking(data);
            setCurrentBooking(data);
            // Only set driverAccepted after we have the full driver object
            setDriverAccepted(true);
          } else {
            console.error('[WAITING] Failed to fetch full booking details or driver data missing');
          }
        });
      } else if (updatedBooking.status === 'pending') {
          console.log('[WAITING] Status reverted to pending (driver cancelled). Resetting search.');
          setDriverAccepted(false);
          // Optional: Reset timer if you want a fresh 3 minutes, or keep it running.
          // For now, let's just show searching state.
      }
    });

    return () => {
      console.log('[WAITING] Unsubscribing from booking updates');
      unsubscribe();
    };
  }, [bookingId]);

  // Handle cancel booking
  const handleCancel = useCallback(async () => {
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
  }, [bookingId, profile?.id, clearAll, clearSelectedVehicle]);

  // Handle proceed to tracking
  const handleTrackDriver = useCallback(() => {
    router.replace({
      pathname: "/track-ride",
      params: { bookingId },
    });
  }, [bookingId]);

  // Handle retry with increased price
  const handleRetrySearch = useCallback(async () => {
    if (!bookingId) return;

    setIsRetrying(true);

    try {
      const { success, error } = await retryBookingWithIncreasedPrice(
        bookingId,
        tipAmount,
        1.0 // Keep fare multiplier at 1.0 for simplicity
      );

      if (error || !success) {
        Alert.alert("Error", error || "Failed to update booking. Please try again.");
        setIsRetrying(false);
        return;
      }

      // Refresh booking data
      const { data: updatedBooking } = await getBookingById(bookingId);
      if (updatedBooking) {
        setCurrentBooking(updatedBooking);
        setBooking(updatedBooking);
      }

      // Reset states
      setShowTimeout(false);
      setTimeRemaining(SEARCH_TIMEOUT_SECONDS);

    } catch (err: any) {
      Alert.alert("Error", err.message || "Something went wrong");
      setIsRetrying(false);
    }
  }, [bookingId, tipAmount, setCurrentBooking]);

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const baseFare = booking?.total_fare || 0;
  const newTotal = baseFare + tipAmount;

  // Determine snap points based on state
  const getSnapPoints = () => {
    if (driverAccepted) return ["40%", "70%"];
    if (showTimeout) return ["50%", "80%"];
    return ["35%", "60%"];
  };

  return (
    <RideLayout 
      title={driverAccepted ? "Driver Found!" : showTimeout ? "No Drivers Found" : "Finding Driver..."}
      snapPoints={getSnapPoints()}
      useView={true}
    >
      <View className="flex-1">
        {/* Driver Accepted State */}
        {driverAccepted && booking?.driver ? (
          <View>
            {/* Success Badge */}
            <View className="bg-green-100 rounded-xl p-4 mb-4 flex-row items-center">
              <View className="bg-green-500 rounded-full p-2 mr-3">
                <Feather name="check" size={20} color="#fff" />
              </View>
              <View className="flex-1">
                <Text className="text-green-700 font-JakartaBold text-base">Driver Assigned!</Text>
                <Text className="text-green-600 font-JakartaMedium text-sm">Your driver is on the way</Text>
              </View>
            </View>

            {/* Driver Card */}
            <View className="bg-gray-50 rounded-2xl p-4 mb-4">
              <View className="flex-row items-center mb-4">
                <View className="w-14 h-14 bg-brand-100 rounded-full items-center justify-center mr-3">
                  <Feather name="user" size={28} color="#FF9800" />
                </View>
                <View className="flex-1">
                  <Text className="text-lg font-JakartaBold text-gray-800">
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

              <View className="flex-row justify-between bg-white rounded-xl p-3">
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
                  <Text className="text-sm font-JakartaBold text-brand-500">{booking.pickup_otp}</Text>
                </View>
              </View>
            </View>

            {/* Actions */}
            <TouchableOpacity
              onPress={handleTrackDriver}
              className="bg-brand-500 py-4 rounded-xl flex-row items-center justify-center mb-3"
            >
              <Feather name="navigation" size={20} color="#fff" />
              <Text className="ml-2 font-JakartaBold text-white text-base">
                Track Shipment
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                if (booking?.driver?.user?.phone) {
                  const Linking = require('react-native').Linking;
                  Linking.openURL(`tel:${booking.driver.user.phone}`);
                } else {
                  Alert.alert('Error', 'Driver phone number not available');
                }
              }}
              className="bg-gray-100 py-4 rounded-xl flex-row items-center justify-center"
            >
              <Feather name="phone" size={20} color="#333" />
              <Text className="ml-2 font-JakartaBold text-gray-700 text-base">
                Call Driver
              </Text>
            </TouchableOpacity>
          </View>
        ) : showTimeout ? (
          /* Timeout State - Tip Adjustment */
          <View>
            {/* Warning Badge */}
            <View className="bg-orange-100 rounded-xl p-4 mb-4 flex-row items-center">
              <View className="bg-orange-500 rounded-full p-2 mr-3">
                <Feather name="alert-circle" size={20} color="#fff" />
              </View>
              <View className="flex-1">
                <Text className="text-orange-700 font-JakartaBold text-base">No Drivers Nearby</Text>
                <Text className="text-orange-600 font-JakartaMedium text-sm">Increase tip to attract drivers</Text>
              </View>
            </View>

            {/* Fare Summary */}
            <View className="bg-gray-50 rounded-2xl p-4 mb-4">
              <View className="flex-row justify-between items-center mb-3">
                <Text className="text-gray-600 font-JakartaMedium">Base Fare</Text>
                <Text className="text-lg font-JakartaBold text-gray-800">₹{baseFare}</Text>
              </View>
              
              <View className="mb-3">
                <View className="flex-row justify-between items-center mb-2">
                  <Text className="text-gray-700 font-JakartaSemiBold">Driver Tip</Text>
                  <Text className="text-lg font-JakartaBold text-brand-500">+₹{tipAmount}</Text>
                </View>
                <Slider
                  style={{ height: 40 }}
                  minimumValue={0}
                  maximumValue={200}
                  step={10}
                  value={tipAmount}
                  onValueChange={setTipAmount}
                  minimumTrackTintColor="#FF9800"
                  maximumTrackTintColor="#d1d5db"
                  thumbTintColor="#FF9800"
                />
                <View className="flex-row justify-between">
                  <Text className="text-xs text-gray-400">₹0</Text>
                  <Text className="text-xs text-gray-400">₹200</Text>
                </View>
              </View>

              <View className="border-t border-gray-200 pt-3 flex-row justify-between items-center">
                <Text className="text-gray-800 font-JakartaBold">New Total</Text>
                <Text className="text-2xl font-JakartaBold text-green-600">₹{newTotal}</Text>
              </View>
            </View>

            {/* Actions */}
            <TouchableOpacity
              onPress={handleRetrySearch}
              disabled={isRetrying}
              className="bg-brand-500 py-4 rounded-xl flex-row items-center justify-center mb-3"
            >
              {isRetrying ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Feather name="refresh-cw" size={20} color="#fff" />
                  <Text className="ml-2 font-JakartaBold text-white text-base">
                    Search Again
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleCancel}
              disabled={isCancelling}
              className="bg-gray-100 py-4 rounded-xl flex-row items-center justify-center"
            >
              {isCancelling ? (
                <ActivityIndicator size="small" color="#333" />
              ) : (
                <>
                  <Feather name="x" size={20} color="#333" />
                  <Text className="ml-2 font-JakartaBold text-gray-700 text-base">
                    Cancel Booking
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          /* Searching State */
          <View className="items-center">
            {/* Animated Search Icon */}
            <Animated.View
              style={{ transform: [{ scale: pulseAnim }] }}
              className="bg-brand-100 rounded-full p-6 mb-6"
            >
              <Feather name="search" size={40} color="#FF9800" />
            </Animated.View>

            <Text className="text-xl font-JakartaBold text-gray-800 text-center mb-2">
              Finding Drivers...
            </Text>
            
            <Text className="text-sm font-JakartaMedium text-gray-500 text-center mb-6 px-4">
              We're notifying nearby drivers about your shipment
            </Text>

            {/* Timer */}
            <View className="bg-gray-100 rounded-full px-6 py-3 mb-6">
              <Text className="text-gray-700 font-JakartaSemiBold text-center">
                Timeout in {formatTime(timeRemaining)}
              </Text>
            </View>

            {/* Fare Info */}
            <View className="bg-gray-50 rounded-xl p-4 w-full mb-6">
              <View className="flex-row justify-between items-center">
                <Text className="text-gray-600 font-JakartaMedium">Trip Fare</Text>
                <Text className="text-xl font-JakartaBold text-green-600">
                  ₹{booking?.total_fare || 0}
                </Text>
              </View>
            </View>

            {/* Cancel Button */}
            <TouchableOpacity
              onPress={handleCancel}
              disabled={isCancelling}
              className="bg-gray-100 w-full py-4 rounded-xl flex-row items-center justify-center"
            >
              {isCancelling ? (
                <ActivityIndicator size="small" color="#333" />
              ) : (
                <>
                  <Feather name="x" size={20} color="#333" />
                  <Text className="ml-2 font-JakartaBold text-gray-700 text-base">
                    Cancel Booking
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    </RideLayout>
  );
};

export default WaitingForDriverPage;
