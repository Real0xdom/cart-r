import { View, Text, ScrollView, TouchableOpacity, Linking, Modal, TextInput, ActivityIndicator, Alert } from 'react-native';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Feather } from '@expo/vector-icons';

export default function Support() {
  const { profile } = useAuth();
  const { t } = useLanguage();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({ subject: '', description: '' });

  const openLink = (url: string) => Linking.openURL(url);

  const handleSubmitTicket = async () => {
    if (!formData.subject || !formData.description) {
        return Alert.alert(t('missingFields'), t('provideSubjectAndDescription'));
    }

    setIsSubmitting(true);
    try {
        const { error } = await supabase
            .from('support_tickets')
            .insert([{
                user_id: profile?.id,
                subject: formData.subject,
                description: formData.description,
                priority: 'medium',
                status: 'open',
                source_app: 'driver_app',
            }]);

        if (error) throw error;
        
        Alert.alert(t('success'), t('ticketSubmitted'));
        setIsModalOpen(false);
        setFormData({ subject: '', description: '' });
    } catch (error: any) {
        Alert.alert(t('error'), error.message || t('failedToSubmitTicket'));
    } finally {
        setIsSubmitting(false);
    }
  };

  return (
    <View className="flex-1 bg-white">
        <ScrollView className="flex-1">
          <View className="p-5">
            
            <Text className="text-gray-900 text-2xl font-JakartaBold mb-2">{t('howCanWeHelp')}</Text>
            <Text className="text-gray-500 mb-6">{t('selectOptionBelow')}</Text>

            <View className="gap-4">
                <TouchableOpacity 
                    onPress={() => setIsModalOpen(true)}
                    className="bg-orange-500 p-5 rounded-2xl flex-row items-center shadow-lg"
                >
                    <View className="w-12 h-12 bg-white/20 rounded-full items-center justify-center mr-4">
                        <Feather name="message-square" size={24} color="white" />
                    </View>
                    <View>
                        <Text className="text-gray-900 font-JakartaBold text-lg">{t('createSupportTicket')}</Text>
                        <Text className="text-orange-100">{t('sendDirectMessage')}</Text>
                    </View>
                </TouchableOpacity>

                <TouchableOpacity 
                    onPress={() => openLink('tel:1800123456')}
                    className="bg-gray-100 p-5 rounded-2xl flex-row items-center"
                >
                    <View className="w-12 h-12 bg-blue-500/20 rounded-full items-center justify-center mr-4">
                        <Text className="text-2xl">📞</Text>
                    </View>
                    <View>
                        <Text className="text-gray-900 font-JakartaBold text-lg">{t('callSupport')}</Text>
                        <Text className="text-gray-400">{t('speakWithAgent')}</Text>
                    </View>
                </TouchableOpacity>

                <TouchableOpacity 
                    onPress={() => openLink('mailto:support@cart-r.com')}
                    className="bg-gray-100 p-5 rounded-2xl flex-row items-center"
                >
                    <View className="w-12 h-12 bg-green-500/20 rounded-full items-center justify-center mr-4">
                        <Text className="text-2xl">✉️</Text>
                    </View>
                    <View>
                        <Text className="text-gray-900 font-JakartaBold text-lg">{t('emailUs')}</Text>
                        <Text className="text-gray-400">{t('getResponse24h')}</Text>
                    </View>
                </TouchableOpacity>
                
                <TouchableOpacity 
                    onPress={() => {
                        const { router } = require('expo-router');
                        router.push('/profile/faq');
                    }}
                    className="bg-gray-100 p-5 rounded-2xl flex-row items-center"
                >
                    <View className="w-12 h-12 bg-purple-500/20 rounded-full items-center justify-center mr-4">
                        <Text className="text-2xl">❓</Text>
                    </View>
                    <View>
                        <Text className="text-gray-900 font-JakartaBold text-lg">{t('faqs')}</Text>
                        <Text className="text-gray-400">{t('commonQuestions')}</Text>
                    </View>
                </TouchableOpacity>
            </View>

            <View className="mt-8 bg-gray-100/50 p-6 rounded-2xl"> 
                <Text className="text-gray-900 font-JakartaBold mb-2">{t('emergencyService')}</Text>
                <Text className="text-gray-400 text-sm mb-4">
                    {t('emergencyServiceDesc')}
                </Text>
                <TouchableOpacity 
                    onPress={() => openLink('tel:112')}
                    className="bg-red-500 p-4 rounded-xl shadow-lg shadow-red-500/30"
                >
                    <Text className="text-gray-900 text-center font-JakartaBold text-lg">{t('sosCall112')}</Text>
                </TouchableOpacity>
            </View>

        </View>
      </ScrollView>

      {/* TICKET FORM MODAL */}
      <Modal
        visible={isModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsModalOpen(false)}
      >
        <View className="flex-1 bg-black/60 justify-end">
            <View className="bg-white rounded-t-3xl p-6 h-[70%]">
                <View className="flex-row justify-between items-center mb-6">
                    <Text className="text-gray-900 text-2xl font-JakartaBold">{t('submitTicket')}</Text>
                    <TouchableOpacity onPress={() => setIsModalOpen(false)} className="p-2">
                        <Feather name="x" size={24} color="#6b7280" />
                    </TouchableOpacity>
                </View>

                <View className="gap-4">
                    <View>
                        <Text className="text-gray-500 mb-2 font-JakartaMedium">{t('subject')}</Text>
                        <TextInput 
                            value={formData.subject}
                            onChangeText={(text) => setFormData({...formData, subject: text})}
                            placeholder={t('whatsTheIssue')}
                            placeholderTextColor="#6b7280"
                            className="bg-gray-50 text-gray-900 p-4 rounded-xl border border-gray-200 font-Jakarta"
                        />
                    </View>

                    <View>
                        <Text className="text-gray-500 mb-2 font-JakartaMedium">{t('description')}</Text>
                        <TextInput 
                            value={formData.description}
                            onChangeText={(text) => setFormData({...formData, description: text})}
                            placeholder={t('provideMoreDetails')}
                            placeholderTextColor="#6b7280"
                            multiline
                            numberOfLines={6}
                            textAlignVertical="top"
                            className="bg-gray-50 text-gray-900 p-4 rounded-xl border border-gray-200 h-40 font-Jakarta"
                        />
                    </View>

                    <TouchableOpacity 
                        onPress={handleSubmitTicket}
                        disabled={isSubmitting}
                        className={`bg-orange-500 p-4 rounded-xl mt-4 items-center flex-row justify-center ${isSubmitting ? 'opacity-70' : ''}`}
                    >
                        {isSubmitting ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <>
                                <Feather name="send" size={18} color="white" className="mr-2" />
                                <Text className="text-white font-JakartaBold text-lg ml-2">{t('sendTicket')}</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            </View>
        </View>
      </Modal>
    </View>
  );
}
