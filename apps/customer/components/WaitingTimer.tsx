import React, { useState, useEffect } from 'react';
import { View, Text } from 'react-native';
import { Feather } from '@expo/vector-icons';

interface WaitingTimerProps {
  /** Timestamp when driver arrived (ISO string) */
  driverArrivedAt: string;
  /** Free waiting time in minutes */
  freeWaitingMinutes: number;
  /** Waiting charge per minute after free time expires (₹) */
  waitingChargePerMinute: number;
}

/**
 * WaitingTimer Component
 * Shows live countdown of free waiting time and accumulating charges
 */
export const WaitingTimer: React.FC<WaitingTimerProps> = ({
  driverArrivedAt,
  freeWaitingMinutes,
  waitingChargePerMinute,
}) => {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [currentCharges, setCurrentCharges] = useState(0);

  useEffect(() => {
    // Calculate elapsed time and update every second
    const interval = setInterval(() => {
      const arrivedTime = new Date(driverArrivedAt).getTime();
      const now = Date.now();
      const elapsed = Math.floor((now - arrivedTime) / 1000); // seconds
      setElapsedSeconds(elapsed);

      // Calculate waiting charges
      const freeWaitingSeconds = freeWaitingMinutes * 60;
      if (elapsed > freeWaitingSeconds) {
        const chargeableMinutes = Math.floor((elapsed - freeWaitingSeconds) / 60);
        const charges = chargeableMinutes * waitingChargePerMinute;
        setCurrentCharges(charges);
      } else {
        setCurrentCharges(0);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [driverArrivedAt, freeWaitingMinutes, waitingChargePerMinute]);

  const freeWaitingSeconds = freeWaitingMinutes * 60;
  const remainingFreeTime = Math.max(0, freeWaitingSeconds - elapsedSeconds);
  const isChargeable = elapsedSeconds > freeWaitingSeconds;

  // Format time as MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Format total elapsed as HH:MM:SS if > 1 hour, else MM:SS
  const formatElapsedTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <View className="bg-white rounded-2xl p-4 border-2 border-orange-200 mb-4">
      {/* Header */}
      <View className="flex-row items-center mb-3">
        <View className={`w-10 h-10 rounded-full items-center justify-center ${isChargeable ? 'bg-red-100' : 'bg-orange-100'}`}>
          <Feather name="clock" size={20} color={isChargeable ? '#EF4444' : '#FF9800'} />
        </View>
        <View className="ml-3 flex-1">
          <Text className="text-base font-JakartaBold text-gray-900">
            Driver Waiting
          </Text>
          <Text className="text-xs text-gray-500 font-JakartaMedium">
            {isChargeable ? 'Charges are accumulating' : `${freeWaitingMinutes} min free waiting time`}
          </Text>
        </View>
      </View>

      {/* Elapsed Time Display */}
      <View className="bg-gray-50 rounded-xl p-3 mb-3">
        <View className="flex-row items-center justify-between">
          <Text className="text-sm text-gray-600 font-JakartaMedium">
            Total Waiting Time
          </Text>
          <Text className="text-2xl font-JakartaBold text-gray-900">
            {formatElapsedTime(elapsedSeconds)}
          </Text>
        </View>
      </View>

      {/* Free Time Countdown or Charges */}
      {!isChargeable ? (
        // Still within free waiting time
        <View className="bg-green-50 rounded-xl p-3 border border-green-200">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center">
              <Feather name="check-circle" size={16} color="#4CAF50" />
              <Text className="ml-2 text-sm text-green-700 font-JakartaBold">
                Free Time Remaining
              </Text>
            </View>
            <Text className="text-xl font-JakartaBold text-green-700">
              {formatTime(remainingFreeTime)}
            </Text>
          </View>
          <Text className="text-xs text-green-600 font-JakartaMedium mt-2">
            ₹{waitingChargePerMinute}/min charges apply after this
          </Text>
        </View>
      ) : (
        // Charges are accumulating
        <View className="bg-red-50 rounded-xl p-3 border border-red-200">
          <View className="flex-row items-center justify-between mb-2">
            <View className="flex-row items-center">
              <Feather name="alert-circle" size={16} color="#EF4444" />
              <Text className="ml-2 text-sm text-red-700 font-JakartaBold">
                Waiting Charges
              </Text>
            </View>
            <Text className="text-2xl font-JakartaBold text-red-700">
              ₹{currentCharges}
            </Text>
          </View>
          <Text className="text-xs text-red-600 font-JakartaMedium">
            ₹{waitingChargePerMinute}/min • {Math.floor((elapsedSeconds - freeWaitingSeconds) / 60)} chargeable minutes
          </Text>
        </View>
      )}

      {/* Info Text */}
      <View className="mt-3 flex-row items-start">
        <Feather name="info" size={14} color="#666" />
        <Text className="ml-2 text-xs text-gray-500 font-JakartaMedium flex-1">
          Please board the vehicle promptly to avoid additional charges
        </Text>
      </View>
    </View>
  );
};

export default WaitingTimer;
