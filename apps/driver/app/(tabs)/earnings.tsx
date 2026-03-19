import { View, Text, TouchableOpacity, ScrollView, Dimensions, ActivityIndicator, RefreshControl, Alert, Modal, TextInput, Animated, AppState, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useCallback, useRef } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import CashfreeCheckoutModal from '@/components/CashfreeCheckoutModal';
import { getDriverWalletInfo, requestWithdrawal, getPlatformSetting, WalletInfo, getDriverWalletTransactions, getDriverWithdrawals, getWalletPaymentTransactions, WalletTransaction, WithdrawalRequest, WalletPaymentTransaction } from '@/lib/wallet';
import { getDriverCompletedTrips, Booking } from '@/lib/bookings';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

const { width } = Dimensions.get('window');

interface DailyEarning {
    day: string;
    amount: number;
    trips: number;
}

type HistoryTab = 'trips' | 'transactions';

interface TransactionHistoryEntry {
    id: string;
    created_at: string;
    title: string;
    subtitle: string;
    amount: number;
    amountLabel: string;
    amountColor: string;
    icon: keyof typeof Ionicons.glyphMap;
    iconColor: string;
    iconBg: string;
    statusLabel: string;
    statusBg: string;
    statusText: string;
}

const formatHistoryDate = (value: string | null | undefined) => {
    if (!value) return 'Date unavailable';

    return new Date(value).toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};

const isDriverTopupPayment = (transaction: WalletPaymentTransaction) =>
    (transaction.description || '').toLowerCase().includes('driver wallet top-up');

const normalizeWithdrawalStatus = (withdrawal: WithdrawalRequest) => {
    const payoutStatus = withdrawal.payout_status?.toUpperCase();

    if (payoutStatus === 'SUCCESS') return 'success';
    if (payoutStatus === 'FAILED') return 'failed';
    if (payoutStatus === 'REVERSED') return 'reversed';
    if (payoutStatus === 'PENDING' || payoutStatus === 'RECEIVED') return 'processing';
    if (withdrawal.status === 'rejected') return 'rejected';
    if (withdrawal.status === 'approved') return 'approved';
    if (withdrawal.status === 'paid') return 'success';
    if (withdrawal.status === 'failed') return 'failed';
    if (withdrawal.status === 'reversed') return 'reversed';
    return 'pending';
};

const getStatusStyle = (kind: string) => {
    switch (kind) {
        case 'success':
        case 'credited':
            return { label: 'Successful', bg: 'bg-green-100', text: 'text-green-700' };
        case 'processing':
        case 'pending':
        case 'approved':
            return { label: kind === 'approved' ? 'Approved' : 'Pending', bg: 'bg-amber-100', text: 'text-amber-700' };
        case 'failed':
        case 'rejected':
            return { label: kind === 'rejected' ? 'Rejected' : 'Failed', bg: 'bg-red-100', text: 'text-red-700' };
        case 'reversed':
            return { label: 'Reversed', bg: 'bg-slate-100', text: 'text-slate-700' };
        case 'deducted':
            return { label: 'Deducted', bg: 'bg-orange-100', text: 'text-orange-700' };
        default:
            return { label: 'Completed', bg: 'bg-gray-100', text: 'text-gray-700' };
    }
};

const mapWalletLedgerEntry = (transaction: WalletTransaction): TransactionHistoryEntry | null => {
    if (transaction.type === 'withdrawal' || transaction.type === 'reversal') {
        return null;
    }

    let title = 'Wallet activity';
    let subtitle = transaction.description || 'Driver wallet updated';
    let amountLabel = `₹${Number(transaction.amount || 0).toLocaleString()}`;
    let amountColor = transaction.direction === 'debit' ? 'text-red-600' : 'text-green-600';
    let icon: keyof typeof Ionicons.glyphMap = 'wallet-outline';
    let iconColor = '#16a34a';
    let iconBg = 'bg-green-100';
    let statusKey = transaction.status === 'failed' ? 'failed' : 'credited';

    if (transaction.type === 'earning') {
        if (transaction.balance_type === 'pending') {
            title = 'CartR payment pending release';
            subtitle = transaction.description || 'Your online trip earning is waiting to be released to the wallet.';
            icon = 'time-outline';
            iconColor = '#2563eb';
            iconBg = 'bg-blue-100';
            statusKey = transaction.status === 'failed' ? 'failed' : 'pending';
            amountColor = 'text-blue-600';
        } else if (transaction.metadata?.is_cash) {
            title = 'Cash trip payment recorded';
            subtitle = transaction.description || 'Cash trip earning recorded for your trip history.';
            icon = 'cash-outline';
            iconColor = '#16a34a';
            iconBg = 'bg-green-100';
        } else {
            title = 'CartR payment credited';
            subtitle = transaction.description || 'Trip earning credited to your wallet.';
            icon = 'checkmark-circle-outline';
            iconColor = '#16a34a';
            iconBg = 'bg-green-100';
        }
    } else if (transaction.type === 'release') {
        title = 'Pending earning released';
        subtitle = transaction.description || 'Your pending CartR trip payment is now available in the wallet.';
        icon = 'arrow-down-circle-outline';
        iconColor = '#16a34a';
        iconBg = 'bg-green-100';
    } else if (transaction.type === 'platform_fee') {
        title = 'Commission deducted';
        subtitle = transaction.description || 'Platform commission deducted for a cash ride.';
        amountColor = 'text-orange-600';
        icon = 'remove-circle-outline';
        iconColor = '#ea580c';
        iconBg = 'bg-orange-100';
        statusKey = 'deducted';
    } else if (transaction.type === 'adjustment') {
        if (transaction.metadata?.source === 'driver_wallet_topup') {
            title = 'Wallet recharge successful';
            subtitle = transaction.description || 'Recharge added to your driver wallet balance.';
            icon = 'add-circle-outline';
            iconColor = '#16a34a';
            iconBg = 'bg-green-100';
        } else {
            title = 'Wallet balance updated';
            subtitle = transaction.description || 'Wallet balance adjusted.';
            icon = 'swap-horizontal-outline';
            iconColor = '#7c3aed';
            iconBg = 'bg-violet-100';
        }
    }

    const status = getStatusStyle(statusKey);

    return {
        id: `ledger-${transaction.id}`,
        created_at: transaction.created_at,
        title,
        subtitle,
        amount: transaction.amount,
        amountLabel,
        amountColor,
        icon,
        iconColor,
        iconBg,
        statusLabel: status.label,
        statusBg: status.bg,
        statusText: status.text,
    };
};

