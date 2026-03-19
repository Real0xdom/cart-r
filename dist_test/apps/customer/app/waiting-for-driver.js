"use strict";
// Waiting for Driver Screen
// Uses consistent RideLayout with map showing route A→B
// Modal shows search status, driver info, or timeout options
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const RideLayout_1 = __importDefault(require("@/components/RideLayout"));
const AuthContext_1 = require("@/contexts/AuthContext");
const store_1 = require("@/store");
const expo_router_1 = require("expo-router");
const react_1 = require("react");
const react_native_1 = require("react-native");
const vector_icons_1 = require("@expo/vector-icons");
const slider_1 = __importDefault(require("@react-native-community/slider"));
const bookings_1 = require("@/lib/bookings");
// Timeout duration in seconds (3 minutes)
const SEARCH_TIMEOUT_SECONDS = 180;
const WaitingForDriverPage = () => {
    var _a;
    const { bookingId } = (0, expo_router_1.useLocalSearchParams)();
    const { profile } = (0, AuthContext_1.useAuth)();
    const { currentBooking, setCurrentBooking, clearAll } = (0, store_1.useBookingStore)();
    const { clearSelectedVehicle } = (0, store_1.useRideStore)();
    const [timeRemaining, setTimeRemaining] = (0, react_1.useState)(SEARCH_TIMEOUT_SECONDS);
    const [driverAccepted, setDriverAccepted] = (0, react_1.useState)(false);
    const [booking, setBooking] = (0, react_1.useState)(currentBooking);
    const [isCancelling, setIsCancelling] = (0, react_1.useState)(false);
    const [showTimeout, setShowTimeout] = (0, react_1.useState)(false);
    // Tip adjustment state for timeout
    const [tipAmount, setTipAmount] = (0, react_1.useState)((booking === null || booking === void 0 ? void 0 : booking.tip_amount) || 0);
    const [isRetrying, setIsRetrying] = (0, react_1.useState)(false);
    // Animation for pulsing effect
    const pulseAnim = (0, react_1.useRef)(new react_native_1.Animated.Value(1)).current;
    // Start pulse animation
    (0, react_1.useEffect)(() => {
        if (driverAccepted || showTimeout)
            return;
        const pulse = react_native_1.Animated.loop(react_native_1.Animated.sequence([
            react_native_1.Animated.timing(pulseAnim, {
                toValue: 1.3,
                duration: 1000,
                easing: react_native_1.Easing.inOut(react_native_1.Easing.ease),
                useNativeDriver: true,
            }),
            react_native_1.Animated.timing(pulseAnim, {
                toValue: 1,
                duration: 1000,
                easing: react_native_1.Easing.inOut(react_native_1.Easing.ease),
                useNativeDriver: true,
            }),
        ]));
        pulse.start();
        return () => pulse.stop();
    }, [driverAccepted, showTimeout]);
    // Watch for driverAccepted state changes
    (0, react_1.useEffect)(() => {
        console.log('[STATE CHANGE] driverAccepted changed to:', driverAccepted);
    }, [driverAccepted]);
    // Countdown timer
    (0, react_1.useEffect)(() => {
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
    (0, react_1.useEffect)(() => {
        if (!bookingId) {
            expo_router_1.router.replace("/find-ride");
        }
    }, [bookingId]);
    // Subscribe to booking updates
    (0, react_1.useEffect)(() => {
        if (!bookingId)
            return;
        console.log('[WAITING] Setting up subscription for booking:', bookingId);
        // Fetch latest booking data
        (0, bookings_1.getBookingById)(bookingId).then(({ data }) => {
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
        const unsubscribe = (0, bookings_1.subscribeToBooking)(bookingId, (updatedBooking) => {
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
                (0, bookings_1.getBookingById)(bookingId).then(({ data }) => {
                    if (data && data.driver) {
                        console.log('[WAITING] Full booking with driver loaded');
                        console.log('[WAITING] Driver details:', data.driver);
                        setBooking(data);
                        setCurrentBooking(data);
                        // Only set driverAccepted after we have the full driver object
                        setDriverAccepted(true);
                    }
                    else {
                        console.error('[WAITING] Failed to fetch full booking details or driver data missing');
                    }
                });
            }
            else if (updatedBooking.status === 'pending') {
                console.log('[WAITING] Status reverted to pending (driver cancelled). Resetting search.');
                setDriverAccepted(false);
                // Reset timer for fresh search
                setShowTimeout(false);
                setTimeRemaining(SEARCH_TIMEOUT_SECONDS);
            }
        });
        return () => {
            console.log('[WAITING] Unsubscribing from booking updates');
            unsubscribe();
        };
    }, [bookingId]);
    // Handle cancel booking
    const handleCancel = (0, react_1.useCallback)(async () => {
        react_native_1.Alert.alert("Cancel Booking", "Are you sure you want to cancel this booking?", [
            { text: "No", style: "cancel" },
            {
                text: "Yes, Cancel",
                style: "destructive",
                onPress: async () => {
                    if (!bookingId || !(profile === null || profile === void 0 ? void 0 : profile.id))
                        return;
                    setIsCancelling(true);
                    const { success, error } = await (0, bookings_1.cancelBooking)(bookingId, profile.id, "Cancelled by customer");
                    if (success) {
                        clearAll();
                        clearSelectedVehicle();
                        expo_router_1.router.replace("/(tabs)/home");
                    }
                    else {
                        react_native_1.Alert.alert("Error", error || "Failed to cancel booking");
                        setIsCancelling(false);
                    }
                },
            },
        ]);
    }, [bookingId, profile === null || profile === void 0 ? void 0 : profile.id, clearAll, clearSelectedVehicle]);
    // Handle proceed to tracking
    const handleTrackDriver = (0, react_1.useCallback)(() => {
        expo_router_1.router.replace({
            pathname: "/track-ride",
            params: { bookingId },
        });
    }, [bookingId]);
    // Handle retry with increased price
    const handleRetrySearch = (0, react_1.useCallback)(async () => {
        if (!bookingId)
            return;
        setIsRetrying(true);
        try {
            const { success, error } = await (0, bookings_1.retryBookingWithIncreasedPrice)(bookingId, tipAmount, 1.0 // Keep fare multiplier at 1.0 for simplicity
            );
            if (error || !success) {
                react_native_1.Alert.alert("Error", error || "Failed to update booking. Please try again.");
                setIsRetrying(false);
                return;
            }
            // Refresh booking data
            const { data: updatedBooking } = await (0, bookings_1.getBookingById)(bookingId);
            if (updatedBooking) {
                setCurrentBooking(updatedBooking);
                setBooking(updatedBooking);
            }
            // Reset states
            setShowTimeout(false);
            setTimeRemaining(SEARCH_TIMEOUT_SECONDS);
        }
        catch (err) {
            react_native_1.Alert.alert("Error", err.message || "Something went wrong");
            setIsRetrying(false);
        }
    }, [bookingId, tipAmount, setCurrentBooking]);
    // Format time as MM:SS
    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };
    const baseFare = (booking === null || booking === void 0 ? void 0 : booking.total_fare) || 0;
    const newTotal = baseFare + tipAmount;
    // Determine snap points based on state
    const getSnapPoints = () => {
        if (driverAccepted)
            return ["40%", "85%"];
        if (showTimeout)
            return ["50%", "85%"];
        return ["50%", "85%"];
    };
    return (<RideLayout_1.default title={driverAccepted ? "Driver Found!" : showTimeout ? "No Drivers Found" : "Finding Driver..."} snapPoints={getSnapPoints()} useView={false}>
      <react_native_1.View className="flex-1">
        {/* Driver Accepted State */}
        {driverAccepted && (booking === null || booking === void 0 ? void 0 : booking.driver) ? (<react_native_1.View>
            {/* Success Badge */}
            <react_native_1.View className="bg-green-100 rounded-xl p-4 mb-4 flex-row items-center">
              <react_native_1.View className="bg-green-500 rounded-full p-2 mr-3">
                <vector_icons_1.Feather name="check" size={20} color="#fff"/>
              </react_native_1.View>
              <react_native_1.View className="flex-1">
                <react_native_1.Text className="text-green-700 font-JakartaBold text-base">Driver Assigned!</react_native_1.Text>
                <react_native_1.Text className="text-green-600 font-JakartaMedium text-sm">Your driver is on the way</react_native_1.Text>
              </react_native_1.View>
            </react_native_1.View>

            {/* Driver Card */}
            <react_native_1.View className="bg-gray-50 rounded-2xl p-4 mb-4">
              <react_native_1.View className="flex-row items-center mb-4">
                <react_native_1.View className="w-14 h-14 bg-brand-100 rounded-full items-center justify-center mr-3">
                  <vector_icons_1.Feather name="user" size={28} color="#FF9800"/>
                </react_native_1.View>
                <react_native_1.View className="flex-1">
                  <react_native_1.Text className="text-lg font-JakartaBold text-gray-800">
                    {((_a = booking.driver.user) === null || _a === void 0 ? void 0 : _a.name) || "Driver"}
                  </react_native_1.Text>
                  <react_native_1.View className="flex-row items-center mt-1">
                    <vector_icons_1.Feather name="star" size={14} color="#f59e0b"/>
                    <react_native_1.Text className="ml-1 text-gray-600 font-JakartaMedium">
                      {booking.driver.rating || 4.5}
                    </react_native_1.Text>
                  </react_native_1.View>
                </react_native_1.View>
              </react_native_1.View>

              <react_native_1.View className="flex-row justify-between bg-white rounded-xl p-3">
                <react_native_1.View className="items-center">
                  <react_native_1.Text className="text-xs text-gray-500 font-JakartaMedium">Vehicle</react_native_1.Text>
                  <react_native_1.Text className="text-sm font-JakartaBold text-gray-800">{booking.driver.vehicle_model}</react_native_1.Text>
                </react_native_1.View>
                <react_native_1.View className="items-center">
                  <react_native_1.Text className="text-xs text-gray-500 font-JakartaMedium">Number</react_native_1.Text>
                  <react_native_1.Text className="text-sm font-JakartaBold text-gray-800">{booking.driver.vehicle_number}</react_native_1.Text>
                </react_native_1.View>
                <react_native_1.View className="items-center">
                  <react_native_1.Text className="text-xs text-gray-500 font-JakartaMedium">OTP</react_native_1.Text>
                  <react_native_1.Text className="text-sm font-JakartaBold text-brand-500">{booking.pickup_otp}</react_native_1.Text>
                </react_native_1.View>
              </react_native_1.View>
            </react_native_1.View>

            {/* Actions */}
            <react_native_1.TouchableOpacity onPress={handleTrackDriver} className="bg-brand-500 py-4 rounded-xl flex-row items-center justify-center mb-3">
              <vector_icons_1.Feather name="navigation" size={20} color="#fff"/>
              <react_native_1.Text className="ml-2 font-JakartaBold text-white text-base">
                Track Shipment
              </react_native_1.Text>
            </react_native_1.TouchableOpacity>

            <react_native_1.TouchableOpacity onPress={() => {
                var _a, _b;
                if ((_b = (_a = booking === null || booking === void 0 ? void 0 : booking.driver) === null || _a === void 0 ? void 0 : _a.user) === null || _b === void 0 ? void 0 : _b.phone) {
                    const Linking = require('react-native').Linking;
                    Linking.openURL(`tel:${booking.driver.user.phone}`);
                }
                else {
                    react_native_1.Alert.alert('Error', 'Driver phone number not available');
                }
            }} className="bg-gray-100 py-4 rounded-xl flex-row items-center justify-center">
              <vector_icons_1.Feather name="phone" size={20} color="#333"/>
              <react_native_1.Text className="ml-2 font-JakartaBold text-gray-700 text-base">
                Call Driver
              </react_native_1.Text>
            </react_native_1.TouchableOpacity>
          </react_native_1.View>) : showTimeout ? (
        /* Timeout State - Tip Adjustment */
        <react_native_1.View>
            {/* Warning Badge */}
            <react_native_1.View className="bg-orange-100 rounded-xl p-4 mb-4 flex-row items-center">
              <react_native_1.View className="bg-orange-500 rounded-full p-2 mr-3">
                <vector_icons_1.Feather name="alert-circle" size={20} color="#fff"/>
              </react_native_1.View>
              <react_native_1.View className="flex-1">
                <react_native_1.Text className="text-orange-700 font-JakartaBold text-base">No Drivers Nearby</react_native_1.Text>
                <react_native_1.Text className="text-orange-600 font-JakartaMedium text-sm">Increase tip to attract drivers</react_native_1.Text>
              </react_native_1.View>
            </react_native_1.View>

            {/* Fare Summary */}
            <react_native_1.View className="bg-gray-50 rounded-2xl p-4 mb-4">
              <react_native_1.View className="flex-row justify-between items-center mb-3">
                <react_native_1.Text className="text-gray-600 font-JakartaMedium">Base Fare</react_native_1.Text>
                <react_native_1.Text className="text-lg font-JakartaBold text-gray-800">₹{baseFare}</react_native_1.Text>
              </react_native_1.View>
              
              <react_native_1.View className="mb-3">
                <react_native_1.View className="flex-row justify-between items-center mb-2">
                  <react_native_1.Text className="text-gray-700 font-JakartaSemiBold">Driver Tip</react_native_1.Text>
                  <react_native_1.Text className="text-lg font-JakartaBold text-brand-500">+₹{tipAmount}</react_native_1.Text>
                </react_native_1.View>
                <slider_1.default style={{ height: 40 }} minimumValue={0} maximumValue={200} step={10} value={tipAmount} onValueChange={setTipAmount} minimumTrackTintColor="#FF9800" maximumTrackTintColor="#d1d5db" thumbTintColor="#FF9800"/>
                <react_native_1.View className="flex-row justify-between">
                  <react_native_1.Text className="text-xs text-gray-400">₹0</react_native_1.Text>
                  <react_native_1.Text className="text-xs text-gray-400">₹200</react_native_1.Text>
                </react_native_1.View>
              </react_native_1.View>

              <react_native_1.View className="border-t border-gray-200 pt-3 flex-row justify-between items-center">
                <react_native_1.Text className="text-gray-800 font-JakartaBold">New Total</react_native_1.Text>
                <react_native_1.Text className="text-2xl font-JakartaBold text-green-600">₹{newTotal}</react_native_1.Text>
              </react_native_1.View>
            </react_native_1.View>

            {/* Actions */}
            <react_native_1.TouchableOpacity onPress={handleRetrySearch} disabled={isRetrying} className="bg-brand-500 py-4 rounded-xl flex-row items-center justify-center mb-3">
              {isRetrying ? (<react_native_1.ActivityIndicator size="small" color="#fff"/>) : (<>
                  <vector_icons_1.Feather name="refresh-cw" size={20} color="#fff"/>
                  <react_native_1.Text className="ml-2 font-JakartaBold text-white text-base">
                    Search Again
                  </react_native_1.Text>
                </>)}
            </react_native_1.TouchableOpacity>

            <react_native_1.TouchableOpacity onPress={handleCancel} disabled={isCancelling} className="bg-gray-100 py-4 rounded-xl flex-row items-center justify-center">
              {isCancelling ? (<react_native_1.ActivityIndicator size="small" color="#333"/>) : (<>
                  <vector_icons_1.Feather name="x" size={20} color="#333"/>
                  <react_native_1.Text className="ml-2 font-JakartaBold text-gray-700 text-base">
                    Cancel Booking
                  </react_native_1.Text>
                </>)}
            </react_native_1.TouchableOpacity>
          </react_native_1.View>) : (
        /* Searching State */
        <react_native_1.View className="items-center">
            {/* Animated Search Icon */}
            <react_native_1.Animated.View style={{ transform: [{ scale: pulseAnim }] }} className="bg-brand-100 rounded-full p-6 mb-6">
              <vector_icons_1.Feather name="search" size={40} color="#FF9800"/>
            </react_native_1.Animated.View>

            <react_native_1.Text className="text-xl font-JakartaBold text-gray-800 text-center mb-2">
              Finding Drivers...
            </react_native_1.Text>
            
            <react_native_1.Text className="text-sm font-JakartaMedium text-gray-500 text-center mb-6 px-4">
              We're notifying nearby drivers about your shipment
            </react_native_1.Text>

            {/* Timer */}
            <react_native_1.View className="bg-gray-100 rounded-full px-6 py-3 mb-6">
              <react_native_1.Text className="text-gray-700 font-JakartaSemiBold text-center">
                Timeout in {formatTime(timeRemaining)}
              </react_native_1.Text>
            </react_native_1.View>

            {/* Fare Info */}
            <react_native_1.View className="bg-gray-50 rounded-xl p-4 w-full mb-6">
              <react_native_1.View className="flex-row justify-between items-center">
                <react_native_1.Text className="text-gray-600 font-JakartaMedium">Trip Fare</react_native_1.Text>
                <react_native_1.Text className="text-xl font-JakartaBold text-green-600">
                  ₹{(booking === null || booking === void 0 ? void 0 : booking.total_fare) || 0}
                </react_native_1.Text>
              </react_native_1.View>
            </react_native_1.View>

            {/* Cancel Button */}
            <react_native_1.TouchableOpacity onPress={handleCancel} disabled={isCancelling} className="bg-gray-100 w-full py-4 rounded-xl flex-row items-center justify-center">
              {isCancelling ? (<react_native_1.ActivityIndicator size="small" color="#333"/>) : (<>
                  <vector_icons_1.Feather name="x" size={20} color="#333"/>
                  <react_native_1.Text className="ml-2 font-JakartaBold text-gray-700 text-base">
                    Cancel Booking
                  </react_native_1.Text>
                </>)}
            </react_native_1.TouchableOpacity>
          </react_native_1.View>)}
      </react_native_1.View>
    </RideLayout_1.default>);
};
exports.default = WaitingForDriverPage;
