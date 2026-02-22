import { View, Text, ScrollView, TouchableOpacity, Linking, Modal, TextInput, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { getUserTickets, getTicketDetails, type TicketMessage } from '@/lib/support';

interface FAQItem {
    question: string;
    answer: string;
}

interface MyTicket {
  id: string;
  subject: string;
  status: string;
  created_at: string;
}

export default function Help() {
  const router = useRouter();
  const { profile } = useAuth();
  const { t } = useLanguage();
  
  const [faqs, setFaqs] = useState<FAQItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({ subject: '', description: '' });
  const [myTickets, setMyTickets] = useState<MyTicket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [ticketDetail, setTicketDetail] = useState<{ subject: string; description: string } | null>(null);
  const [ticketMessages, setTicketMessages] = useState<TicketMessage[]>([]);

  const fetchTickets = useCallback(async () => {
    if (!profile?.id) return;
    setTicketsLoading(true);
    const { data } = await getUserTickets();
    setMyTickets((data || []).map((t: any) => ({ id: t.id, subject: t.subject, status: t.status, created_at: t.created_at })));
    setTicketsLoading(false);
  }, [profile?.id]);

  useEffect(() => {
    fetchFaqs();
  }, []);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  async function fetchFaqs() {
    try {
        const { data, error } = await supabase
            .from('faqs')
            .select('question, answer')
            .eq('is_active', true)
            .in('target_audience', ['customer', 'all'])
            .order('created_at', { ascending: false });

        if (error) throw error;
        setFaqs(data || []);
    } catch (error) {
        console.error('Error fetching FAQs:', error);
    } finally {
        setLoading(false);
    }
  }

  const handleSubmitTicket = async () => {
    if (!formData.subject || !formData.description) {
        return Alert.alert(t('info'), t('missingFields'));
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
                source_app: 'customer_app',
            }]);

        if (error) throw error;
        
        Alert.alert(t('success'), t('ticketSubmitted'));
        setIsModalOpen(false);
        setFormData({ subject: '', description: '' });
        fetchTickets();
    } catch (error: any) {
        Alert.alert(t('error'), error.message || 'Failed to submit ticket');
    } finally {
        setIsSubmitting(false);
    }
  };

  const openLink = (url: string) => Linking.openURL(url);

  async function openTicketConversation(ticketId: string) {
    const { ticket, messages } = await getTicketDetails(ticketId);
    if (ticket) {
      setTicketDetail({ subject: ticket.subject, description: ticket.description });
      setTicketMessages(messages || []);
      setSelectedTicketId(ticketId);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View className="flex flex-row items-center px-5 py-4 border-b border-gray-100">
        <TouchableOpacity onPress={() => router.back()} className="mr-4 w-10 h-10 items-center justify-center bg-gray-50 rounded-full">
          <Ionicons name="arrow-back" size={24} color="black" />
        </TouchableOpacity>
        <Text className="text-xl font-JakartaBold">{t('helpCenter')}</Text>
      </View>

      <ScrollView className="flex-1 px-5 pt-6" contentContainerStyle={{ paddingBottom: 40 }}>
        
        <Text className="text-2xl font-JakartaBold text-gray-900 mb-2">{t('howCanWeHelp')}</Text>
        <Text className="text-gray-500 mb-6">{t('findAnswers')}</Text>

        {/* Quick Contact Options */}
        <View className="flex flex-row gap-4 mb-8">
            <TouchableOpacity 
                onPress={() => setIsModalOpen(true)}
                className="flex-1 bg-green-500 p-4 rounded-2xl items-center shadow-lg shadow-green-200"
            >
                <Feather name="message-circle" size={24} color="white" />
                <Text className="text-white font-JakartaBold mt-2">{t('messageUs')}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
                onPress={() => openLink('tel:1800123456')}
                className="flex-1 bg-gray-900 p-4 rounded-2xl items-center shadow-lg"
            >
                <Feather name="phone" size={24} color="white" />
                <Text className="text-white font-JakartaBold mt-2">{t('callUs')}</Text>
            </TouchableOpacity>
        </View>

        {/* My tickets */}
        <Text className="text-lg font-JakartaBold text-gray-900 mb-4 mt-2">{t('mySupportTickets')}</Text>
        {ticketsLoading ? (
          <ActivityIndicator color="#10b981" className="my-4" />
        ) : myTickets.length === 0 ? (
          <View className="py-6 items-center bg-gray-50 rounded-2xl border border-dashed border-gray-300 mb-6">
            <Text className="text-gray-400">{t('noTicketsYet')}</Text>
            <Text className="text-gray-400 text-sm mt-1">{t('useMessageUs')}</Text>
          </View>
        ) : (
          <View className="mb-6">
            {myTickets.map((t) => (
              <TouchableOpacity
                key={t.id}
                onPress={() => openTicketConversation(t.id)}
                className="bg-gray-50 p-4 rounded-2xl border border-gray-100 mb-3 flex-row items-center justify-between"
              >
                <View className="flex-1">
                  <Text className="text-gray-900 font-JakartaSemiBold">{t.subject}</Text>
                  <Text className="text-gray-500 text-xs mt-1">
                    {new Date(t.created_at).toLocaleDateString()} · {t.status.replace('_', ' ')}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* FAQs Section */}
        <Text className="text-lg font-JakartaBold text-gray-900 mb-4">{t('frequentlyAskedQuestions')}</Text>
        
        {loading ? (
            <ActivityIndicator color="#10b981" className="my-10" />
        ) : faqs.length === 0 ? (
            <View className="py-10 items-center bg-gray-50 rounded-2xl border border-dashed border-gray-300">
                <Text className="text-gray-400">{t('noFaqsAvailable')}</Text>
            </View>
        ) : (
            faqs.map((faq, index) => (
                <View key={index} className="mb-4 bg-gray-50 p-5 rounded-2xl border border-gray-100">
                    <Text className="text-gray-900 font-JakartaSemiBold text-base mb-2">{faq.question}</Text>
                    <Text className="text-gray-600 leading-5 font-Jakarta">{faq.answer}</Text>
                </View>
            ))
        )}

        {/* Email Option */}
        <TouchableOpacity 
            onPress={() => openLink('mailto:support@cartr.com')}
            className="mt-4 flex flex-row items-center justify-center py-4 rounded-2xl border border-gray-200"
        >
            <Ionicons name="mail-outline" size={20} color="#6b7280" />
            <Text className="ml-2 text-gray-500 font-JakartaMedium">Email: support@cartr.com</Text>
        </TouchableOpacity>

      </ScrollView>

      {/* TICKET MODAL */}
      <Modal
        visible={isModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsModalOpen(false)}
      >
        <View className="flex-1 bg-black/50 justify-end">
            <View className="bg-white rounded-t-[40px] p-8 h-[75%] shadow-2xl">
                <View className="flex-row justify-between items-center mb-8">
                    <Text className="text-2xl font-JakartaBold text-gray-900">{t('newSupportTicket')}</Text>
                    <TouchableOpacity 
                        onPress={() => setIsModalOpen(false)}
                        className="bg-gray-100 p-2 rounded-full"
                    >
                        <Ionicons name="close" size={24} color="#374151" />
                    </TouchableOpacity>
                </View>

                <View className="space-y-6">
                    <View>
                        <Text className="text-gray-700 font-JakartaBold mb-2 ml-1">{t('subject')}</Text>
                        <TextInput 
                            value={formData.subject}
                            onChangeText={(text) => setFormData({...formData, subject: text})}
                            placeholder={t('inquiryPlaceholder')}
                            className="bg-gray-50 p-4 rounded-2xl border border-gray-100 font-Jakarta"
                        />
                    </View>

                    <View>
                        <Text className="text-gray-700 font-JakartaBold mb-2 ml-1">{t('description')}</Text>
                        <TextInput 
                            value={formData.description}
                            onChangeText={(text) => setFormData({...formData, description: text})}
                            placeholder={t('tellUsMore')}
                            multiline
                            numberOfLines={6}
                            textAlignVertical="top"
                            className="bg-gray-50 p-4 rounded-2xl border border-gray-100 h-40 font-Jakarta"
                        />
                    </View>

                    <TouchableOpacity 
                        onPress={handleSubmitTicket}
                        disabled={isSubmitting}
                        className={`bg-green-500 py-4 rounded-2xl mt-4 items-center flex-row justify-center shadow-lg shadow-green-200 ${isSubmitting ? 'opacity-70' : ''}`}
                    >
                        {isSubmitting ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <Text className="text-white font-JakartaBold text-lg">{t('submitTicket')}</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </View>
        </View>
      </Modal>

      {/* Ticket conversation modal */}
      <Modal
        visible={!!selectedTicketId}
        animationType="slide"
        transparent={true}
        onRequestClose={() => { setSelectedTicketId(null); setTicketDetail(null); setTicketMessages([]); }}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-[40px] p-6 max-h-[85%]">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-lg font-JakartaBold text-gray-900">{ticketDetail?.subject || t('ticket')}</Text>
              <TouchableOpacity
                onPress={() => { setSelectedTicketId(null); setTicketDetail(null); setTicketMessages([]); }}
                className="bg-gray-100 p-2 rounded-full"
              >
                <Ionicons name="close" size={24} color="#374151" />
              </TouchableOpacity>
            </View>
            <ScrollView className="max-h-96">
              {ticketDetail && (
                <View className="mb-4 p-3 bg-gray-50 rounded-xl">
                  <Text className="text-xs font-JakartaBold text-gray-500 uppercase mb-1">{t('yourMessage')}</Text>
                  <Text className="text-gray-800 font-Jakarta">{ticketDetail.description}</Text>
                </View>
              )}
              {ticketMessages.map((msg) => (
                <View
                  key={msg.id}
                  className={`mb-3 p-3 rounded-xl ${msg.sender_type === 'support' ? 'bg-green-50 ml-4' : 'bg-gray-50 mr-4'}`}
                >
                  <Text className="text-xs font-JakartaBold text-gray-500 mb-1">
                    {msg.sender_type === 'support' ? t('support') : t('you')}
                  </Text>
                  <Text className="text-gray-800 font-Jakarta">{msg.message}</Text>
                  <Text className="text-xs text-gray-400 mt-1">{new Date(msg.created_at).toLocaleString()}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