const mapWithdrawalEntry = (withdrawal: WithdrawalRequest): TransactionHistoryEntry => {
    const statusKey = normalizeWithdrawalStatus(withdrawal);
    const status = getStatusStyle(statusKey);

    let title = 'Withdrawal request submitted';
    if (statusKey === 'approved' || statusKey === 'processing') title = 'Withdrawal in progress';
    if (statusKey === 'success') title = 'Withdrawal sent to bank';
    if (statusKey === 'failed') title = 'Withdrawal failed';
    if (statusKey === 'rejected') title = 'Withdrawal rejected';
    if (statusKey === 'reversed') title = 'Withdrawal reversed';

    const detail = withdrawal.payout_error
        || withdrawal.admin_notes
        || withdrawal.notes
        || (withdrawal.payout_reference ? `Reference: ${withdrawal.payout_reference}` : 'Bank transfer activity');

    return {
        id: `withdrawal-${withdrawal.id}`,
        created_at: withdrawal.created_at,
        title,
        subtitle: detail,
        amount: withdrawal.amount,
        amountLabel: `₹${Number(withdrawal.amount || 0).toLocaleString()}`,
        amountColor: statusKey === 'failed' || statusKey === 'reversed' || statusKey === 'rejected' ? 'text-red-600' : 'text-orange-600',
        icon: statusKey === 'success' ? 'checkmark-done-circle-outline' : 'card-outline',
        iconColor: statusKey === 'success' ? '#16a34a' : '#2563eb',
        iconBg: statusKey === 'success' ? 'bg-green-100' : 'bg-blue-100',
        statusLabel: status.label,
        statusBg: status.bg,
        statusText: status.text,
    };
};

const mapRechargeAttemptEntry = (transaction: WalletPaymentTransaction): TransactionHistoryEntry | null => {
    if (!isDriverTopupPayment(transaction)) {
        return null;
    }

    if (transaction.status === 'completed') {
        return null;
    }

    const statusKey = transaction.status === 'failed' ? 'failed' : 'pending';
    const status = getStatusStyle(statusKey);

    return {
        id: `payment-${transaction.id}`,
        created_at: transaction.created_at || transaction.updated_at || new Date().toISOString(),
        title: transaction.status === 'failed' ? 'Wallet recharge payment failed' : 'Wallet recharge payment pending',
        subtitle: transaction.description || 'Recharge payment attempt for your driver wallet.',
        amount: transaction.amount,
        amountLabel: `₹${Number(transaction.amount || 0).toLocaleString()}`,
        amountColor: transaction.status === 'failed' ? 'text-red-600' : 'text-amber-600',
        icon: transaction.status === 'failed' ? 'close-circle-outline' : 'time-outline',
        iconColor: transaction.status === 'failed' ? '#dc2626' : '#d97706',
        iconBg: transaction.status === 'failed' ? 'bg-red-100' : 'bg-amber-100',
        statusLabel: status.label,
        statusBg: status.bg,
        statusText: status.text,
    };
};

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

// Skeleton shimmer helper
const SkeletonBox = ({ width: w, height: h, className: cls = '', rounded = 'rounded-xl' }: { width?: number | string; height?: number | string; className?: string; rounded?: string }) => {
    const anim = useRef(new Animated.Value(0.3)).current;
    useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(anim, { toValue: 1, duration: 700, useNativeDriver: true }),
                Animated.timing(anim, { toValue: 0.3, duration: 700, useNativeDriver: true }),
            ])
        );
        loop.start();
        return () => loop.stop();
    }, []);
    return (
        <Animated.View
            style={{ opacity: anim, width: w as any, height: h as any }}
            className={`bg-gray-200 ${rounded} ${cls}`}
        />
    );
};

