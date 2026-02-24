import { View, Text, TouchableOpacity, ScrollView, Dimensions, ActivityIndicator, RefreshControl, Alert, Modal, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { getDriverWalletInfo, getDriverWalletTransactions, requestWithdrawal, getPlatformSetting, WalletInfo, WalletTransaction } from '@/lib/wallet';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';

const { width } = Dimensions.get('window');

const DriverWallet = () => {
    const { driverProfile } = useAuth();
    const { t } = useLanguage();
    
    // Data states
    const [wallet, setWallet] = useState<WalletInfo | null>(null);
    const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
    const [payoutSettings, setPayoutSettings] = useState<any>(null);
    
    // UI states
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [showWithdrawModal, setShowWithdrawModal] = useState(false);
    const [withdrawAmount, setWithdrawAmount] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const fetchData = async () => {
        if (!driverProfile?.id) return;
        
        try {
            const [walletRes, txRes, settingsRes] = await Promise.all([
                getDriverWalletInfo(driverProfile.id),
                getDriverWalletTransactions(driverProfile.id, 20),
                getPlatformSetting('payout')
            ]);
            
            if (walletRes.data) setWallet(walletRes.data);
            if (txRes.data) setTransactions(txRes.data);
            if (settingsRes.data) setPayoutSettings(settingsRes.data);
            
        } catch (error) {
            console.error('Error fetching wallet dashboard:', error);
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
            Alert.alert(t('error'), t('invalidAmount'));
            return;
        }
        
        const minConfig = payoutSettings?.min_withdrawal || 100;
        const maxConfig = payoutSettings?.max_withdrawal || 50000;
        
        if (amount < minConfig) {
            Alert.alert(t('error'), `${t('minWithdrawalAmount')} ₹${minConfig}`);
            return;
        }
        if (amount > maxConfig) {
            Alert.alert(t('error'), `${t('maxWithdrawalAmount')} ₹${maxConfig}`);
            return;
        }
        if (amount > wallet.available_balance) {
            Alert.alert(t('error'), t('insufficientBalance'));
            return;
        }

        setIsSubmitting(true);
        const { success, error } = await requestWithdrawal(driverProfile!.id, amount);
        setIsSubmitting(false);

        if (success) {
            Alert.alert(t('success'), t('withdrawalRequestedSuccess'));
            setShowWithdrawModal(false);
            setWithdrawAmount('');
            fetchData();
        } else {
            // Handle specific KYC error or general error
            Alert.alert(t('error'), error || t('withdrawalRequestFailed'));
        }
    };

    if (isLoading) {
        return (
            <SafeAreaView className="flex-1 bg-white items-center justify-center">
                <ActivityIndicator size="large" color="#22c55e" />
                <Text className="text-gray-600 mt-4">{t('loadingWallet') || 'Loading Wallet...'}</Text>
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
                {/* Header */}
                <View className="p-5 flex-row justify-between items-center bg-green-500 rounded-b-3xl">
                    <View>
                        <Text className="text-white text-3xl font-JakartaBold mb-1">
                            ₹{(wallet?.available_balance || 0).toLocaleString()}
                        </Text>
                        <Text className="text-green-100 text-sm font-JakartaMedium">{t('availableBalance') || 'Available for Withdrawal'}</Text>
                    </View>
                    <Ionicons name="wallet-outline" size={48} color="rgba(255,255,255,0.8)" />
                </View>

                {/* Sub Balances */}
                <View className="flex-row mx-5 mt-6 gap-4">
                    <View className="flex-1 bg-orange-50 border border-orange-100 rounded-2xl p-4">
                        <View className="flex-row items-center gap-2 mb-2">
                            <Ionicons name="time-outline" size={18} color="#ea580c" />
                            <Text className="text-orange-700 text-xs font-JakartaMedium">{t('pendingBalance') || 'Pending Escrow'}</Text>
                        </View>
                        <Text className="text-gray-900 text-xl font-JakartaBold">
                            ₹{(wallet?.pending_balance || 0).toLocaleString()}
                        </Text>
                        <Text className="text-gray-500 text-[10px] mt-1">Releases after trip ends</Text>
                    </View>
                    
                    <View className="flex-1 bg-blue-50 border border-blue-100 rounded-2xl p-4">
                        <View className="flex-row items-center gap-2 mb-2">
                            <Ionicons name="bar-chart-outline" size={18} color="#2563eb" />
                            <Text className="text-blue-700 text-xs font-JakartaMedium">{t('totalEarned') || 'Total Earned'}</Text>
                        </View>
                        <Text className="text-gray-900 text-xl font-JakartaBold">
                            ₹{(wallet?.total_earned || 0).toLocaleString()}
                        </Text>
                    </View>
                </View>

                {/* Action Buttons */}
                <View className="mx-5 mt-6 flex-row gap-4">
                    <TouchableOpacity 
                        onPress={() => setShowWithdrawModal(true)}
                        disabled={!wallet || wallet.available_balance <= 0 || wallet.pending_withdrawals > 0}
                        className={`flex-1 py-4 rounded-xl items-center flex-row justify-center gap-2 ${
                            (!wallet || wallet.available_balance <= 0 || wallet.pending_withdrawals > 0) 
                            ? 'bg-gray-200' 
                            : 'bg-green-500'
                        }`}
                    >
                        <Ionicons name="cash-outline" size={20} color={(!wallet || wallet.available_balance <= 0 || wallet.pending_withdrawals > 0) ? '#9ca3af' : 'white'} />
                        <Text className={`font-JakartaBold text-lg ${
                            (!wallet || wallet.available_balance <= 0 || wallet.pending_withdrawals > 0) ? 'text-gray-500' : 'text-white'
                        }`}>
                            {t('withdraw') || 'Withdraw'}
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Status Messages */}
                {wallet?.pending_withdrawals > 0 && (
                    <View className="mx-5 mt-4 bg-yellow-50 border border-yellow-200 p-3 rounded-lg flex-row items-center gap-3">
                        <Ionicons name="alert-circle" size={20} color="#ca8a04" />
                        <Text className="flex-1 text-sm text-yellow-800">
                            You have ₹{wallet.pending_withdrawals} pending withdrawal request. Please wait for processing.
                        </Text>
                    </View>
                )}
                
                {wallet?.verification_status !== 'verified' && (
                    <View className="mx-5 mt-4 bg-red-50 border border-red-200 p-3 rounded-lg flex-row items-center gap-3">
                        <Ionicons name="shield-outline" size={20} color="#dc2626" />
                        <View className="flex-1">
                            <Text className="text-sm font-JakartaSemiBold text-red-800">Bank KYC Required</Text>
                            <Text className="text-xs text-red-600">Please complete KYC in profile to withdraw.</Text>
                        </View>
                    </View>
                )}

                {/* Transaction Ledger */}
                <View className="mx-5 mt-8">
                    <Text className="text-gray-900 text-lg font-JakartaBold mb-4">{t('recentTransactions') || 'Recent Transactions'}</Text>
                    
                    {transactions.length > 0 ? (
                        transactions.map(tx => (
                            <View key={tx.id} className="bg-gray-50 border border-gray-100 rounded-xl p-4 mb-3 flex-row items-center">
                                <View className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${
                                    tx.type === 'withdrawal' ? 'bg-orange-100' : 
                                    tx.type === 'release' ? 'bg-blue-100' :
                                    tx.type === 'reversal' ? 'bg-purple-100' :
                                    'bg-green-100'
                                }`}>
                                    <Ionicons 
                                        name={
                                            tx.type === 'withdrawal' ? 'arrow-up' : 
                                            tx.type === 'release' ? 'swap-vertical' :
                                            tx.type === 'reversal' ? 'refresh' :
                                            'arrow-down'
                                        } 
                                        size={20} 
                                        color={
                                            tx.type === 'withdrawal' ? '#ea580c' : 
                                            tx.type === 'release' ? '#2563eb' :
                                            tx.type === 'reversal' ? '#9333ea' :
                                            '#16a34a'
                                        } 
                                    />
                                </View>
                                
                                <View className="flex-1">
                                    <Text className="text-gray-900 font-JakartaSemiBold capitalize">{tx.type}</Text>
                                    <Text className="text-gray-500 text-xs mt-0.5">
                                        {new Date(tx.created_at).toLocaleDateString()} • {tx.balance_type}
                                    </Text>
                                    {tx.description && (
                                        <Text className="text-gray-400 text-[10px] mt-1" numberOfLines={1}>{tx.description}</Text>
                                    )}
                                </View>
                                
                                <View className="items-end">
                                    <Text className={`font-JakartaBold text-base ${
                                        tx.direction === 'credit' ? 'text-green-600' : 'text-gray-900'
                                    }`}>
                                        {tx.direction === 'credit' ? '+' : '-'}₹{tx.amount}
                                    </Text>
                                    <View className={`px-2 py-0.5 rounded-full mt-1 flex-row items-center ${
                                        tx.status === 'completed' ? 'bg-green-100' :
                                        tx.status === 'pending' ? 'bg-yellow-100' :
                                        'bg-red-100'
                                    }`}>
                                        <Text className={`text-[10px] uppercase font-JakartaBold ${
                                            tx.status === 'completed' ? 'text-green-700' :
                                            tx.status === 'pending' ? 'text-yellow-700' :
                                            'text-red-700'
                                        }`}>
                                            {tx.status}
                                        </Text>
                                    </View>
                                </View>
                            </View>
                        ))
                    ) : (
                        <View className="bg-gray-50 border border-gray-100 rounded-xl p-8 items-center justify-center">
                            <Ionicons name="receipt-outline" size={48} color="#d1d5db" className="mb-2" />
                            <Text className="text-gray-500 text-center">{t('noTransactions') || 'No transactions yet. Complete trips to earn.'}</Text>
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

export default DriverWallet;
