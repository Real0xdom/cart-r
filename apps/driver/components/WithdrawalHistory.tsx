import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { getDriverWithdrawals, WithdrawalRequest } from '@/lib/wallet';
import { useLanguage } from '@/contexts/LanguageContext';

interface WithdrawalHistoryProps {
  driverId: string;
}

export default function WithdrawalHistory({ driverId }: WithdrawalHistoryProps) {
  const { t } = useLanguage();
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<WithdrawalRequest | null>(null);

  const fetchWithdrawals = async () => {
    try {
      const { data, error } = await getDriverWithdrawals(driverId);
      if (!error && data) {
        setWithdrawals(data);
      }
    } catch (error) {
      console.error('Error fetching withdrawals:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchWithdrawals();
  }, [driverId]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchWithdrawals();
  };

  const getPayoutStatusIcon = (status: string | null) => {
    if (!status) return 'help-circle-outline';
    switch (status) {
      case 'RECEIVED': return 'hourglass-outline';
      case 'PENDING': return 'time-outline';
      case 'SUCCESS': return 'checkmark-done-circle';
      case 'FAILED': return 'close-circle-outline';
      case 'REVERSED': return 'return-up-back-outline';
      default: return 'help-circle-outline';
    }
  };

  const getPayoutStatusColorForIcon = (status: string | null) => {
    if (!status) return '#6b7280';
    switch (status) {
      case 'RECEIVED': return '#3b82f6';
      case 'PENDING': return '#f59e0b';
      case 'SUCCESS': return '#22c55e';
      case 'FAILED': return '#ef4444';
      case 'REVERSED': return '#f97316';
      default: return '#6b7280';
    }
  };

  const getPayoutStatusColor = (status: string | null) => {
    if (!status) return 'bg-gray-100 text-gray-600';
    switch (status) {
      case 'RECEIVED': return 'bg-blue-100 text-blue-700';
      case 'PENDING': return 'bg-yellow-100 text-yellow-700';
      case 'SUCCESS': return 'bg-green-100 text-green-700';
      case 'FAILED': return 'bg-red-100 text-red-700';
      case 'REVERSED': return 'bg-orange-100 text-orange-700';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return 'time-outline';
      case 'approved': return 'checkmark-circle-outline';
      case 'paid': return 'checkmark-done-circle';
      case 'rejected': return 'close-circle-outline';
      case 'failed': return 'alert-circle-outline';
      case 'reversed': return 'return-up-back-outline';
      default: return 'help-circle-outline';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center py-8">
        <ActivityIndicator size="large" color="#22c55e" />
        <Text className="text-gray-600 mt-2">{t('loading') || 'Loading...'}</Text>
      </View>
    );
  }

  if (withdrawals.length === 0) {
    return (
      <View className="flex-1 items-center justify-center py-12">
        <Ionicons name="wallet-outline" size={64} color="#d1d5db" />
        <Text className="text-gray-500 mt-4 text-center">
          {t('noWithdrawalHistory') || 'No withdrawal history yet.'}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#22c55e']} />
      }
    >
      <View className="px-4 py-2">
        <Text className="text-gray-700 font-JakartaBold text-lg mb-4">
          {t('history') || 'Withdrawal History'}
        </Text>

        {withdrawals.map((withdrawal) => (
          <TouchableOpacity
            key={withdrawal.id}
            onPress={() => setSelectedWithdrawal(selectedWithdrawal?.id === withdrawal.id ? null : withdrawal)}
            className="bg-white rounded-xl p-4 mb-3 border border-gray-200"
          >
            <View className="flex-row justify-between items-start mb-2">
              <View className="flex-1">
                <View className="flex-row items-center mb-1">
                  <Ionicons 
                    name={getPayoutStatusIcon(withdrawal.payout_status) as any} 
                    size={20} 
                    color={getPayoutStatusColorForIcon(withdrawal.payout_status)}
                  />
                  <Text className="text-gray-900 font-JakartaBold text-lg ml-2">
                    ₹{withdrawal.amount.toLocaleString()}
                  </Text>
                </View>
                <Text className="text-gray-500 text-xs">
                  {formatDate(withdrawal.created_at)}
                </Text>
              </View>

              <View className="items-end">
                {withdrawal.payout_status ? (
                  <View className={`px-3 py-1 rounded-full ${getPayoutStatusColor(withdrawal.payout_status)}`}>
                    <Text className="text-xs font-JakartaBold">
                      {withdrawal.payout_status}
                    </Text>
                  </View>
                ) : (
                  <View className={`px-3 py-1 rounded-full ${getPayoutStatusColor(null)}`}>
                    <Text className="text-xs font-JakartaBold uppercase">
                      {withdrawal.status}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Expanded Details */}
            {selectedWithdrawal?.id === withdrawal.id && (
              <View className="mt-3 pt-3 border-t border-gray-100">
                {withdrawal.payout_reference && (
                  <View className="mb-2">
                    <Text className="text-gray-500 text-xs mb-1">Transfer Reference</Text>
                    <Text className="text-gray-700 text-xs font-mono">
                      {withdrawal.payout_reference}
                    </Text>
                  </View>
                )}

                {withdrawal.processed_at && (
                  <View className="mb-2">
                    <Text className="text-gray-500 text-xs mb-1">Processed At</Text>
                    <Text className="text-gray-700 text-xs">
                      {formatDate(withdrawal.processed_at)}
                    </Text>
                  </View>
                )}

                {withdrawal.notes && (
                  <View className="mb-2">
                    <Text className="text-gray-500 text-xs mb-1">Notes</Text>
                    <Text className="text-gray-700 text-xs">{withdrawal.notes}</Text>
                  </View>
                )}

                {withdrawal.admin_notes && (
                  <View className="mb-2">
                    <Text className="text-gray-500 text-xs mb-1">Admin Notes</Text>
                    <Text className="text-gray-700 text-xs">{withdrawal.admin_notes}</Text>
                  </View>
                )}

                {withdrawal.payout_error && (
                  <View className="bg-red-50 p-2 rounded-lg">
                    <Text className="text-red-700 text-xs font-JakartaMedium">
                      Error: {withdrawal.payout_error}
                    </Text>
                  </View>
                )}

                {/* Status Explanation */}
                <View className="mt-2 bg-gray-50 p-2 rounded-lg">
                  <Text className="text-gray-600 text-xs">
                    {!withdrawal.payout_status && withdrawal.status === 'pending' && 'Your withdrawal request is pending admin approval.'}
                    {!withdrawal.payout_status && withdrawal.status === 'approved' && 'Your withdrawal has been approved and is being processed.'}
                    {!withdrawal.payout_status && withdrawal.status === 'rejected' && 'Your withdrawal request was rejected. Amount has been refunded to your wallet.'}
                    {withdrawal.payout_status === 'PENDING' && 'Transfer is in progress. Money will be credited to your bank soon.'}
                    {withdrawal.payout_status === 'RECEIVED' && 'Transfer has been received by Cashfree and is being processed.'}
                    {withdrawal.payout_status === 'SUCCESS' && 'Money has been transferred to your bank account.'}
                    {withdrawal.payout_status === 'FAILED' && 'Transfer failed. Amount has been refunded to your wallet.'}
                    {withdrawal.payout_status === 'REVERSED' && 'Transfer was reversed by the bank. Amount has been refunded to your wallet.'}
                  </Text>
                </View>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}
