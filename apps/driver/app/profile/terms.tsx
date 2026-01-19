import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';

export default function TermsAndPolicies() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-gray-900">
      {/* Header */}
      <View className="flex-row items-center p-4 border-b border-gray-800">
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-10 h-10 bg-gray-800 rounded-full items-center justify-center mr-4"
        >
          <Feather name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text className="text-xl font-JakartaBold text-white">Terms & Policies</Text>
      </View>

      <ScrollView className="flex-1 p-5">
        
        {/* Section 1: Introduction */}
        <View className="mb-6">
          <Text className="text-lg font-JakartaBold text-white mb-2">1. Introduction</Text>
          <Text className="text-gray-400 leading-6">
            Welcome to the Cart-R Driver App. By using our platform, you agree to comply with and be bound by the following terms and conditions. Please review them carefully.
          </Text>
        </View>

        {/* Section 2: Driver Eligibility */}
        <View className="mb-6">
          <Text className="text-lg font-JakartaBold text-white mb-2">2. Driver Eligibility</Text>
          <Text className="text-gray-400 leading-6">
            To register as a driver, you must:
            {'\n'}• Be at least 18 years of age.
            {'\n'}• Possess a valid driver's license.
            {'\n'}• Have valid vehicle registration and insurance.
            {'\n'}• Pass our background check process.
          </Text>
        </View>

        {/* Section 3: User Conduct */}
        <View className="mb-6">
          <Text className="text-lg font-JakartaBold text-white mb-2">3. Code of Conduct</Text>
          <Text className="text-gray-400 leading-6">
            We maintain a zero-tolerance policy for:
            {'\n'}• Discrimination or harassment of any kind.
            {'\n'}• Unsafe driving practices.
            {'\n'}• Fraudulent activities or misuse of the platform.
            {'\n'}• Distracted driving (e.g., texting while driving).
          </Text>
        </View>

        {/* Section 4: Privacy Policy */}
        <View className="mb-6">
          <Text className="text-lg font-JakartaBold text-white mb-2">4. Privacy Policy</Text>
          <Text className="text-gray-400 leading-6">
            Your privacy is important to us. We collect and use your data to:
            {'\n'}• Connect you with customers.
            {'\n'}• Process payments and verify trips.
            {'\n'}• Improve our platform's safety and efficiency.
            {'\n'}We do not sell your personal data to third parties. Location data is collected only when you are online and available for trips.
          </Text>
        </View>

        {/* Section 5: Payments */}
        <View className="mb-6">
          <Text className="text-lg font-JakartaBold text-white mb-2">5. Payments & Payouts</Text>
          <Text className="text-gray-400 leading-6">
            Earnings are calculated based on trip distance and time. Payouts are processed weekly to your registered bank account. We reserve the right to adjust fares in cases of route inefficiency or fraud.
          </Text>
        </View>
        
        {/* Section 6: Account Termination */}
         <View className="mb-8">
          <Text className="text-lg font-JakartaBold text-white mb-2">6. Account Termination</Text>
          <Text className="text-gray-400 leading-6">
            Cart-R reserves the right to deactivate your account if you violate these terms, receive consistently low ratings, or engage in unsafe behavior.
          </Text>
        </View>

        <View className="mb-10 pt-4 border-t border-gray-800">
           <Text className="text-gray-500 text-center text-xs">
             Last Updated: January 2026
           </Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}
