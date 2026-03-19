// Customer Ride Cancellation Modal
// Shows cancel reasons with selection options

import { Modal, View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';

interface CancelRideModalProps {
  visible: boolean;
  isLoading?: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}

const CANCELLATION_REASONS = [
  { id: 'driver_too_far', label: 'Driver is taking too long', icon: 'clock' as const },
  { id: 'wrong_location', label: 'I entered wrong location', icon: 'map-pin' as const },
  { id: 'found_alternative', label: 'Found another ride', icon: 'truck' as const },
  { id: 'driver_not_moving', label: 'Driver is not moving', icon: 'alert-circle' as const },
  { id: 'change_of_plans', label: 'Change of plans', icon: 'calendar' as const },
  { id: 'price_too_high', label: 'Price is too high', icon: 'dollar-sign' as const },
  { id: 'other', label: 'Other reason', icon: 'more-horizontal' as const },
];

export default function CancelRideModal({ visible, isLoading, onCancel, onConfirm }: CancelRideModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onCancel}
    >
      <View className="flex-1 bg-black/50 justify-end">
        <View className="bg-white rounded-t-3xl max-h-[80%]">
          {/* Header */}
          <View className="flex-row items-center justify-between px-6 py-4 border-b border-gray-100">
            <View>
              <Text className="text-xl font-JakartaBold text-gray-900">Cancel Ride</Text>
              <Text className="text-sm text-gray-500 font-JakartaMedium mt-1">
                Why do you want to cancel?
              </Text>
            </View>
            <TouchableOpacity
              onPress={onCancel}
              className="w-10 h-10 bg-gray-100 rounded-full items-center justify-center"
              disabled={isLoading}
            >
              <Feather name="x" size={20} color="#666" />
            </TouchableOpacity>
          </View>

          {/* Reasons List */}
          <ScrollView className="px-6 py-4" showsVerticalScrollIndicator={false}>
            {CANCELLATION_REASONS.map((reason) => (
              <TouchableOpacity
                key={reason.id}
                onPress={() => onConfirm(reason.label)}
                disabled={isLoading}
                className="flex-row items-center p-4 bg-gray-50 rounded-2xl mb-3 active:bg-gray-100"
              >
                <View className="w-12 h-12 bg-red-100 rounded-full items-center justify-center mr-4">
                  <Feather name={reason.icon} size={20} color="#ef4444" />
                </View>
                <Text className="flex-1 text-base font-JakartaSemiBold text-gray-800">
                  {reason.label}
                </Text>
                <Feather name="chevron-right" size={20} color="#9ca3af" />
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Warning Note */}
          <View className="px-6 py-4 bg-orange-50 border-t border-orange-100">
            <View className="flex-row items-start">
              <Feather name="info" size={16} color="#f59e0b" className="mt-1 mr-2" />
              <Text className="flex-1 text-xs text-orange-700 font-JakartaMedium">
                Cancelling may affect your rating. Please cancel only if necessary.
              </Text>
            </View>
          </View>

          {/* Loading Overlay */}
          {isLoading && (
            <View className="absolute inset-0 bg-white/90 items-center justify-center rounded-t-3xl">
              <View className="bg-white p-6 rounded-2xl shadow-lg items-center">
                <View className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
                <Text className="mt-4 text-gray-700 font-JakartaSemiBold">Cancelling ride...</Text>
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}
