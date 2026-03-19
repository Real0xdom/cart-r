import { View, Text, FlatList, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Stack } from 'expo-router';
import { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '@/lib/supabase';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

interface SmsLog {
    id: number;
    phone_number: string;
    message: string;
    status: string;
    error_message: string;
    created_at: string;
    sent_at: string;
    attempts: number;
}

export default function DebugSmsScreen() {
    const [logs, setLogs] = useState<SmsLog[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchLogs = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('sms_queue')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) {
            Alert.alert('Error', error.message);
        } else {
            setLogs(data || []);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchLogs();
    }, []);

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'sent': return 'text-green-600';
            case 'failed': return 'text-red-600';
            case 'pending': return 'text-blue-600';
            default: return 'text-gray-600';
        }
    };

    const renderItem = ({ item }: { item: SmsLog }) => (
        <View className="bg-white p-4 mb-2 rounded-lg border border-gray-200">
            <View className="flex-row justify-between items-center mb-1">
                <Text className="font-bold text-gray-800">To: {item.phone_number}</Text>
                <Text className={`font-bold uppercase text-xs ${getStatusColor(item.status)}`}>
                    {item.status}
                </Text>
            </View>
            <Text className="text-xs text-gray-500 mb-2">{new Date(item.created_at).toLocaleString()}</Text>
            <Text className="text-gray-700 text-sm mb-2" numberOfLines={2}>{item.message}</Text>
            
            {item.error_message && (
                <View className="bg-red-50 p-2 rounded mt-1">
                    <Text className="text-red-600 text-xs">Error: {item.error_message}</Text>
                </View>
            )}
            
            <View className="flex-row justify-between mt-2 pt-2 border-t border-gray-100">
                <Text className="text-xs text-gray-400">Attempts: {item.attempts}</Text>
                <Text className="text-xs text-gray-400">ID: {item.id}</Text>
            </View>
        </View>
    );

    return (
        <SafeAreaView className="flex-1 bg-gray-50">
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar style="dark" />
            
            <View className="p-4 bg-white border-b border-gray-200 flex-row justify-between items-center">
                <Text className="text-xl font-bold text-gray-800">SMS Monitor</Text>
                <TouchableOpacity onPress={fetchLogs} className="bg-gray-100 p-2 rounded-full">
                    <Feather name="refresh-cw" size={20} color="black" />
                </TouchableOpacity>
            </View>

            {loading ? (
                <View className="flex-1 justify-center items-center">
                    <ActivityIndicator size="large" color="#000" />
                </View>
            ) : (
                <FlatList
                    data={logs}
                    renderItem={renderItem}
                    keyExtractor={(item) => item.id.toString()}
                    contentContainerStyle={{ padding: 16 }}
                    ListEmptyComponent={
                        <Text className="text-center text-gray-500 mt-10">No SMS logs found.</Text>
                    }
                />
            )}
        </SafeAreaView>
    );
}
