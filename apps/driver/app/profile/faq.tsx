import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/lib/supabase';

interface FAQItem {
    question: string;
    answer: string;
}

export default function FAQ() {
  const router = useRouter();
  const { t } = useLanguage();
  const [faqs, setFaqs] = useState<FAQItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetchFaqs();
  }, []);

  async function fetchFaqs() {
    try {
        const { data, error } = await supabase
            .from('faqs')
            .select('question, answer')
            .eq('is_active', true)
            .in('target_audience', ['driver', 'all'])
            .order('created_at', { ascending: false });

        if (error) throw error;
        setFaqs(data || []);
    } catch (error) {
        console.error('Error fetching FAQs:', error);
    } finally {
        setLoading(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Custom Header - Clean and Simple */}
      <View className="flex-row items-center justify-between px-6 py-4 border-b border-gray-100">
        <Text className="text-lg font-JakartaBold text-gray-900 flex-1">{t('frequentlyAskedQuestions')}</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="x" size={24} color="#6b7280" />
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1 p-5">
        {loading ? (
            <View className="py-10">
                <ActivityIndicator color="#22c55e" />
            </View>
        ) : faqs.length === 0 ? (
            <View className="py-10 items-center">
                <Text className="text-gray-500">{t('noFaqsAvailable')}</Text>
            </View>
        ) : faqs.map((faq, index) => (
            <View key={index} className="mb-6 bg-gray-100 p-4 rounded-xl">
                <View className="flex-row items-start mb-2">
                    <Text className="text-lg mr-2">❓</Text>
                    <Text className="text-gray-900 font-JakartaSemiBold text-base flex-1">{faq.question}</Text>
                </View>
                <Text className="text-gray-600 leading-5 ml-8">
                    {faq.answer}
                </Text>
            </View>
        ))}

        <View className="h-10" />

      </ScrollView>
    </SafeAreaView>
  );
}
