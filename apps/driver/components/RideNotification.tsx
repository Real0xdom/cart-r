// Floating Ride Request Notification
// Shows at top of screen when new ride request arrives

import { View, Text, TouchableOpacity, Animated, Dimensions } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { Feather } from '@expo/vector-icons';
import type { Booking } from '@/lib/bookings';

const { width } = Dimensions.get('window');

interface RideNotificationProps {
  booking: Booking | null;
  onAccept: () => void;
  onDecline: () => void;
  onDismiss: () => void;
}

export default function RideNotification({ booking, onAccept, onDecline, onDismiss }: RideNotificationProps) {
  const slideAnim = useRef(new Animated.Value(-200)).current;
  const [countdown, setCountdown] = useState(20); // 20 seconds auto-dismiss

  useEffect(() => {
    if (booking) {
      // Slide down
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 50,
        friction: 7,
      }).start();

      // Start countdown
      setCountdown(20);
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            handleDismiss();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    } else {
      // Slide up
      Animated.timing(slideAnim, {
        toValue: -200,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [booking]);

  const handleDismiss = () => {
    Animated.timing(slideAnim, {
      toValue: -200,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      onDismiss();
    });
  };

  const handleAccept = () => {
    handleDismiss();
    setTimeout(() => onAccept(), 300);
  };

  const handleDecline = () => {
    handleDismiss();
    setTimeout(() => onDecline(), 300);
  };

  if (!booking) return null;

  const fareAmount = booking.driver_payout || booking.total_fare;
  const hasIncreasedFare = (booking.tip_amount && booking.tip_amount > 0) || (booking.fare_multiplier && booking.fare_multiplier > 1);

  return (
    <Animated.View
      style={{
        transform: [{ translateY: slideAnim }],
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
      }}
    >
      <View className="bg-gray-900 border-b-4 border-green-500 shadow-2xl">
        {/* Header with dismiss */}
        <View className="bg-green-500 px-4 py-2 flex-row items-center justify-between">
          <View className="flex-row items-center">
            <View className="w-8 h-8 bg-white rounded-full items-center justify-center mr-2">
              <Text className="text-lg">🚖</Text>
            </View>
            <Text className="text-white font-JakartaBold text-base">New Ride Request!</Text>
          </View>
          <View className="flex-row items-center gap-3">
            {/* Countdown */}
            <View className="bg-white/20 px-2 py-1 rounded-full">
              <Text className="text-white font-JakartaBold text-xs">{countdown}s</Text>
            </View>
            <TouchableOpacity onPress={handleDismiss} className="w-6 h-6 items-center justify-center">
              <Feather name="x" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        <View className="p-4">
          {/* Increased Fare Badge */}
          {hasIncreasedFare && (
            <View className="bg-orange-500 px-3 py-1 rounded-full self-start mb-3 flex-row items-center">
              <Text className="text-white font-JakartaBold text-xs">🔥 Increased Fare</Text>
              {booking.tip_amount && booking.tip_amount > 0 && (
                <Text className="text-white font-JakartaMedium text-xs ml-1">+₹{booking.tip_amount} tip</Text>
              )}
            </View>
          )}

          {/* Pickup & Fare */}
          <View className="flex-row items-start justify-between mb-3">
            <View className="flex-1 pr-2">
              <Text className="text-gray-400 text-xs mb-1">PICKUP</Text>
              <Text className="text-white font-JakartaSemiBold text-sm" numberOfLines={2}>
                {booking.origin_address}
              </Text>
            </View>
            <View className="bg-green-500/20 px-4 py-2 rounded-xl">
              <Text className="text-green-400 font-JakartaBold text-lg">₹{fareAmount}</Text>
            </View>
          </View>

          {/* Destination */}
          <View className="mb-3">
            <Text className="text-gray-400 text-xs mb-1">DROP-OFF</Text>
            <Text className="text-white font-JakartaSemiBold text-sm" numberOfLines={1}>
              {booking.destination_address}
            </Text>
          </View>

          {/* Quick Stats */}
          <View className="flex-row gap-2 mb-4">
            {booking.estimated_distance && (
              <View className="flex-1 bg-gray-800 px-2 py-2 rounded-lg">
                <Text className="text-gray-400 text-xs">Distance</Text>
                <Text className="text-white font-JakartaBold text-xs">{booking.estimated_distance.toFixed(1)} km</Text>
              </View>
            )}
            {booking.estimated_duration && (
              <View className="flex-1 bg-gray-800 px-2 py-2 rounded-lg">
                <Text className="text-gray-400 text-xs">Est. Time</Text>
                <Text className="text-white font-JakartaBold text-xs">{booking.estimated_duration.toFixed(0)} min</Text>
              </View>
            )}
            <View className="flex-1 bg-gray-800 px-2 py-2 rounded-lg">
              <Text className="text-gray-400 text-xs">Payment</Text>
              <Text className="text-white font-JakartaBold text-xs capitalize">{booking.payment_method}</Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View className="flex-row gap-3">
            <TouchableOpacity
              onPress={handleDecline}
              className="flex-1 bg-red-500/20 py-3 rounded-xl flex-row items-center justify-center"
            >
              <Feather name="x-circle" size={18} color="#ef4444" />
              <Text className="text-red-400 font-JakartaBold ml-2">Decline</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleAccept}
              className="flex-1 bg-green-500 py-3 rounded-xl flex-row items-center justify-center"
            >
              <Feather name="check-circle" size={18} color="#fff" />
              <Text className="text-white font-JakartaBold ml-2">Accept</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Animated.View>
  );
}
