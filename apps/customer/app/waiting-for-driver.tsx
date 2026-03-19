// Waiting for Driver Screen
// Uses consistent RideLayout with map showing route A→B
// Modal shows search status, driver info, or timeout options

import RideLayout from "@/components/RideLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useBookingStore, useRideStore, useLocationStore } from "@/store";
import { getActiveVehicleTypes, getVehicleImageSource, VehicleType } from "@/lib/vehicleTypes";
import { images } from "@/constants";
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
  Image,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { TextInput } from "react-native";
import { subscribeToBooking, cancelBooking, getBookingById, retryBookingWithIncreasedPrice } from "@/lib/bookings";
import type { Booking } from "@/types/type";

// Timeout duration in seconds (3 minutes)
const SEARCH_TIMEOUT_SECONDS = 180;
const ASSIGNED_BOOKING_STATUSES: Booking["status"][] = ["accepted", "driver_arrived", "in_progress"];

const hasAssignedDriver = (booking: Booking | null | undefined) =>
  !!booking?.driver_id && ASSIGNED_BOOKING_STATUSES.includes(booking.status);

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
  
  // Tip adjustment state - only shown when no driver found (timeout)
  const TIP_PRESETS = [50, 100, 150, 200];
  const [tipAmount, setTipAmount] = useState(booking?.tip_amount || 0);
  const [customTipInput, setCustomTipInput] = useState("");
  const [isRetrying, setIsRetrying] = useState(false);
  const [vehicleSpecs, setVehicleSpecs] = useState<VehicleType[]>([]);

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

  // Fetch vehicle specifications
  useEffect(() => {
    const fetchVehicleSpecs = async () => {
      const { data } = await getActiveVehicleTypes();
      if (data) setVehicleSpecs(data);
    };
    fetchVehicleSpecs();
  }, []);

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
          hasDriver: !!data.driver,
          expires_at: data.expires_at
        });
        setBooking(data);
        setTipAmount(data.tip_amount || 0);
        if (hasAssignedDriver(data)) {
          console.log(`[WAITING] Driver already ${data.status} - stopping timer`);
          setDriverAccepted(true);
        } else if (
          data.status === 'pending' &&
          !data.driver_id &&
          data.expires_at &&
          new Date(data.expires_at) < new Date()
        ) {
          // Booking search already expired - show add-tip screen immediately
          console.log('[WAITING] Booking already expired - showing add tip screen');
          setShowTimeout(true);
          setTimeRemaining(0);
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

      // Transition to Driver Assigned state if driver is available in the update
      if (ASSIGNED_BOOKING_STATUSES.includes(updatedBooking.status)) {
        if (updatedBooking.driver) {
          console.log(`[WAITING] Driver found in update (${updatedBooking.status}) - updating state`);
          setDriverAccepted(true);
        } else if (updatedBooking.driver_id) {
          console.warn(
            `[WAITING] Driver assigned in booking update (${updatedBooking.status}) but joined driver details are missing. Continuing to tracking and waiting for details to hydrate.`
          );
          setDriverAccepted(true);
        } else {
          console.log(`[WAITING] Status changed to ${updatedBooking.status} but driver data missing, fetching full details`);
          // Fetch full booking with driver details as fallback (e.g. if re-hydration failed/delayed)
          getBookingById(bookingId).then(({ data }) => {
            if (hasAssignedDriver(data)) {
              setBooking(data);
              setCurrentBooking(data);
              setDriverAccepted(true);
            } else {
              console.error('[WAITING] Failed to fetch full booking details or driver data missing');
            }
          });
        }
      } else if (updatedBooking.status === 'pending') {
          console.log('[WAITING] Status reverted to pending (driver cancelled). Resetting search.');
          setDriverAccepted(false);
          // Reset timer for fresh search
          setShowTimeout(false);
          setTimeRemaining(SEARCH_TIMEOUT_SECONDS);
      }
    });

    return () => {
      console.log('[WAITING] Unsubscribing from booking updates');
      // Navigation away from this screen must not cancel the booking.
      // Cancellation is only allowed from explicit user action.
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
              Alert.alert(
                "Ride Cancelled",
                "Your ride has been successfully cancelled.",
                [{ text: "OK", onPress: () => router.replace("/(tabs)/home") }]
              );
            } else {
              Alert.alert("Error", error || "Failed to cancel booking");
              setIsCancelling(false);
            }
          },
        },
      ]
    );
  }, [bookingId, profile?.id, clearAll, clearSelectedVehicle]);

  // Auto-redirect to track-ride when driver is assigned
  useEffect(() => {
    if (driverAccepted && hasAssignedDriver(booking) && bookingId) {
      console.log('[WAITING] Driver assigned! Auto-redirecting to track-ride screen');
      router.replace({
        pathname: "/track-ride",
        params: { bookingId },
      });
    }
  }, [driverAccepted, booking?.driver_id, booking?.status, bookingId]);

  // Handle retry with increased tip (Book Now) - updates booking so drivers see new amount; admin sees in booking
  const handleRetrySearch = useCallback(async () => {
    if (!bookingId || isRetrying) return;

    const tipToApply = customTipInput.trim() !== "" ? (parseInt(customTipInput, 10) || 0) : tipAmount;
    setIsRetrying(true);

    try {
      const { success, error } = await retryBookingWithIncreasedPrice(
        bookingId,
        tipToApply,
        1.0
      );

      if (error || !success) {
        Alert.alert("Error", error || "Failed to update booking. Please try again.");
        setIsRetrying(false);
        return;
      }

      setTipAmount(tipToApply);
      setCustomTipInput("");

      const { data: updatedBooking } = await getBookingById(bookingId);
      if (updatedBooking) {
        setCurrentBooking(updatedBooking);
        setBooking(updatedBooking);
      }

      setShowTimeout(false);
      setTimeRemaining(SEARCH_TIMEOUT_SECONDS);
      setIsRetrying(false);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Something went wrong");
      setIsRetrying(false);
    }
  }, [bookingId, tipAmount, customTipInput, setCurrentBooking]);

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const baseFare = booking?.total_fare || 0;
  const effectiveTip = customTipInput.trim() !== "" ? (parseInt(customTipInput, 10) || 0) : tipAmount;
  const newTotal = baseFare + effectiveTip;

  // Determine snap points based on state
  const getSnapPoints = () => {
    if (driverAccepted) return ["40%", "85%"];
    if (showTimeout) return ["50%", "85%"];
    return ["50%", "85%"];
  };

  return (
    <RideLayout 
      title={driverAccepted ? "Opening Live Tracking..." : showTimeout ? "No Drivers Found" : "Finding Driver..."}
      snapPoints={getSnapPoints()}
      useView={false}
    >
      <View testID="booking.waiting" accessibilityLabel="booking.waiting" className="flex-1">
        {/* Ride ID Badge */}
        <View className="items-center mb-2">
            <View className="bg-gray-100 px-3 py-1 rounded-full border border-gray-200">
                <Text className="text-xs font-JakartaBold text-gray-500">
                    Ride ID: #{bookingId?.slice(-6).toUpperCase()}
                </Text>
            </View>
        </View>

        {/* Driver Accepted State */}
        {driverAccepted ? (
          <View className="bg-green-50 rounded-2xl p-5 border border-green-200 items-center">
            <ActivityIndicator size="large" color="#16a34a" />
            <Text className="text-green-700 font-JakartaBold text-lg mt-4">Driver assigned</Text>
            <Text className="text-green-600 font-JakartaMedium text-sm mt-1 text-center">
              Opening live tracking with driver details and pickup OTP.
            </Text>
          </View>
        ) : showTimeout ? (
          /* Timeout State - Add driver tip (only when no driver found) */
          <View>
            <View className="bg-orange-100 rounded-xl p-4 mb-4 flex-row items-center">
              <View className="bg-orange-500 rounded-full p-2 mr-3">
                <Feather name="alert-circle" size={20} color="#fff" />
              </View>
              <View>
                <Text className="text-orange-700 font-JakartaBold text-base">No Drivers Found</Text>
                <Text className="text-orange-600 font-JakartaMedium text-sm">Add a tip to attract nearby drivers</Text>
              </View>
            </View>

            <View className="bg-gray-50 rounded-2xl p-4 mb-4">
              <View className="flex-row justify-between items-center mb-3">
                <Text className="text-gray-600 font-JakartaMedium">Trip Fare</Text>
                <Text className="text-lg font-JakartaBold text-gray-800">₹{baseFare}</Text>
              </View>

              <Text className="text-gray-700 font-JakartaSemiBold mb-2">Add driver tip</Text>
              <View className="flex-row flex-wrap gap-2 mb-3">
                {TIP_PRESETS.map((preset) => (
                  <TouchableOpacity
                    key={preset}
                    onPress={() => {
                      setTipAmount(preset);
                      setCustomTipInput("");
                    }}
                    className={`px-4 py-3 rounded-xl border-2 ${
                      tipAmount === preset && !customTipInput.trim()
                        ? "bg-brand-500 border-brand-500"
                        : "bg-white border-gray-200"
                    }`}
                  >
                    <Text
                      className={`font-JakartaBold ${
                        tipAmount === preset && !customTipInput.trim() ? "text-white" : "text-gray-800"
                      }`}
                    >
                      ₹{preset}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View className="mb-3">
                <Text className="text-gray-500 text-xs font-JakartaMedium mb-1">Or enter amount (₹)</Text>
                <TextInput
                  value={customTipInput}
                  onChangeText={(t) => {
                    setCustomTipInput(t.replace(/[^0-9]/g, ""));
                    if (t.trim() !== "") setTipAmount(0);
                  }}
                  placeholder="0"
                  keyboardType="number-pad"
                  className="bg-white border border-gray-200 rounded-xl px-4 py-3 text-gray-800 font-JakartaSemiBold"
                />
              </View>

              <View className="border-t border-gray-200 pt-3 flex-row justify-between items-center">
                <Text className="text-gray-800 font-JakartaBold">New total (shown to drivers)</Text>
                <Text className="text-2xl font-JakartaBold text-green-600">₹{newTotal}</Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={handleRetrySearch}
              disabled={isRetrying}
              className="bg-brand-500 py-4 rounded-xl flex-row items-center justify-center mb-3"
            >
              {isRetrying ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Feather name="search" size={20} color="#fff" />
                  <Text className="ml-2 font-JakartaBold text-white text-base">Book Now</Text>
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
                  <Text className="ml-2 font-JakartaBold text-gray-700 text-base">Cancel Booking</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          /* Searching State */
          <View className="items-center">
            {/* Animated Vehicle Icon */}
            <Animated.View
              style={{ transform: [{ scale: pulseAnim }] }}
              className="bg-brand-100 rounded-full p-2 mb-6 w-32 h-32 items-center justify-center overflow-hidden"
            >
              <Image 
                source={(() => {
                  const spec = vehicleSpecs.find(s => s.vehicle_type === booking?.vehicle_type);
                  return getVehicleImageSource(booking?.vehicle_type || "", spec?.icon_url) || images.truckTransparent;
                })()}
                className="w-24 h-24"
                resizeMode="contain"
              />
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

            {/* Fare Info (total_fare includes addons from DB) */}
            <View className="bg-gray-50 rounded-xl p-4 w-full mb-6">
              <View className="flex-row justify-between items-center mb-2">
                <Text className="text-gray-600 font-JakartaMedium">Trip Fare</Text>
                <Text className="text-xl font-JakartaBold text-green-600">
                  ₹{booking?.total_fare ?? 0}
                </Text>
              </View>
              {booking?.booking_addons && booking.booking_addons.length > 0 && (
                <View className="border-t border-gray-200 pt-2 mt-2">
                  <Text className="text-xs text-gray-500 font-JakartaMedium mb-1">Add-ons</Text>
                  {booking.booking_addons.map((ba, i) => (
                    <View key={i} className="flex-row justify-between">
                      <Text className="text-gray-600 text-xs">{ba.addon_services?.name ?? 'Add-on'}</Text>
                      <Text className="text-gray-700 text-xs font-JakartaSemiBold">₹{(ba.quantity || 1) * (ba.unit_price || 0)}</Text>
                    </View>
                  ))}
                  {booking.addon_charges != null && booking.addon_charges > 0 && (
                    <View className="flex-row justify-between mt-1">
                      <Text className="text-gray-500 text-xs">Add-on total</Text>
                      <Text className="text-gray-700 text-xs font-JakartaBold">₹{booking.addon_charges}</Text>
                    </View>
                  )}
                </View>
              )}
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
