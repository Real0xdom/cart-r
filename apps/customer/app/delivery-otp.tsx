// Delivery OTP Screen for Customer
// Shows 6-digit delivery OTP when driver arrives at drop location

import { useLocalSearchParams, router } from "expo-router";
import { useState, useEffect } from "react";
import { View, Text, ActivityIndicator, TouchableOpacity, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { getBookingById, subscribeToBooking } from "@/lib/bookings";
import type { Booking } from "@/types/type";

const DeliveryOtpScreen = () => {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!bookingId) {
      router.replace("/(tabs)/home");
      return;
    }

    // Fetch initial booking data
    getBookingById(bookingId).then(({ data }) => {
      if (data) {
        setBooking(data);
        
        // If delivery OTP doesn't exist yet, wait for it
        if (!data.delivery_otp) {
          console.log('[DELIVERY-OTP] Waiting for delivery OTP to be generated...');
        }
      }
      setIsLoading(false);
    });

    // Subscribe to booking updates
    const unsubscribe = subscribeToBooking(bookingId, (updatedBooking) => {
      setBooking(updatedBooking);
      
      // If trip is completed, navigate away
      if (updatedBooking.status === 'completed') {
        Alert.alert(
          'Delivery Complete! 🎉',
          'Your shipment has been delivered successfully.',
          [{ text: 'OK', onPress: () => router.replace("/(tabs)/home") }]
        );
      }
    });

    return () => unsubscribe();
  }, [bookingId]);

  if (isLoading || !booking) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color="#22c55e" />
        <Text className="text-gray-500 mt-4 font-JakartaMedium">Loading...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View className="flex-row items-center py-4 px-6 border-b border-gray-100">
        <TouchableOpacity
          onPress={() => router.back()}
          className="mr-3 w-10 h-10 rounded-full items-center justify-center bg-gray-50"
        >
          <Feather name="arrow-left" size={20} color="#111827" />
        </TouchableOpacity>
        <Text className="text-xl font-JakartaBold text-gray-900 flex-1">Delivery OTP</Text>
      </View>

      {/* Content */}
      <View className="flex-1 items-center justify-center px-6">
        {/* Icon */}
        <View className="w-32 h-32 bg-orange-500/20 rounded-full items-center justify-center mb-8">
          <Feather name="shield" size={64} color="#f97316" />
        </View>

        {/* Title */}
        <Text className="text-2xl font-JakartaBold text-gray-900 text-center mb-2">
          Your Delivery OTP
        </Text>
        <Text className="text-gray-500 text-center mb-12 px-8">
          Share this 6-digit code with the driver to complete your delivery
        </Text>

        {/* OTP Display */}
        {booking.delivery_otp ? (
          <View className="bg-orange-500/10 rounded-3xl p-8 w-full max-w-sm items-center border-2 border-orange-500/30">
            <Text className="text-orange-600 text-sm font-JakartaSemiBold mb-4">
              DELIVERY CODE
            </Text>
            <Text 
              testID="deliveryOtpDisplay"
              className="text-5xl font-JakartaBold text-orange-600 tracking-widest mb-2"
            >
              {booking.delivery_otp}
            </Text>
            <View className="flex-row items-center mt-4">
              <Feather name="check-circle" size={16} color="#22c55e" />
              <Text className="text-green-600 text-xs font-JakartaMedium ml-2">
                Valid and Active
              </Text>
            </View>
          </View>
        ) : (
          <View className="bg-blue-500/10 rounded-3xl p-8 w-full max-w-sm items-center border-2 border-blue-500/30">
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text className="text-blue-600 text-sm font-JakartaMedium mt-4 text-center">
              Generating your secure delivery code...
            </Text>
          </View>
        )}

        {/* Instructions */}
        <View className="bg-blue-50 rounded-2xl p-6 w-full max-w-sm mt-12 border border-blue-100">
          <View className="flex-row items-start">
            <Feather name="info" size={20} color="#3b82f6" style={{ marginTop: 2 }} />
            <View className="ml-3 flex-1">
              <Text className="text-blue-900 font-JakartaBold text-sm mb-2">
                Important Instructions:
              </Text>
              <Text className="text-blue-700 text-xs font-JakartaMedium leading-5">
                • Show this code to the driver when they arrive{"\n"}
                • The driver will enter this code to confirm delivery{"\n"}
                • Do not share this code until the driver arrives{"\n"}
                • Keep this screen open for quick access
              </Text>
            </View>
          </View>
        </View>

        {/* Receiver Info (if applicable) */}
        {booking.receiver_name && (
          <View className="bg-gray-100 rounded-2xl p-4 w-full max-w-sm mt-6 border border-gray-200">
            <View className="flex-row items-center">
              <View className="w-12 h-12 bg-gray-200 rounded-full items-center justify-center mr-3">
                <Feather name="user" size={24} color="#6b7280" />
              </View>
              <View>
                <Text className="text-gray-900 font-JakartaBold">
                  {booking.receiver_name}
                </Text>
                <Text className="text-gray-500 text-xs">
                  Receiver
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Help Button */}
        <TouchableOpacity
          onPress={() => {
            Alert.alert(
              'Need Help?',
              'If you\'re having issues with the delivery, please contact our support team.',
              [
                { text: 'Cancel', style: 'cancel' },
                { 
                  text: 'Contact Support', 
                  onPress: () => router.push('/help') 
                }
              ]
            );
          }}
          className="mt-8 flex-row items-center px-6 py-3"
        >
          <Feather name="help-circle" size={20} color="#6b7280" />
          <Text className="text-gray-600 font-JakartaMedium ml-2">
            Need Help?
          </Text>
        </TouchableOpacity>
      </View>

      {/* Status Indicator */}
      <View className="px-6 pb-6">
        <View className="bg-green-500/10 rounded-xl p-4 border border-green-500/20">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center">
              <View className="w-3 h-3 bg-green-500 rounded-full mr-3">
                <View className="w-3 h-3 bg-green-500 rounded-full animate-ping absolute" />
              </View>
              <Text className="text-green-700 font-JakartaSemiBold text-sm">
                Trip in Progress
              </Text>
            </View>
            <Text className="text-green-600 text-xs font-JakartaMedium">
              Driver is on the way
            </Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default DeliveryOtpScreen;
