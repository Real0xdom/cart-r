import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useLanguage } from '@/contexts/LanguageContext';

interface TermsCheckboxProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  className?: string;
  checkboxTestId?: string;
}

/**
 * Reusable Terms & Conditions Checkbox Component for Driver App
 */
export const TermsCheckbox: React.FC<TermsCheckboxProps> = ({
  checked,
  onCheckedChange,
  className = '',
  checkboxTestId = 'auth.termsCheckbox',
}) => {
  const { t } = useLanguage();

  const handleReadMore = () => {
    router.push('/profile/terms');
  };

  return (
    <View className={`flex-row items-center ${className}`}>
      <TouchableOpacity
        testID={checkboxTestId}
        accessibilityLabel={checkboxTestId}
        onPress={() => onCheckedChange(!checked)}
        className={`w-5 h-5 rounded border-2 items-center justify-center mr-3 ${
          checked ? 'bg-success-500 border-success-500' : 'border-gray-300'
        }`}
        activeOpacity={0.7}
      >
        {checked && <Feather name="check" size={12} color="#fff" />}
      </TouchableOpacity>

      <Text className="flex-1 text-gray-600 font-JakartaMedium text-sm">
        {t('iAgreeTerms') || 'I accept the'}{' '}
        <Text
          onPress={handleReadMore}
          className="text-success-500 font-JakartaSemiBold underline"
        >
          {t('termsAndConditions') || 'Terms & Conditions'}
        </Text>
      </Text>
    </View>
  );
};

export default TermsCheckbox;