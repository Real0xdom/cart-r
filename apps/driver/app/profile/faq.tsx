import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useState } from 'react';

export default function FAQ() {
  const router = useRouter();
  
  const faqs = [
    {
        question: "How do I get paid?",
        answer: "Earnings are transferred to your registered bank account every Wednesday for the previous week's trips. Please ensure your bank details are correct in the Profile > Bank Account section."
    },
    {
        question: "How do I accept a ride?",
        answer: "When a new ride request appears, you'll see the pickup and drop-off locations along with the estimated fare. Swipe the 'Accept' button to confirm the ride."
    },
    {
        question: "What if the customer cancels?",
        answer: "If a customer cancels after 5 minutes of your acceptance, you will receive a cancellation fee. This will be added to your weekly earnings."
    },
    {
        question: "How do I verify a pickup?",
        answer: "Upon reaching the pickup location, ask the customer for the 4-digit OTP displayed on their app. Enter this OTP in your driver app to start the trip."
    },
    {
        question: "Can I decline a ride?",
        answer: "Yes, you can decline a ride request if you are unable to take it. However, frequent cancellations after accepting may affect your driver rating."
    },
    {
        question: "How do I change my vehicle details?",
        answer: "To change your vehicle, please contact support with your new vehicle's RC and Insurance documents. You will need to undergo re-verification."
    }
  ];

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
        <Text className="text-xl font-JakartaBold text-white">Frequently Asked Questions</Text>
      </View>

      <ScrollView className="flex-1 p-5">
        
        {faqs.map((faq, index) => (
            <View key={index} className="mb-6 bg-gray-800 p-4 rounded-xl">
                <View className="flex-row items-start mb-2">
                    <Text className="text-lg mr-2">❓</Text>
                    <Text className="text-white font-JakartaSemiBold text-base flex-1">{faq.question}</Text>
                </View>
                <Text className="text-gray-400 leading-5 ml-8">
                    {faq.answer}
                </Text>
            </View>
        ))}

        <View className="h-10" />

      </ScrollView>
    </SafeAreaView>
  );
}
