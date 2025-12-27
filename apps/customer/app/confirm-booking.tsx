// Confirm Booking Screen
// Shows full booking summary and creates the actual booking in database

import CustomButton from "@/components/CustomButton";
import RideLayout from "@/components/RideLayout";
import { useBookingStore, useLocationStore, useRideStore } from "@/store";
import { useAuth } from "@/contexts/AuthContext";
import { router } from "expo-router";
import { useState, useEffect } from "react";
import { 
  Text, 
  View, 
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { createBooking } from "@/lib/bookings";

const ConfirmBookingPage = () => {
  const { profile } = useAuth();
  const [isCreating, setIsCreating] = useState(false);

  // Get all booking data from stores
  const {
    userAddress,
    userLatitude,
    userLongitude,
    destinationAddress,
    destinationLatitude,
    destinationLongitude,
  } = useLocationStore();

  const { selectedVehicle } = useRideStore();
  const { receiverDetails, setCurrentBooking, goodsDescription } = useBookingStore();

  // Validate all data is present
  useEffect(() => {
    if (!userAddress || !destinationAddress) {
      router.replace("/find-ride");
      return;
    }
    if (!receiverDetails) {
      router.replace("/receiver-details");
      return;
    }
    if (!selectedVehicle) {
      router.replace("/select-vehicle");
      return;
    }
  }, [userAddress, destinationAddress, receiverDetails, selectedVehicle]);

  const handleConfirmBooking = async () => {
    if (!profile?.id) {
      Alert.alert("Error", "Please sign in to continue");
      return;
    }

    if (!userLatitude || !userLongitude || !destinationLatitude || !destinationLongitude) {
      Alert.alert("Error", "Location data is missing. Please try again.");
      return;
    }

    if (!receiverDetails || !selectedVehicle) {
      Alert.alert("Error", "Booking data is incomplete. Please try again.");
      return;
    }

    setIsCreating(true);

    try {
      const { data: booking, error } = await createBooking({
        customerId: profile.id,
        originAddress: userAddress || "",
        originLatitude: userLatitude,
        originLongitude: userLongitude,
        destinationAddress: destinationAddress || "",
        destinationLatitude: destinationLatitude,
        destinationLongitude: destinationLongitude,
        vehicle: selectedVehicle,
        receiverDetails: receiverDetails,
        goodsDescription: goodsDescription || undefined,
      });

      if (error || !booking) {
        Alert.alert("Error", error || "Failed to create booking. Please try again.");
        setIsCreating(false);
        return;
      }

      // Save booking to store
      setCurrentBooking(booking);

      // Navigate to waiting screen
      router.replace({
        pathname: "/waiting-for-driver",
        params: { bookingId: booking.id },
      });

    } catch (err: any) {
      console.error("Booking creation failed:", err);
      Alert.alert("Error", err.message || "Something went wrong. Please try again.");
      setIsCreating(false);
    }
  };

  if (!selectedVehicle || !receiverDetails) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#0286FF" />
      </View>
    );
  }

  return (
    <RideLayout 
      title="Confirm Booking" 
      snapPoints={["60%", "85%"]}
    >
      <ScrollView showsVerticalScrollIndicator={false} className="pb-20">
        {/* Pickup Location */}
        <View className="bg-green-50 border border-green-200 rounded-xl p-4 mb-3">
          <View className="flex-row items-start">
            <View className="bg-green-500 rounded-full p-2 mr-3">
              <Feather name="navigation" size={16} color="#fff" />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-JakartaSemiBold text-green-600 mb-1">
                📍 Pickup Location
              </Text>
              <Text className="text-base font-JakartaMedium text-gray-800" numberOfLines={2}>
                {userAddress}
              </Text>
            </View>
          </View>
        </View>

        {/* Drop Location */}
        <View className="bg-red-50 border border-red-200 rounded-xl p-4 mb-3">
          <View className="flex-row items-start">
            <View className="bg-red-500 rounded-full p-2 mr-3">
              <Feather name="map-pin" size={16} color="#fff" />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-JakartaSemiBold text-red-600 mb-1">
                🎯 Drop Location
              </Text>
              <Text className="text-base font-JakartaMedium text-gray-800" numberOfLines={2}>
                {destinationAddress}
              </Text>
            </View>
          </View>
        </View>

        {/* Receiver Details */}
        <View className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-3">
          <View className="flex-row items-start">
            <View className="bg-blue-500 rounded-full p-2 mr-3">
              <Feather name="user" size={16} color="#fff" />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-JakartaSemiBold text-blue-600 mb-1">
                👤 Receiver
              </Text>
              <Text className="text-base font-JakartaBold text-gray-800">
                {receiverDetails.name}
              </Text>
              <Text className="text-sm font-JakartaMedium text-gray-600">
                +91 {receiverDetails.phone}
              </Text>
            </View>
          </View>
        </View>

        {/* Vehicle & Fare */}
        <View className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-4">
          <Text className="text-sm font-JakartaSemiBold text-gray-500 mb-3">
            TRIP DETAILS
          </Text>
          
          <View className="flex-row justify-between items-center mb-2">
            <Text className="text-gray-600 font-JakartaMedium">Vehicle Type</Text>
            <Text className="text-gray-800 font-JakartaBold capitalize">{selectedVehicle.vehicle_type}</Text>
          </View>

          <View className="flex-row justify-between items-center mb-2">
            <Text className="text-gray-600 font-JakartaMedium">Distance</Text>
            <Text className="text-gray-800 font-JakartaSemiBold">{selectedVehicle.distance_km} km</Text>
          </View>

          <View className="flex-row justify-between items-center mb-2">
            <Text className="text-gray-600 font-JakartaMedium">Est. Duration</Text>
            <Text className="text-gray-800 font-JakartaSemiBold">{selectedVehicle.duration_minutes} min</Text>
          </View>

          <View className="h-px bg-gray-200 my-3" />

          <View className="flex-row justify-between items-center mb-2">
            <Text className="text-gray-600 font-JakartaMedium">Base Fare</Text>
            <Text className="text-gray-800 font-JakartaSemiBold">₹{selectedVehicle.base_fare}</Text>
          </View>

          <View className="flex-row justify-between items-center mb-2">
            <Text className="text-gray-600 font-JakartaMedium">Distance Fare</Text>
            <Text className="text-gray-800 font-JakartaSemiBold">₹{selectedVehicle.distance_fare}</Text>
          </View>

          <View className="flex-row justify-between items-center">
            <Text className="text-gray-600 font-JakartaMedium">Time Fare</Text>
            <Text className="text-gray-800 font-JakartaSemiBold">₹{selectedVehicle.time_fare}</Text>
          </View>

          <View className="h-px bg-gray-300 my-3" />

          <View className="flex-row justify-between items-center">
            <Text className="text-lg font-JakartaBold text-gray-800">Total Fare</Text>
            <Text className="text-xl font-JakartaBold text-green-600">₹{selectedVehicle.total_fare}</Text>
          </View>
        </View>

        {/* Payment Info */}
        <View className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6">
          <View className="flex-row items-center">
            <Feather name="info" size={18} color="#ca8a04" />
            <Text className="ml-2 text-sm font-JakartaMedium text-yellow-700 flex-1">
              Payment can be made via cash or online at the time of delivery.
            </Text>
          </View>
        </View>

        {/* Confirm Button */}
        <CustomButton
          title={isCreating ? "Creating Booking..." : "Confirm & Find Driver"}
          onPress={handleConfirmBooking}
          disabled={isCreating}
          bgVariant="primary"
          IconLeft={() => isCreating ? <ActivityIndicator size="small" color="#fff" /> : null}
        />

        {/* Back Button */}
        <CustomButton
          title="← Back to Vehicle Selection"
          onPress={() => router.back()}
          bgVariant="outline"
          className="mt-3"
          disabled={isCreating}
        />
      </ScrollView>
    </RideLayout>
  );
};

export default ConfirmBookingPage;
