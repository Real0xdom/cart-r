import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';

interface TermsCheckboxProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  className?: string;
}

/**
 * Reusable Terms & Conditions Checkbox Component
 * Used in both signup and signin flows
 */
export const TermsCheckbox: React.FC<TermsCheckboxProps> = ({
  checked,
  onCheckedChange,
  className = '',
}) => {
  const handleReadMore = () => {
    // Navigate to terms page
    router.push('/terms');
  };

  return (
    <View className={`flex-row items-start ${className}`}>
      <TouchableOpacity
        onPress={() => onCheckedChange(!checked)}
        className={`w-6 h-6 rounded-md border-2 items-center justify-center mr-3 ${
          checked ? 'bg-success-500 border-success-500' : 'border-gray-300'
        }`}
        activeOpacity={0.7}
      >
        {checked && <Feather name="check" size={14} color="#fff" />}
      </TouchableOpacity>

      <View className="flex-1">
        <Text className="text-gray-600 font-JakartaMedium leading-5">
          I accept the{' '}
          <TouchableOpacity
            onPress={handleReadMore}
            className="inline"
            activeOpacity={0.7}
          >
            <Text className="text-success-500 font-JakartaSemiBold underline">
              Terms & Conditions
            </Text>
          </TouchableOpacity>
        </Text>
      </View>
    </View>
  );
};

export default TermsCheckbox;
