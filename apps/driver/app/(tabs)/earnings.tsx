import { View, Text, TouchableOpacity, ScrollView, Dimensions, ActivityIndicator, RefreshControl, Alert, Modal, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useCallback } from 'react';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { getDriverWalletInfo, requestWithdrawal, getPlatformSetting, WalletInfo } from '@/lib/wallet';
import { getDriverCompletedTrips, Booking } from '@/lib/bookings';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';

const { width } = Dimensions.get('window');

interface DailyEarning {
    day: string;
    amount: number;
    trips: number;
}

const BarChart = ({ data }: { data: DailyEarning[] }) => {
    const maxAmount = Math.max(...data.map(d => d.amount), 1);
    const barWidth = (width - 80) / data.length - 8;

    return (
        <View className="flex-row justify-between items-end h-32 px-2">
            {data.map((item, index) => (
                <View key={index} className="items-center">
                    <View
                        style={{
                            height: Math.max((item.amount / maxAmount) * 100, 4),
                            width: barWidth,
                        }}
                        className="bg-green-500 rounded-t-lg mb-2"
                    />
                    <Text className="text-gray-600 text-xs">{item.day}</Text>
                </View>
            ))}
        </View>
    );
};

const DriverEarnings = () => {
    const { driverProfile } = useAuth();
    const { t } = useLanguage();
    
    // Data states
    const [wallet, setWallet] = useState<WalletInfo | null>(null);
    const [payoutSettings, setPayoutSettings] = useState<any>(null);
    const [trips, setTrips] = useState<Booking[]>([]);
    const [period, setPeriod] = useState<'today' | 'week' | 'month'>('week');
    
    // UI states
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [showWithdrawModal, setShowWithdrawModal] = useState(false);
    const [withdrawAmount, setWithdrawAmount] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const fetchData = async () => {
        if (!driverProfile?.id) return;
        
        try {
            const [walletRes, settingsRes, tripsRes] = await Promise.all([
                getDriverWalletInfo(driverProfile.id),
                getPlatformSetting('payout'),
                getDriverCompletedTrips(driverProfile.id, 100)
            ]);
            
            if (walletRes.data) setWallet(walletRes.data);
            if (settingsRes.data) setPayoutSettings(settingsRes.data);
            if (!tripsRes.error && tripsRes.data) setTrips(tripsRes.data);
            
        } catch (error) {
            console.error('Error fetching earnings dashboard:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        
        // Subscribe to real-time wallet updates
        if (driverProfile?.id) {
            const walletSub = supabase
                .channel('wallet_updates')
                .on('postgres_changes', { 
                    event: '*', 
                    schema: 'public', 
                    table: 'driver_wallets',
                    filter: `driver_id=eq.${driverProfile.id}`
                }, () => {
                    fetchData();
                })
                .subscribe();

            return () => {
                supabase.removeChannel(walletSub);
            };
        }
    }, [driverProfile?.id]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await fetchData();
        setRefreshing(false);
    }, [driverProfile?.id]);

    const handleWithdrawRequest = async () => {
        if (!wallet) return;
        
        const amount = Number(withdrawAmount);
        if (isNaN(amount) || amount <= 0) {
            Alert.alert(t('error') || 'Error', t('invalidAmount') || 'Invalid amount');
            return;
        }
        
        const minConfig = payoutSettings?.min_withdrawal || 100;
        const maxConfig = payoutSettings?.max_withdrawal || 50000;
        
        if (amount < minConfig) {
            Alert.alert(t('error') || 'Error', `${t('minWithdrawalAmount') || 'Minimum withdrawal is'} ₹${minConfig}`);
            return;
        }
        if (amount > maxConfig) {
            Alert.alert(t('error') || 'Error', `${t('maxWithdrawalAmount') || 'Maximum withdrawal is'} ₹${maxConfig}`);
            return;
        }
        if (amount > wallet.available_balance) {
            Alert.alert(t('error') || 'Error', t('insufficientBalance') || 'Insufficient balance');
            return;
        }

        setIsSubmitting(true);
        const { success, error } = await requestWithdrawal(driverProfile!.id, amount);
        setIsSubmitting(false);

        if (success) {
            Alert.alert(t('success') || 'Success', t('withdrawalRequestedSuccess') || 'Withdrawal requested successfully');
            setShowWithdrawModal(false);
            setWithdrawAmount('');
            fetchData();
        } else {
            Alert.alert(t('error') || 'Error', error || t('withdrawalRequestFailed') || 'Withdrawal request failed');
        }
    };

    // Filter trips by period
    const getFilteredTrips = () => {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekStart = new Date(todayStart);
        weekStart.setDate(weekStart.getDate() - 7);
        const monthStart = new Date(todayStart);
        monthStart.setMonth(monthStart.getMonth() - 1);

        return trips.filter(trip => {
            const tripDate = new Date(trip.completed_at || trip.created_at);
            switch (period) {
                case 'today':
                    return tripDate >= todayStart;
                case 'week':
                    return tripDate >= weekStart;
                case 'month':
                    return tripDate >= monthStart;
                default:
                    return true;
            }
        });
    };

    // Calculate weekly chart data
    const getWeeklyData = (): DailyEarning[] => {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const weekData: DailyEarning[] = days.map(day => ({ day, amount: 0, trips: 0 }));
        
        const now = new Date();
        const weekStart = new Date(now);
        weekStart.setDate(weekStart.getDate() - 6);
        weekStart.setHours(0, 0, 0, 0);

        trips.forEach(trip => {
            const tripDate = new Date(trip.completed_at || trip.created_at);
            if (tripDate >= weekStart) {
                const dayIndex = tripDate.getDay();
                weekData[dayIndex].amount += (trip.driver_payout || trip.total_fare);
                weekData[dayIndex].trips += 1;
            }
        });

        // Reorder to start from today and go back 7 days
        const todayIndex = now.getDay();
        const reordered: DailyEarning[] = [];
        for (let i = 6; i >= 0; i--) {
            const idx = (todayIndex - i + 7) % 7;
            reordered.push(weekData[idx]);
        }
        return reordered;
    };

    const filteredTrips = getFilteredTrips();
    const periodEarnings = filteredTrips.reduce((sum, t) => sum + (t.driver_payout || t.total_fare), 0);
    const tripsCount = filteredTrips.length;
    const avgPerTrip = tripsCount > 0 ? Math.round(periodEarnings / tripsCount) : 0;
    const recentTrips = filteredTrips.slice(0, 10);
    const weeklyData = getWeeklyData();

    if (isLoading) {
        return (
            <SafeAreaView className="flex-1 bg-white items-center justify-center">
                <ActivityIndicator size="large" color="#22c55e" />
                <Text className="text-gray-600 mt-4">{t('loadingWallet') || 'Loading Earnings...'}</Text>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-white">
            <ScrollView 
                className="flex-1" 
                contentContainerStyle={{ paddingBottom: 100 }}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#22c55e" />
                }
            >
                {/* Header Context */}
                <View className="p-5 flex-row justify-between items-center bg-green-500 rounded-b-3xl mb-6">
                    <View>
                        <Text className="text-white text-3xl font-JakartaBold mb-1">
                            ₹{(wallet?.available_balance || 0).toLocaleString()}
                        </Text>
                        <Text className="text-green-100 text-sm font-JakartaMedium">{t('availableBalance') || 'Withdrawable Balance'}</Text>
                        {(wallet?.pending_balance || 0) > 0 && (
                            <Text className="text-green-50 text-xs mt-1">
                                + ₹{wallet?.pending_balance.toLocaleString()} {t('pendingBalance') || 'pending'}
                            </Text>
                        )}
                    </View>
                    
                    <TouchableOpacity 
                        onPress={() => setShowWithdrawModal(true)}
                        disabled={!wallet || wallet.available_balance <= 0 || wallet.pending_withdrawals > 0}
                        className={`py-2 px-4 rounded-xl flex-row items-center justify-center gap-2 ${
                            (!wallet || wallet.available_balance <= 0 || wallet.pending_withdrawals > 0) 
                            ? 'bg-green-600/50' 
                            : 'bg-white'
                        }`}
                    >
                        <Text className={`font-JakartaBold ${
                            (!wallet || wallet.available_balance <= 0 || wallet.pending_withdrawals > 0) ? 'text-green-100/50' : 'text-green-600'
                        }`}>
                            {t('withdraw') || 'Withdraw'}
                        </Text>
                    </TouchableOpacity>
                </View>

                {wallet?.verification_status !== 'approved' && (
                    <TouchableOpacity 
                        onPress={() => router.push('/profile/bank')}
                        className="mx-5 mb-4 bg-red-50 border border-red-200 p-4 rounded-xl flex-row items-center justify-between shadow-sm shadow-red-100"
                    >
                        <View className="flex-row items-center flex-1">
                            <View className="bg-red-100 p-2 rounded-full mr-3">
                                <Ionicons name="shield-outline" size={20} color="#dc2626" />
                            </View>
                            <View className="flex-1 pr-2">
                                <Text className="text-sm font-JakartaBold text-red-900 mb-0.5">KYC Required</Text>
                                <Text className="text-xs font-JakartaMedium text-red-600 leading-tight">
                                    Please complete bank KYC to enable withdrawals.
                                </Text>
                            </View>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color="#ef4444" />
                    </TouchableOpacity>
                )}

                {/* Period Selector */}
                <View className="flex-row mx-5 bg-gray-100 rounded-xl p-1 mb-6">
                    {(['today', 'week', 'month'] as const).map((p) => (
                        <TouchableOpacity
                            key={p}
                            onPress={() => setPeriod(p)}
                            className={`flex-1 py-3 rounded-lg ${period === p ? 'bg-green-500' : ''}`}
                        >
                            <Text className={`text-center font-JakartaSemiBold capitalize ${period === p ? 'text-white' : 'text-gray-600'}`}>
                                {t(p) || p}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Total Earnings Card */}
                <View className="mx-5 bg-green-50 border border-green-200 rounded-2xl p-6 mb-6">
                    <Text className="text-green-700 text-sm mb-1">{t('totalEarningsPeriod') || 'Earnings'} ({t(period) || period})</Text>
                    <Text className="text-gray-900 text-4xl font-JakartaBold">₹{periodEarnings.toLocaleString()}</Text>
                    <View className="flex-row mt-4 justify-between">
                        <View>
                            <Text className="text-gray-500 text-xs">{t('trips') || 'Trips'}</Text>
                            <Text className="text-gray-900 font-JakartaSemiBold">{tripsCount}</Text>
                        </View>
                        <View>
                            <Text className="text-gray-500 text-xs">{t('lifetimeEarnings') || 'Lifetime'}</Text>
                            <Text className="text-gray-900 font-JakartaSemiBold">₹{(wallet?.total_earned || driverProfile?.total_earnings || 0).toLocaleString()}</Text>
                        </View>
                        <View>
                            <Text className="text-gray-500 text-xs">{t('avgPerTrip') || 'Avg/Trip'}</Text>
                            <Text className="text-gray-900 font-JakartaSemiBold">₹{avgPerTrip}</Text>
                        </View>
                    </View>
                </View>

                {/* Chart */}
                <View className="mx-5 bg-gray-50 border border-gray-200 rounded-2xl p-4 mb-6">
                    <Text className="text-gray-900 font-JakartaBold mb-4">{t('last7Days') || 'Last 7 Days Earnings'}</Text>
                    <BarChart data={weeklyData} />
                </View>

                {/* Recent Trips */}
                <View className="mx-5">
                    <Text className="text-gray-900 font-JakartaBold mb-4">{t('recentTrips') || 'Recent Trips'}</Text>
                    {recentTrips.length > 0 ? (
                        recentTrips.map(trip => {
                            const isCash = !trip.payment_method || trip.payment_method.toLowerCase() === 'cash' || trip.payment_method.toLowerCase() === 'upi';
                            return (
                                <View key={trip.id} className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-3">
                                    <View className="flex-row justify-between items-center mb-2">
                                        <View className="flex-1 mr-2">
                                            <Text className="text-gray-900 font-JakartaSemiBold" numberOfLines={1}>
                                                {trip.origin_address.split(',')[0]} → {trip.destination_address.split(',')[0]}
                                            </Text>
                                            <Text className="text-gray-500 text-[10px] mt-0.5">
                                                {new Date(trip.completed_at || trip.created_at).toLocaleDateString('en-IN', {
                                                    day: 'numeric',
                                                    month: 'short',
                                                    hour: '2-digit',
                                                    minute: '2-digit',
                                                })}
                                            </Text>
                                        </View>
                                        <Text className="text-gray-900 font-JakartaBold text-lg">
                                            ₹{trip.driver_payout || trip.total_fare}
                                        </Text>
                                    </View>
                                    
                                    <View className="flex-row justify-between items-center pt-2 border-t border-gray-200 mt-1">
                                        <View className="flex-row items-center">
                                            <Ionicons 
                                                name={isCash ? 'cash-outline' : 'card-outline'} 
                                                size={14} 
                                                color={isCash ? '#ea580c' : '#2563eb'} 
                                            />
                                            <Text className={`text-xs ml-1 ${isCash ? 'text-orange-600' : 'text-blue-600'}`}>
                                                {isCash ? 'Cash / UPI' : 'Wallet / Online'}
                                            </Text>
                                        </View>
                                        <Text className="text-[10px] text-gray-500 italic">
                                            {isCash ? 'Already collected by you' : 'Credited to wallet'}
                                        </Text>
                                    </View>
                                </View>
                            );
                        })
                    ) : (
                        <View className="bg-gray-50 border border-gray-200 rounded-xl p-6 items-center">
                            <Text className="text-4xl mb-2">📭</Text>
                            <Text className="text-gray-500 text-center">{t('noCompletedTrips') || 'No completed trips yet'}</Text>
                        </View>
                    )}
                </View>
            </ScrollView>

            {/* Withdrawal Modal */}
            <Modal
                visible={showWithdrawModal}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowWithdrawModal(false)}
            >
                <View className="flex-1 justify-end bg-black/50">
                    <View className="bg-white rounded-t-3xl p-6">
                        <View className="flex-row justify-between items-center mb-6">
                            <Text className="text-2xl font-JakartaBold text-gray-900">Withdraw to Bank</Text>
                            <TouchableOpacity onPress={() => setShowWithdrawModal(false)}>
                                <Ionicons name="close-circle-outline" size={28} color="#6b7280" />
                            </TouchableOpacity>
                        </View>

                        <Text className="text-gray-500 mb-2">Available Balance</Text>
                        <Text className="text-3xl font-JakartaBold text-green-600 mb-6">
                            ₹{(wallet?.available_balance || 0).toLocaleString()}
                        </Text>

                        <Text className="text-gray-900 font-JakartaSemiBold mb-2">Enter Amount</Text>
                        <View className="flex-row items-center bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 mb-2">
                            <Text className="text-xl text-gray-500 mr-2">₹</Text>
                            <TextInput
                                className="flex-1 text-xl font-JakartaSemiBold text-gray-900"
                                keyboardType="numeric"
                                placeholder="0"
                                value={withdrawAmount}
                                onChangeText={setWithdrawAmount}
                            />
                        </View>
                        <View className="flex-row justify-between mb-8">
                            <Text className="text-xs text-gray-500">Min: ₹{payoutSettings?.min_withdrawal || 100}</Text>
                            <TouchableOpacity onPress={() => setWithdrawAmount(String(wallet?.available_balance || 0))}>
                                <Text className="text-xs text-green-600 font-JakartaBold">Max: ₹{wallet?.available_balance || 0}</Text>
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity
                            disabled={isSubmitting || !withdrawAmount}
                            onPress={handleWithdrawRequest}
                            className={`w-full py-4 rounded-xl items-center ${isSubmitting || !withdrawAmount ? 'bg-gray-300' : 'bg-green-500'}`}
                        >
                            {isSubmitting ? (
                                <ActivityIndicator color="white" />
                            ) : (
                                <Text className="text-white text-lg font-JakartaBold">Confirm Withdrawal</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

export default DriverEarnings;
