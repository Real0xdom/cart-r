// Payment Confirmation Modal
// Shown after trip completion to ask customer how they paid

import { View, Text, TouchableOpacity, Modal, ActivityIndicator } from 'react-native';
import { useState } from 'react';
import { Feather } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';

interface PaymentConfirmationModalProps {
  visible: boolean;
  bookingId: string;
  amount: number;
  onConfirm: () => void;
  onSkip: () => void;
}

type PaymentMethod = 'cartr_app' | 'cash_to_driver' | 'driver_personal_upi';

const PaymentConfirmationModal = ({
  visible,
  bookingId,
  amount,
  onConfirm,
  onSkip,
}: PaymentConfirmationModalProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);

  const handleConfirm = async (method: PaymentMethod) => {
    setSelectedMethod(method);
    setIsSubmitting(true);

    try {
      const { error } = await supabase.rpc('confirm_customer_payment', {
        p_booking_id: bookingId,
        p_payment_method: method,
      });

      if (error) {
        console.error('Error confirming payment:', error);
      }
    } catch (err) {
      console.error('Failed to confirm payment:', err);
    } finally {
      setIsSubmitting(false);
      onConfirm();
    }
  };

  const options = [
    {
      method: 'cartr_app' as PaymentMethod,
      icon: 'credit-card',
      label: 'Paid via Cart-R App',
      sublabel: 'Online payment through the app',
      color: '#22c55e',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
    },
    {
      method: 'cash_to_driver' as PaymentMethod,
      icon: 'dollar-sign',
      label: 'Paid Cash to Driver',
      sublabel: 'Driver collected cash payment',
      color: '#3b82f6',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
    },
    {
      method: 'driver_personal_upi' as PaymentMethod,
      icon: 'alert-triangle',
      label: 'Driver asked for personal UPI',
      sublabel: 'Report: Driver avoided Cart-R payment',
      color: '#ef4444',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
    },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onSkip}
    >
      <View className="flex-1 bg-black/50 justify-end">
        <View className="bg-white rounded-t-3xl px-6 pt-8 pb-10">
          {/* Header */}
          <View className="items-center mb-6">
            <View className="w-16 h-16 bg-green-100 rounded-full items-center justify-center mb-4">
              <Feather name="check-circle" size={32} color="#22c55e" />
            </View>
            <Text className="text-2xl font-JakartaBold text-gray-800">
              Trip Completed!
            </Text>
            <Text className="text-gray-500 font-JakartaMedium mt-1">
              Total: ₹{amount}
            </Text>
          </View>

          {/* Question */}
          <Text className="text-center text-gray-600 font-JakartaMedium mb-6">
            How did you pay for this trip?
          </Text>

          {/* Options */}
          <View className="gap-3 mb-6">
            {options.map((option) => (
              <TouchableOpacity
                key={option.method}
                onPress={() => handleConfirm(option.method)}
                disabled={isSubmitting}
                className={`flex-row items-center p-4 rounded-xl border ${option.bgColor} ${option.borderColor}`}
              >
                {isSubmitting && selectedMethod === option.method ? (
                  <ActivityIndicator size="small" color={option.color} />
                ) : (
                  <Feather name={option.icon as any} size={24} color={option.color} />
                )}
                <View className="ml-4 flex-1">
                  <Text className="font-JakartaSemiBold text-gray-800">
                    {option.label}
                  </Text>
                  <Text className="text-xs text-gray-500 font-Jakarta">
                    {option.sublabel}
                  </Text>
                </View>
                <Feather name="chevron-right" size={20} color="#9ca3af" />
              </TouchableOpacity>
            ))}
          </View>

          {/* Skip Button */}
          <TouchableOpacity
            onPress={onSkip}
            disabled={isSubmitting}
            className="py-3"
          >
            <Text className="text-center text-gray-400 font-JakartaMedium">
              Skip for now
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export default PaymentConfirmationModal;