const WalletSkeleton = () => (
    <View className="flex-1 bg-white">
        {/* Balance card skeleton */}
        <View className="p-5 bg-green-500 rounded-b-3xl mb-6">
            <SkeletonBox height={36} width={160} className="bg-green-400 mb-2" />
            <SkeletonBox height={14} width={120} className="bg-green-400" />
        </View>

        {/* Period selector skeleton */}
        <View className="flex-row mx-5 bg-gray-100 rounded-xl p-1 mb-6">
            {[1, 2, 3].map(i => (
                <View key={i} className="flex-1 py-3 px-2">
                    <SkeletonBox height={18} rounded="rounded-lg" />
                </View>
            ))}
        </View>

        {/* Earnings card skeleton */}
        <View className="mx-5 bg-gray-50 border border-gray-200 rounded-2xl p-6 mb-6">
            <SkeletonBox height={12} width={120} className="mb-2" />
            <SkeletonBox height={48} width={180} className="mb-4" />
            <View className="flex-row justify-between">
                {[1, 2, 3].map(i => (
                    <View key={i}>
                        <SkeletonBox height={10} width={60} className="mb-1" />
                        <SkeletonBox height={18} width={60} />
                    </View>
                ))}
            </View>
        </View>

        {/* Chart skeleton */}
        <View className="mx-5 bg-gray-50 border border-gray-200 rounded-2xl p-4 mb-6">
            <SkeletonBox height={14} width={160} className="mb-4" />
            <View className="flex-row justify-between items-end h-32 px-2">
                {[60, 80, 40, 100, 55, 75, 90].map((h, i) => (
                    <SkeletonBox key={i} height={h} width={32} rounded="rounded-t-lg" />
                ))}
            </View>
        </View>

        {/* Recent trips skeleton */}
        <View className="mx-5">
            <SkeletonBox height={16} width={120} className="mb-4" />
            {[1, 2, 3].map(i => (
                <View key={i} className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-3">
                    <SkeletonBox height={14} className="mb-2" />
                    <SkeletonBox height={10} width={100} className="mb-3" />
                    <SkeletonBox height={1} className="bg-gray-200 mb-2" />
                    <View className="flex-row justify-between">
                        <SkeletonBox height={10} width={80} />
                        <SkeletonBox height={10} width={60} />
                    </View>
                </View>
            ))}
        </View>
    </View>
);

