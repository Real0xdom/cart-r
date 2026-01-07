import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';

interface Notification {
  id: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
}

export default function NotificationsScreen() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
      if (error) throw error;
      
      const formattedData = (data || []).map(n => ({
        ...n,
        is_read: n.is_read || false,
        created_at: n.created_at || new Date().toISOString()
      }));
      setNotifications(formattedData);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();

    // Subscribe to new notifications
    const subscription = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user?.id}`,
        },
        (payload) => {
          const newNotif = payload.new as Notification;
          setNotifications((prev) => [newNotif, ...prev]);
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user?.id]);

  const markAsRead = async (id: string) => {
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id);
      
      setNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, is_read: true } : n)
      );
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const getIcon = (title: string) => {
    if (title.toLowerCase().includes('payment')) return 'dollar-sign';
    if (title.toLowerCase().includes('trip')) return 'map-pin';
    if (title.toLowerCase().includes('welcome')) return 'smile';
    return 'bell';
  };

  return (
    <View className="flex-1 bg-gray-900">
      <ScrollView className="flex-1 p-5">
        
        {/* Test button removed as per requirements */}

        {loading ? (
             <ActivityIndicator size="large" color="#22c55e" className="mt-10" />
        ) : notifications.length === 0 ? (
            <View className="items-center mt-10">
                <View className="w-16 h-16 bg-gray-800 rounded-full items-center justify-center mb-4">
                    <Feather name="bell-off" size={32} color="#6b7280" />
                </View>
                <Text className="text-gray-400 text-lg">No notifications yet</Text>
            </View>
        ) : (
            notifications.map((item) => (
                <TouchableOpacity 
                    key={item.id}
                    onPress={() => markAsRead(item.id)}
                    className={`p-4 rounded-xl mb-3 border ${item.is_read ? 'bg-gray-800 border-gray-800' : 'bg-gray-800 border-primary-500'}`}
                >
                    <View className="flex-row">
                        <View className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${item.is_read ? 'bg-gray-700' : 'bg-primary-500/20'}`}>
                            <Feather name={getIcon(item.title)} size={20} color={item.is_read ? '#9ca3af' : '#22c55e'} />
                        </View>
                        <View className="flex-1">
                            <View className="flex-row justify-between items-start">
                                <Text className={`font-JakartaSemiBold mb-1 ${item.is_read ? 'text-gray-400' : 'text-white'}`}>
                                    {item.title}
                                </Text>
                                <Text className="text-gray-600 text-xs">
                                    {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </Text>
                            </View>
                            <Text className="text-gray-500 text-sm leading-5">
                                {item.body}
                            </Text>
                        </View>
                    </View>
                </TouchableOpacity>
            ))
        )}
        
        <View className="h-10" /> 
      </ScrollView>
    </View>
  );
}
