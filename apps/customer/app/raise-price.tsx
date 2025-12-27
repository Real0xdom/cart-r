// Raise Price Screen
// Shown when no drivers accept within timeout
// Allows customer to increase tip and fare to attract drivers

import { useBookingStore } from "@/store";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { 
  Text, 
  View, 
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import { retryBookingWithIncreasedPrice, getBookingById } from "@/lib/bookings";

const RaisePricePage = () => {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const { currentBooking, setCurrentBooking } = useBookingStore();
  
  const baseFare = currentBooking?.total_fare || 0;
  
  // Tip amount (₹0 to ₹200)
  const [tipAmount, setTipAmount] = useState(50);
  
  // Fare multiplier (1.0, 1.1, 1.2, 1.3)
  const [fareMultiplier, setFareMultiplier] = useState(1.0);
  
  const [isRetrying, setIsRetrying] = useState(false);

  // Calculate new total
  const adjustedFare = Math.round(baseFare * fareMultiplier);
  const newTotal = adjustedFare + tipAmount;
  const increaseAmount = newTotal - baseFare;

  const handleRetrySearch = async () => {
    if (!bookingId) {
      Alert.alert("Error", "Booking not found");
      return;
    }

    setIsRetrying(true);

    try {
      const { success, error } = await retryBookingWithIncreasedPrice(
        bookingId,
        tipAmount,
        fareMultiplier
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
      }

      // Navigate back to waiting screen
      router.replace({
        pathname: "/waiting-for-driver",
        params: { bookingId },
      });

    } catch (err: any) {
      Alert.alert("Error", err.message || "Something went wrong");
      setIsRetrying(false);
    }
  };

  const handleCancelBooking = () => {
    Alert.alert(
      "Cancel Booking",
      "Are you sure you want to cancel this booking?",
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes, Cancel",
          style: "destructive",
          onPress: () => {
            // Clear booking state and go home
            router.replace("/(tabs)/home");
          },
        },
      ]
    );
  };

  const fareMultiplierOptions = [
    { label: "Standard", value: 1.0 },
    { label: "+10%", value: 1.1 },
    { label: "+20%", value: 1.2 },
    { label: "+30%", value: 1.3 },
  ];

  return (
    <SafeAreaView className="flex-1 bg-orange-500">
      <View className="flex-1 px-6 pt-8">
        {/* Header */}
        <View className="items-center mb-8">
          <View className="bg-white rounded-full p-4 mb-4">
            <Feather name="alert-circle" size={50} color="#f97316" />
          </View>
          <Text className="text-3xl font-JakartaBold text-white text-center mb-2">
            No Drivers Nearby
          </Text>
          <Text className="text-lg font-JakartaMedium text-white/80 text-center">
            Increase the fare to attract more drivers
          </Text>
        </View>

        {/* Card */}
        <View className="bg-white rounded-3xl p-6 mb-6">
          {/* Current Fare */}
          <View className="flex-row justify-between items-center mb-4 pb-4 border-b border-gray-100">
            <Text className="text-gray-600 font-JakartaMedium">Current Fare</Text>
            <Text className="text-xl font-JakartaBold text-gray-800">₹{baseFare}</Text>
          </View>

          {/* Fare Multiplier */}
          <Text className="text-sm font-JakartaSemiBold text-gray-700 mb-3">
            Increase Base Fare
          </Text>
          <View className="flex-row gap-2 mb-6">
            {fareMultiplierOptions.map((option) => (
              <TouchableOpacity
                key={option.value}
                onPress={() => setFareMultiplier(option.value)}
                className={`flex-1 py-3 rounded-xl items-center ${
                  fareMultiplier === option.value
                    ? 'bg-orange-500'
                    : 'bg-gray-100'
                }`}
              >
                <Text className={`font-JakartaBold ${
                  fareMultiplier === option.value ? 'text-white' : 'text-gray-700'
                }`}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Tip Slider */}
          <Text className="text-sm font-JakartaSemiBold text-gray-700 mb-2">
            Add Driver Tip: <Text className="text-orange-500 font-JakartaBold">₹{tipAmount}</Text>
          </Text>
          <Slider
            style={{ height: 40 }}
            minimumValue={0}
            maximumValue={200}
            step={10}
            value={tipAmount}
            onValueChange={setTipAmount}
            minimumTrackTintColor="#f97316"
            maximumTrackTintColor="#d1d5db"
            thumbTintColor="#f97316"
          />
          <View className="flex-row justify-between mb-6">
            <Text className="text-xs text-gray-500">₹0</Text>
            <Text className="text-xs text-gray-500">₹200</Text>
          </View>

          {/* Summary */}
          <View className="bg-green-50 rounded-xl p-4">
            <View className="flex-row justify-between items-center mb-2">
              <Text className="text-gray-600 font-JakartaMedium">Adjusted Fare</Text>
              <Text className="font-JakartaSemiBold text-gray-800">₹{adjustedFare}</Text>
            </View>
            <View className="flex-row justify-between items-center mb-2">
              <Text className="text-gray-600 font-JakartaMedium">Driver Tip</Text>
              <Text className="font-JakartaSemiBold text-orange-500">+₹{tipAmount}</Text>
            </View>
            <View className="h-px bg-gray-200 my-2" />
            <View className="flex-row justify-between items-center">
              <Text className="text-lg font-JakartaBold text-gray-800">New Total</Text>
              <View className="items-end">
                <Text className="text-2xl font-JakartaBold text-green-600">₹{newTotal}</Text>
                {increaseAmount > 0 && (
                  <Text className="text-xs text-green-600 font-JakartaMedium">
                    +₹{increaseAmount} increase
                  </Text>
                )}
              </View>
            </View>
          </View>
        </View>

        {/* Badges */}
        <View className="flex-row justify-center mb-6">
          <View className="bg-white/20 rounded-full px-4 py-2 flex-row items-center">
            <Feather name="zap" size={16} color="#fff" />
            <Text className="ml-2 text-white font-JakartaMedium text-sm">
              🔥 Increased Fare badge shown to drivers
            </Text>
          </View>
        </View>

        {/* Buttons */}
        <TouchableOpacity
          onPress={handleRetrySearch}
          disabled={isRetrying}
          className="bg-white w-full py-4 rounded-xl flex-row items-center justify-center mb-3"
        >
          {isRetrying ? (
            <ActivityIndicator size="small" color="#f97316" />
          ) : (
            <>
              <Feather name="refresh-cw" size={20} color="#f97316" />
              <Text className="ml-2 font-JakartaBold text-orange-500 text-lg">
                Search Again with ₹{newTotal}
              </Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleCancelBooking}
          className="w-full py-4 rounded-xl flex-row items-center justify-center"
        >
          <Feather name="x" size={20} color="#fff" />
          <Text className="ml-2 font-JakartaBold text-white text-lg">
            Cancel Booking
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default RaisePricePage;
