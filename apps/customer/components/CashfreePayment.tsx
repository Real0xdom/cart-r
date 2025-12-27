import React, { useState } from "react";
import { Alert, Image, Text, View, ActivityIndicator } from "react-native";
import { ReactNativeModal } from "react-native-modal";
import { router } from "expo-router";
import * as Linking from 'expo-linking';

import CustomButton from "@/components/CustomButton";
import { images } from "@/constants";
import { useLocationStore } from "@/store";
import { useAuth } from "@/contexts/AuthContext";
import { createBooking, calculateFare } from "../lib/bookingUtils";

// Cashfree configuration
const CASHFREE_APP_ID = process.env.EXPO_PUBLIC_CASHFREE_APP_ID;
const CASHFREE_ENVIRONMENT = process.env.CASHFREE_ENVIRONMENT || 'sandbox';

interface CashfreePaymentProps {
  amount: number;
  vehicleType: 'bike' | 'auto' | 'mini' | 'sedan' | 'suv' | 'truck';
  estimatedDistance: number;
  estimatedDuration: number;
  driverId?: string;
}

const CashfreePayment = ({
  amount,
  vehicleType,
  estimatedDistance,
  estimatedDuration,
  driverId,
}: CashfreePaymentProps) => {
  const { user, profile } = useAuth();
  const {
    userAddress,
    userLongitude,
    userLatitude,
    destinationLatitude,
    destinationAddress,
    destinationLongitude,
  } = useLocationStore();

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [bookingDetails, setBookingDetails] = useState<any>(null);

  const handleCashPayment = async () => {
    if (!user?.id || !userAddress || !destinationAddress) {
      Alert.alert("Error", "Missing booking information. Please try again.");
      return;
    }

    setLoading(true);
    try {
      // Create booking with cash payment method
      const { data: booking, error } = await createBooking({
        customerId: user.id,
        originAddress: userAddress,
        originLatitude: userLatitude!,
        originLongitude: userLongitude!,
        destinationAddress: destinationAddress,
        destinationLatitude: destinationLatitude!,
        destinationLongitude: destinationLongitude!,
        vehicleType: vehicleType,
        estimatedDistance: estimatedDistance,
        estimatedDuration: estimatedDuration,
      });

      if (error || !booking) {
        throw new Error(error || "Failed to create booking");
      }

      setBookingDetails(booking);
      setSuccess(true);
    } catch (err: any) {
      console.error("Booking error:", err);
      Alert.alert("Booking Failed", err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleOnlinePayment = async () => {
    if (!user?.id || !userAddress || !destinationAddress) {
      Alert.alert("Error", "Missing booking information. Please try again.");
      return;
    }

    setLoading(true);
    try {
      // First create the booking
      const { data: booking, error } = await createBooking({
        customerId: user.id,
        originAddress: userAddress,
        originLatitude: userLatitude!,
        originLongitude: userLongitude!,
        destinationAddress: destinationAddress,
        destinationLatitude: destinationLatitude!,
        destinationLongitude: destinationLongitude!,
        vehicleType: vehicleType,
        estimatedDistance: estimatedDistance,
        estimatedDuration: estimatedDuration,
      });

      if (error || !booking) {
        throw new Error(error || "Failed to create booking");
      }

      // TODO: Integrate Cashfree SDK for online payment
      // For now, show success and mark as cash payment
      // The actual Cashfree integration would involve:
      // 1. Create order via Supabase Edge Function
      // 2. Open Cashfree payment page
      // 3. Handle callback/webhook
      
      Alert.alert(
        "Online Payment",
        "Cashfree integration coming soon. For now, your booking is placed with cash payment.",
        [
          {
            text: "OK",
            onPress: () => {
              setBookingDetails(booking);
              setSuccess(true);
            },
          },
        ]
      );
    } catch (err: any) {
      console.error("Payment error:", err);
      Alert.alert("Payment Failed", err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <View className="gap-3 mt-5">
        <CustomButton
          title={loading ? "Processing..." : `Pay Cash - ₹${amount}`}
          className="bg-green-500"
          onPress={handleCashPayment}
          disabled={loading}
        />
        
        <CustomButton
          title={loading ? "Processing..." : `Pay Online - ₹${amount}`}
          className="bg-primary-500"
          onPress={handleOnlinePayment}
          disabled={loading}
        />

        {loading && (
          <View className="items-center mt-3">
            <ActivityIndicator size="small" color="#0286FF" />
            <Text className="text-gray-500 mt-2">Creating your booking...</Text>
          </View>
        )}
      </View>

      <ReactNativeModal
        isVisible={success}
        onBackdropPress={() => setSuccess(false)}
      >
        <View className="flex flex-col items-center justify-center bg-white p-7 rounded-2xl">
          <Image source={images.check} className="w-28 h-28 mt-5" />

          <Text className="text-2xl text-center font-JakartaBold mt-5">
            Booking Confirmed! 🎉
          </Text>

          <Text className="text-md text-general-200 font-JakartaRegular text-center mt-3">
            Your ride has been booked successfully. A driver will be assigned shortly.
          </Text>

          {bookingDetails && (
            <View className="bg-gray-100 w-full p-4 rounded-xl mt-4">
              <Text className="text-sm text-gray-600">Booking Number:</Text>
              <Text className="text-lg font-JakartaBold text-primary-500">
                {bookingDetails.booking_number}
              </Text>
              
              <Text className="text-sm text-gray-600 mt-2">Pickup OTP:</Text>
              <Text className="text-2xl font-JakartaBold text-green-600">
                {bookingDetails.pickup_otp}
              </Text>
              <Text className="text-xs text-gray-500">
                Share this OTP with your driver to start the ride
              </Text>
            </View>
          )}

          <CustomButton
            title="Back Home"
            onPress={() => {
              setSuccess(false);
              router.push("/(tabs)/home");
            }}
            className="mt-5"
          />
        </View>
      </ReactNativeModal>
    </>
  );
};

export default CashfreePayment;