const DriverEarnings = () => {
    const { openRecharge } = useLocalSearchParams<{ openRecharge?: string }>();
    const { driverProfile, user, profile } = useAuth();
    const { t } = useLanguage();
    const driverId = driverProfile?.id ?? null;

    // Data states
    const [wallet, setWallet] = useState<WalletInfo | null>(null);
    const [payoutSettings, setPayoutSettings] = useState<any>(null);
    const [trips, setTrips] = useState<Booking[]>([]);
    const [walletTransactions, setWalletTransactions] = useState<WalletTransaction[]>([]);
    const [walletPaymentTransactions, setWalletPaymentTransactions] = useState<WalletPaymentTransaction[]>([]);
    const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
    const [period, setPeriod] = useState<'today' | 'week' | 'month'>('week');
    const [historyTab, setHistoryTab] = useState<HistoryTab>('trips');

    // UI states
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [showWithdrawModal, setShowWithdrawModal] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [showAddMoneyModal, setShowAddMoneyModal] = useState(false);
    const [showStatusModal, setShowStatusModal] = useState(false);
    const [statusType, setStatusType] = useState<'success' | 'failure'>('success');
    const [statusMessage, setStatusMessage] = useState('');
    const [withdrawAmount, setWithdrawAmount] = useState('');
    const [topupAmount, setTopupAmount] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isTopupLoading, setIsTopupLoading] = useState(false);
    const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
    const [showCheckoutModal, setShowCheckoutModal] = useState(false);
    const [paymentSessionId, setPaymentSessionId] = useState('');
    const [environment, setEnvironment] = useState<'sandbox' | 'production'>('sandbox');
    const [walletSubscription, setWalletSubscription] = useState<RealtimeChannel | null>(null);
    const [transactionSubscription, setTransactionSubscription] = useState<RealtimeChannel | null>(null);
    const [balanceChangeIndicator, setBalanceChangeIndicator] = useState<{
        show: boolean;
        amount: number;
        type: 'credit' | 'debit';
    } | null>(null);
    const appState = useRef(AppState.currentState);
    const balanceIndicatorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const predefinedAmounts = [500, 1000, 2000];

    useEffect(() => {
        if (openRecharge !== '1') {
            return;
        }

        setShowAddMoneyModal(true);
        router.replace('/(tabs)/earnings');
    }, [openRecharge]);

    const handleWalletUpdate = useCallback((newBalance: number | null | undefined, oldBalance: number | null | undefined) => {
        if (typeof newBalance !== 'number' || typeof oldBalance !== 'number') return;

        const diff = newBalance - oldBalance;
        if (Math.abs(diff) < 1) return;

        if (balanceIndicatorTimeoutRef.current) {
            clearTimeout(balanceIndicatorTimeoutRef.current);
        }

        setBalanceChangeIndicator({
            show: true,
            amount: Math.abs(diff),
            type: diff > 0 ? 'credit' : 'debit',
        });

        balanceIndicatorTimeoutRef.current = setTimeout(() => {
            setBalanceChangeIndicator(null);
            balanceIndicatorTimeoutRef.current = null;
        }, 3000);
    }, []);

    const loadWalletInfo = useCallback(async () => {
        if (!driverId) return;

        try {
            const [walletRes, settingsRes, tripsRes, transactionsRes, withdrawalsRes, walletPaymentsRes] = await Promise.all([
                getDriverWalletInfo(driverId),
                getPlatformSetting('payout'),
                getDriverCompletedTrips(driverId, 100),
                getDriverWalletTransactions(driverId, 50),
                getDriverWithdrawals(driverId, 20),
                user?.id ? getWalletPaymentTransactions(user.id, 50) : Promise.resolve({ data: [], error: null })
            ]);

            if (walletRes.data?.wallet) {
                setWallet({
                    ...walletRes.data.wallet,
                    pending_withdrawals: walletRes.data.wallet.pending_withdrawals ?? walletRes.data.stats?.pending_withdrawals ?? 0,
                });
            }
            if (settingsRes.data) setPayoutSettings(settingsRes.data);
            if (!tripsRes.error && tripsRes.data) setTrips(tripsRes.data);
            if (!transactionsRes.error && transactionsRes.data) {
                setWalletTransactions(transactionsRes.data);
            } else if (walletRes.data?.recent_transactions?.length) {
                setWalletTransactions(walletRes.data.recent_transactions);
            }
            if (!withdrawalsRes.error && withdrawalsRes.data) setWithdrawals(withdrawalsRes.data);
            if (!walletPaymentsRes.error && walletPaymentsRes.data) setWalletPaymentTransactions(walletPaymentsRes.data);

        } catch (error) {
            console.error('Error fetching earnings dashboard:', error);
        } finally {
            setIsLoading(false);
        }
    }, [driverId, user?.id]);

    useEffect(() => {
        loadWalletInfo();
    }, [loadWalletInfo]);

    useEffect(() => {
        if (!driverId) {
            if (walletSubscription) {
                walletSubscription.unsubscribe();
                setWalletSubscription(null);
            }
            return;
        }

        if (walletSubscription) {
            walletSubscription.unsubscribe();
        }

        const subscription = supabase
            .channel(`driver_wallet_${driverId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'driver_wallets',
                    filter: `driver_id=eq.${driverId}`,
                },
                (payload) => {
                    console.log('Wallet updated:', payload.new);

                    const newBalance = typeof payload.new === 'object' && payload.new
                        ? Number((payload.new as { available_balance?: number }).available_balance)
                        : null;
                    const oldBalance = typeof payload.old === 'object' && payload.old
                        ? Number((payload.old as { available_balance?: number }).available_balance)
                        : null;

                    handleWalletUpdate(
                        Number.isFinite(newBalance) ? newBalance : null,
                        Number.isFinite(oldBalance) ? oldBalance : null
                    );

                    loadWalletInfo();
                }
            )
            .subscribe((status) => {
                console.log(`Wallet realtime status for ${driverId}:`, status);
            });

        setWalletSubscription(subscription);

        return () => {
            console.log(`Cleaning up wallet realtime subscription for ${driverId}`);
            subscription.unsubscribe();
            setWalletSubscription(current => (current === subscription ? null : current));
        };
    }, [driverId, handleWalletUpdate, loadWalletInfo]);

    useEffect(() => {
        if (!driverId) {
            if (transactionSubscription) {
                transactionSubscription.unsubscribe();
                setTransactionSubscription(null);
            }
            return;
        }

        if (transactionSubscription) {
            transactionSubscription.unsubscribe();
        }

        const subscription = supabase
            .channel(`driver_transactions_${driverId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'driver_wallet_transactions',
                    filter: `driver_id=eq.${driverId}`,
                },
                (payload) => {
                    console.log('New wallet transaction:', payload.new);
                    loadWalletInfo();
                }
            )
            .subscribe((status) => {
                console.log(`Wallet transaction realtime status for ${driverId}:`, status);
            });

        setTransactionSubscription(subscription);

        return () => {
            console.log(`Cleaning up wallet transaction subscription for ${driverId}`);
            subscription.unsubscribe();
            setTransactionSubscription(current => (current === subscription ? null : current));
        };
    }, [driverId, loadWalletInfo]);

    useEffect(() => {
        const subscription = AppState.addEventListener('change', nextAppState => {
            if (appState.current.match(/inactive|background/) && nextAppState === 'active' && pendingOrderId) {
                verifyPaymentStatus(pendingOrderId);
            }
            appState.current = nextAppState;
        });

        return () => subscription.remove();
    }, [pendingOrderId]);

    useEffect(() => {
        return () => {
            if (balanceIndicatorTimeoutRef.current) {
                clearTimeout(balanceIndicatorTimeoutRef.current);
            }
        };
    }, []);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await loadWalletInfo();
        setRefreshing(false);
    }, [loadWalletInfo]);

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
            setShowWithdrawModal(false);
            setWithdrawAmount('');
            setTimeout(() => setShowSuccessModal(true), 300);
            loadWalletInfo();
        } else {
            Alert.alert(t('error') || 'Error', error || t('withdrawalRequestFailed') || 'Withdrawal request failed');
        }
    };

    const handleStatusDismiss = () => {
        setShowStatusModal(false);
    };

    const handleTopupSuccess = async (confirmedAmount?: string | number) => {
        const finalAmount = confirmedAmount ? parseFloat(String(confirmedAmount)) : parseFloat(topupAmount || '0');

        setShowAddMoneyModal(false);
        setTopupAmount('');
        setIsTopupLoading(false);
        setPendingOrderId(null);

        await loadWalletInfo();

        setStatusType('success');
        setStatusMessage(`Rs ${finalAmount.toFixed(2)} added to your driver wallet.`);
        setShowStatusModal(true);
    };

    const verifyPaymentStatus = async (orderId: string, forceFail: boolean = false) => {
        try {
            const { data } = await supabase.functions.invoke('verify-payment', {
                body: {
                    order_id: orderId,
                    force_fail: forceFail
                }
            });

            if (data?.status === 'PAID' && data?.wallet_credited !== false) {
                await handleTopupSuccess(data.amount);
            } else if (data?.status === 'PAID' && data?.wallet_credited === false) {
                setIsTopupLoading(false);
                setPendingOrderId(null);
                await loadWalletInfo();
                setStatusType('failure');
                setStatusMessage(data?.credit_error || 'Payment completed, but the driver wallet was not credited yet.');
                setShowStatusModal(true);
            } else if (data?.status === 'FAILED' || data?.status === 'CANCELLED') {
                setIsTopupLoading(false);
                setPendingOrderId(null);
                setStatusType('failure');
                setStatusMessage(data?.order_status === 'CANCELLED' ? 'Payment cancelled.' : 'Payment failed.');
                setShowStatusModal(true);
            } else {
                setIsTopupLoading(false);
                setPendingOrderId(null);
            }
        } catch (error) {
            console.error('Error verifying driver wallet top-up:', error);
            setIsTopupLoading(false);
            setPendingOrderId(null);
            setStatusType('failure');
            setStatusMessage('Unable to verify payment right now. Please refresh and check your wallet.');
            setShowStatusModal(true);
        }
    };

    const startTopupPayment = async () => {
        const value = parseFloat(topupAmount);
        if (!value || value <= 0) {
            Alert.alert('Invalid Amount', 'Please enter a valid amount greater than 0.');
            return;
        }

        if (!user?.id) {
            Alert.alert('Error', 'No user session found. Please log in again.');
            return;
        }

        if (isTopupLoading) {
            return;
        }

        try {
            setIsTopupLoading(true);

            const timestamp = Math.floor(Date.now() / 60000);
            const idempotencyKey = `driver-wallet-${user.id}-${value}-${timestamp}`;

            const { data: existingOrder, error: existingOrderError } = await supabase
                .from('wallet_transactions')
                .select('id')
                .eq('user_id', user.id)
                .eq('amount', value)
                .eq('status', 'pending')
                .gte('created_at', new Date(Date.now() - 60000).toISOString())
                .maybeSingle();

            if (existingOrderError) {
                throw existingOrderError;
            }

            if (existingOrder) {
                Alert.alert(
                    'Payment in Progress',
                    'You already have a pending recharge for this amount. Please complete or wait for it to finish.'
                );
                setIsTopupLoading(false);
                return;
            }

            const callbackUrl = __DEV__
                ? 'https://docs.cashfree.com/docs/payment-success'
                : 'carter://payment-callback';

            const { data, error } = await supabase.functions.invoke('create-payment-order', {
                body: {
                    amount: value,
                    customer_id: user.id,
                    customer_phone: profile?.phone || user.phone || '9999999999',
                    customer_name: profile?.name || 'CartR Driver',
                    customer_email: profile?.email || user.email || 'driver@cartr.app',
                    return_url: callbackUrl,
                    idempotency_key: idempotencyKey,
                    topup_target: 'driver_wallet',
                }
            });

            if (error) {
                throw error;
            }

            if (!data?.payment_session_id || !data?.order_id) {
                throw new Error('Payment service returned an invalid response.');
            }

            setPendingOrderId(data.order_id);
            setPaymentSessionId(data.payment_session_id);
            setEnvironment((data.environment || 'sandbox') as 'sandbox' | 'production');
            setShowAddMoneyModal(false);
            setShowCheckoutModal(true);
        } catch (error: any) {
            console.error('Error starting driver wallet top-up:', error);
            Alert.alert('Payment Error', error.message || 'Failed to start wallet recharge.');
            setIsTopupLoading(false);
            setPendingOrderId(null);
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

    // FIX: Calculate periodEarnings from filteredTrips instead of hardcoding 0
    const periodEarnings = filteredTrips.reduce((sum, trip) => sum + (trip.driver_payout || trip.total_fare || 0), 0);

    const tripsCount = filteredTrips.length;
    const avgPerTrip = tripsCount > 0 ? Math.round(periodEarnings / tripsCount) : 0;
    const weeklyData = getWeeklyData();

    // FIX: Declare recentTrips (most recent 10 filtered trips)
    const recentTrips = filteredTrips.slice(0, 10);

    const transactionHistory = [
        ...walletTransactions
            .map(mapWalletLedgerEntry)
            .filter((entry): entry is TransactionHistoryEntry => !!entry),
        ...withdrawals.map(mapWithdrawalEntry),
        ...walletPaymentTransactions
            .map(mapRechargeAttemptEntry)
            .filter((entry): entry is TransactionHistoryEntry => !!entry),
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    // FIX: Moved isLoading early return to correct position, outside main return
    if (isLoading) {
        return (
            <SafeAreaView className="flex-1 bg-white">
                <ScrollView
                    className="flex-1"
                    contentContainerStyle={{ paddingBottom: 100 }}
                    scrollEnabled={false}
                >
                    <WalletSkeleton />
                </ScrollView>
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
                {/* Balance Card */}
                <View className="p-5 flex-row justify-between items-center bg-green-500 rounded-b-3xl mb-6">
                    <View className="flex-1 pr-4" style={styles.balanceInfo}>
                        <Text className={`text-3xl font-JakartaBold mb-1 ${wallet?.has_negative_balance ? 'text-red-100' : 'text-white'}`}>
                            ₹{(wallet?.available_balance || 0).toLocaleString()}
                        </Text>
                        {balanceChangeIndicator?.show && (
                            <View style={[
                                styles.balanceChangeIndicator,
                                balanceChangeIndicator.type === 'credit'
                                    ? styles.creditIndicator
                                    : styles.debitIndicator
                            ]}>
                                <Text style={styles.indicatorText}>
                                    {balanceChangeIndicator.type === 'credit' ? '+' : '-'}
                                    ₹{balanceChangeIndicator.amount.toFixed(2)}
                                </Text>
                            </View>
                        )}
                        <Text className="text-green-100 text-sm font-JakartaMedium">{t('availableBalance') || 'Withdrawable Balance'}</Text>
                        {(wallet?.pending_balance || 0) > 0 && (
                            <Text className="text-green-50 text-xs mt-1">
                                + ₹{wallet?.pending_balance.toLocaleString()} {t('pendingBalance') || 'pending'}
                            </Text>
                        )}
                        {!!wallet?.has_negative_balance && (
                            <Text className="text-red-100 text-xs mt-1">
                                Commission debt tracked: Rs {Number(wallet?.total_commission_owed || Math.abs(wallet?.available_balance || 0)).toLocaleString()}
                            </Text>
                        )}
                    </View>

                    <View className="items-end">
                    <TouchableOpacity
                        onPress={() => setShowAddMoneyModal(true)}
                        className="bg-white py-2 px-4 rounded-xl mb-3"
                    >
                        <Text className="text-green-600 font-JakartaBold">Add Money</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => {
                            if (!wallet || wallet.available_balance <= 0) {
                                Alert.alert('No Balance', 'You have no available balance to withdraw.');
                                return;
                            }
                            if ((wallet.pending_withdrawals || 0) > 0) {
                                Alert.alert(
                                    'Pending Withdrawal',
                                    'You already have a pending withdrawal request. Please wait for it to be processed before requesting another.',
                                    [{ text: 'OK' }]
                                );
                                return;
                            }
                            if (!wallet.bank_details || !wallet.bank_details.account_number) {
                                Alert.alert(
                                    'Bank Account Required',
                                    'Please add your bank account details first to enable withdrawals.',
                                    [
                                        { text: 'Cancel', style: 'cancel' },
                                        { text: 'Add Bank', onPress: () => router.push('/profile/bank') }
                                    ]
                                );
                                return;
                            }
                            setShowWithdrawModal(true);
                        }}
                        className={`py-2 px-4 rounded-xl flex-row items-center justify-center gap-2 ${
                            (!wallet || wallet.available_balance <= 0 || (wallet.pending_withdrawals || 0) > 0)
                                ? 'bg-green-600/50'
                                : 'bg-white'
                        }`}
                    >
                        <Text className={`font-JakartaBold ${
                            (!wallet || wallet.available_balance <= 0 || (wallet.pending_withdrawals || 0) > 0) ? 'text-green-100/70' : 'text-green-600'
                        }`}>
                            {(wallet?.pending_withdrawals || 0) > 0 ? 'Pending...' : (t('withdraw') || 'Withdraw')}
                        </Text>
                    </TouchableOpacity>
                    </View>
                </View>

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
                    <View className="flex-row bg-gray-100 rounded-2xl p-1 mb-4">
                        <TouchableOpacity
                            onPress={() => setHistoryTab('trips')}
                            className={`flex-1 py-3 rounded-xl ${historyTab === 'trips' ? 'bg-white shadow-sm' : ''}`}
                        >
                            <Text className={`text-center font-JakartaBold ${historyTab === 'trips' ? 'text-gray-900' : 'text-gray-500'}`}>
                                {t('recentTrips') || 'Recent Trips'}
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => setHistoryTab('transactions')}
                            className={`flex-1 py-3 rounded-xl ${historyTab === 'transactions' ? 'bg-white shadow-sm' : ''}`}
                        >
                            <Text className={`text-center font-JakartaBold ${historyTab === 'transactions' ? 'text-gray-900' : 'text-gray-500'}`}>
                                Transaction History
                            </Text>
                        </TouchableOpacity>
                    </View>
                    {historyTab === 'trips' ? (
                    recentTrips.length > 0 ? (
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
                                        <View className="flex-row items-center">
                                            <Text className="text-[10px] text-gray-500 italic mr-3">
                                                {isCash ? 'Already collected by you' : 'Credited to wallet'}
                                            </Text>
                                            <TouchableOpacity
                                                onPress={() => router.push(`/ride/invoice?bookingId=${trip.id}` as any)}
                                                className="bg-gray-100 px-2 py-1 rounded"
                                            >
                                                <Text className="text-blue-500 text-xs font-JakartaMedium">{t('viewInvoice') || 'Invoice'}</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                </View>
                            );
                        })
                    ) : (
                        <View className="bg-gray-50 border border-gray-200 rounded-xl p-6 items-center">
                            <Ionicons name="receipt-outline" size={34} color="#9ca3af" style={{ marginBottom: 8 }} />
                            <Text className="text-gray-500 text-center">{t('noCompletedTrips') || 'No completed trips yet'}</Text>
                        </View>
                    )
                    ) : transactionHistory.length > 0 ? (
                        transactionHistory.map(entry => (
                            <View key={entry.id} className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-3">
                                <View className="flex-row justify-between items-start">
                                    <View className="flex-row flex-1 mr-3">
                                        <View className={`w-11 h-11 rounded-full items-center justify-center mr-3 ${entry.iconBg}`}>
                                            <Ionicons name={entry.icon} size={20} color={entry.iconColor} />
                                        </View>
                                        <View className="flex-1">
                                            <Text className="text-gray-900 font-JakartaSemiBold">{entry.title}</Text>
                                            <Text className="text-gray-500 text-xs mt-1">{entry.subtitle}</Text>
                                            <Text className="text-gray-400 text-[11px] mt-2">{formatHistoryDate(entry.created_at)}</Text>
                                        </View>
                                    </View>

                                    <View className="items-end">
                                        <Text className={`font-JakartaBold text-base ${entry.amountColor}`}>
                                            {entry.amountLabel}
                                        </Text>
                                        <View className={`mt-2 px-3 py-1 rounded-full ${entry.statusBg}`}>
                                            <Text className={`text-[11px] font-JakartaBold ${entry.statusText}`}>
                                                {entry.statusLabel}
                                            </Text>
                                        </View>
                                    </View>
                                </View>
                            </View>
                        ))
                    ) : (
                        <View className="bg-gray-50 border border-gray-200 rounded-xl p-6 items-center">
                            <Ionicons name="swap-horizontal-outline" size={34} color="#9ca3af" style={{ marginBottom: 8 }} />
                            <Text className="text-gray-700 font-JakartaSemiBold mb-1">No transaction history yet</Text>
                            <Text className="text-gray-500 text-center text-sm">
                                New CartR payments, withdrawals, recharges, and commission updates will appear here.
                            </Text>
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

            <Modal
                visible={showAddMoneyModal}
                transparent={true}
                animationType="slide"
                onRequestClose={() => !isTopupLoading && setShowAddMoneyModal(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => !isTopupLoading && setShowAddMoneyModal(false)}
                >
                    <TouchableOpacity activeOpacity={1} style={styles.modalContent}>
                        <View className="flex-row items-center justify-between mb-6">
                            <View className="w-10" />
                            <View className="w-12 h-1 bg-gray-300 rounded-full" />
                            <TouchableOpacity
                                onPress={() => !isTopupLoading && setShowAddMoneyModal(false)}
                                className="w-10 h-10 rounded-full bg-gray-50 items-center justify-center"
                            >
                                <Ionicons name="close" size={20} color="#94A3B8" />
                            </TouchableOpacity>
                        </View>

                        {isTopupLoading ? (
                            <View className="py-10 items-center">
                                <ActivityIndicator size="large" color="#F5B800" />
                                <Text className="mt-4 font-JakartaMedium text-gray-600">Opening payment gateway...</Text>
                            </View>
                        ) : (
                            <>
                                <Text className="text-xl font-JakartaBold text-center mb-2">Add Money to Driver Wallet</Text>
                                <Text className="text-gray-500 text-center text-sm mb-8">
                                    Recharge your wallet to clear commission debt and keep withdrawals available.
                                </Text>

                                <View className="items-center mb-8">
                                    <View className="flex-row items-center">
                                        <Text className="text-4xl font-JakartaExtraBold">Rs </Text>
                                        <TextInput
                                            value={topupAmount}
                                            onChangeText={setTopupAmount}
                                            keyboardType="numeric"
                                            placeholder="0"
                                            placeholderTextColor="#E2E8F0"
                                            className="text-4xl font-JakartaExtraBold text-black min-w-[100px]"
                                            style={{ height: 60 }}
                                        />
                                    </View>
                                </View>

                                <View className="flex-row justify-between mb-8">
                                    {predefinedAmounts.map((val) => (
                                        <TouchableOpacity
                                            key={val}
                                            onPress={() => setTopupAmount(val.toString())}
                                            className={`flex-1 py-3 rounded-xl border mx-2 items-center ${topupAmount === val.toString() ? 'bg-green-100 border-green-500' : 'bg-white border-gray-200'}`}
                                        >
                                            <Text className={`font-JakartaBold ${topupAmount === val.toString() ? 'text-green-700' : 'text-gray-600'}`}>Rs {val}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>

                                <TouchableOpacity
                                    onPress={startTopupPayment}
                                    disabled={isTopupLoading || !topupAmount || parseFloat(topupAmount) <= 0}
                                    className={`py-4 rounded-2xl items-center justify-center mb-4 ${
                                        topupAmount && parseFloat(topupAmount) > 0 ? 'bg-yellow-500' : 'bg-gray-300'
                                    }`}
                                >
                                    <Text className="text-black font-JakartaBold text-lg">Add Money</Text>
                                </TouchableOpacity>

                                <View className="flex-row justify-center items-center mb-4">
                                    <Ionicons name="lock-closed-outline" size={12} color="#A0A0A0" />
                                    <Text className="text-xs text-gray-400 ml-1">Secured by Cashfree Payments</Text>
                                </View>
                            </>
                        )}
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal>

            {/* Success Modal */}
            <Modal
                visible={showSuccessModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowSuccessModal(false)}
            >
                <View className="flex-1 justify-center items-center bg-black/50 px-6">
                    <View className="bg-white rounded-3xl p-8 w-full max-w-sm items-center">
                        <View className="bg-green-100 rounded-full p-4 mb-4">
                            <Ionicons name="checkmark-circle" size={64} color="#22c55e" />
                        </View>

                        <Text className="text-2xl font-JakartaBold text-gray-900 mb-2 text-center">
                            Withdrawal Requested!
                        </Text>
                        <Text className="text-gray-600 text-center mb-6 font-JakartaMedium leading-relaxed">
                            Your withdrawal request has been submitted successfully. The amount will be transferred to your bank account within 1-2 business days after approval.
                        </Text>

                        <View className="bg-green-50 border border-green-200 rounded-2xl p-4 mb-6 w-full">
                            <Text className="text-gray-600 text-sm text-center mb-1">Withdrawal Amount</Text>
                            <Text className="text-3xl font-JakartaBold text-green-600 text-center">
                                ₹{Number(withdrawAmount).toLocaleString()}
                            </Text>
                        </View>

                        <TouchableOpacity
                            onPress={() => {
                                setHistoryTab('transactions');
                                setShowSuccessModal(false);
                            }}
                            className="w-full bg-green-500 py-4 rounded-xl mb-3"
                        >
                            <Text className="text-white text-center font-JakartaBold text-base">
                                View Withdrawal History
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => setShowSuccessModal(false)}
                            className="w-full py-3"
                        >
                            <Text className="text-gray-600 text-center font-JakartaSemiBold">
                                Close
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            <Modal
                visible={showStatusModal}
                transparent={true}
                animationType="slide"
                onRequestClose={handleStatusDismiss}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={handleStatusDismiss}
                >
                    <TouchableOpacity activeOpacity={1} style={styles.statusModalContent}>
                        <TouchableOpacity
                            onPress={handleStatusDismiss}
                            className="absolute right-5 top-5 w-9 h-9 rounded-full bg-gray-100 items-center justify-center"
                            style={{ zIndex: 10 }}
                        >
                            <Ionicons name="close" size={20} color="#6B7280" />
                        </TouchableOpacity>

                        <View className="w-12 h-1 bg-gray-300 rounded-full mb-6" />

                        <View className={`w-20 h-20 rounded-full items-center justify-center mb-5 ${
                            statusType === 'success' ? 'bg-green-100' : 'bg-red-100'
                        }`}>
                            <Ionicons
                                name={statusType === 'success' ? 'checkmark' : 'close'}
                                size={40}
                                color={statusType === 'success' ? '#10B981' : '#EF4444'}
                            />
                        </View>

                        <Text className="text-2xl font-JakartaBold mb-2 text-center text-gray-900">
                            {statusType === 'success' ? 'Payment Successful' : 'Payment Failed'}
                        </Text>

                        <Text className="text-gray-500 text-center font-JakartaMedium mb-4 px-4">
                            {statusMessage}
                        </Text>

                        {statusType === 'failure' && (
                            <View className="bg-red-50 rounded-xl px-4 py-3 mb-6 w-full flex-row items-center">
                                <Ionicons name="information-circle-outline" size={16} color="#EF4444" />
                                <Text className="text-red-600 text-xs font-JakartaMedium ml-2 flex-1">
                                    No amount was deducted permanently. You can safely retry.
                                </Text>
                            </View>
                        )}

                        {statusType === 'success' && <View className="mb-4" />}

                        <TouchableOpacity
                            onPress={handleStatusDismiss}
                            className={`w-full py-4 rounded-2xl items-center justify-center mb-4 ${
                                statusType === 'success' ? 'bg-yellow-500' : 'bg-red-500'
                            }`}
                        >
                            <Text className={`font-JakartaBold text-lg ${statusType === 'success' ? 'text-black' : 'text-white'}`}>
                                {statusType === 'success' ? 'Done' : 'Try Again'}
                            </Text>
                        </TouchableOpacity>
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal>

            {showCheckoutModal && (
                <CashfreeCheckoutModal
                    visible={showCheckoutModal}
                    paymentSessionId={paymentSessionId}
                    orderId={pendingOrderId || ''}
                    environment={environment}
                    onSuccess={async (orderId) => {
                        setShowCheckoutModal(false);
                        setIsTopupLoading(true);
                        await verifyPaymentStatus(orderId);
                    }}
                    onFailure={async (_errorMessage, orderId) => {
                        setShowCheckoutModal(false);
                        setIsTopupLoading(true);
                        await verifyPaymentStatus(orderId, true);
                    }}
                    onClose={() => {
                        setShowCheckoutModal(false);
                        if (pendingOrderId) {
                            verifyPaymentStatus(pendingOrderId);
                        }
                    }}
                />
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    balanceInfo: {
        position: 'relative',
    },
    balanceChangeIndicator: {
        position: 'absolute',
        top: -8,
        right: 0,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
        elevation: 3,
    },
    creditIndicator: {
        backgroundColor: '#10b981',
    },
    debitIndicator: {
        backgroundColor: '#ef4444',
    },
    indicatorText: {
        color: '#ffffff',
        fontSize: 12,
        fontWeight: '600',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: 'white',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        padding: 24,
    },
    statusModalContent: {
        backgroundColor: 'white',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        padding: 32,
        alignItems: 'center',
        minHeight: 320,
    },
});

export default DriverEarnings;
