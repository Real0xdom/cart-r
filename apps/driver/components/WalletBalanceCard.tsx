import React from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { DriverWalletInfoResponse } from '@/lib/wallet';

interface WalletBalanceCardProps {
  walletInfo: DriverWalletInfoResponse | null;
  isLoading: boolean;
  isRefreshing?: boolean;
  onPressAddMoney: () => void;
  onPressWithdraw: () => void;
  onPressDetails?: () => void;
}

const formatRupees = (value: number | null | undefined) =>
  `Rs ${Math.round(Number(value || 0)).toLocaleString()}`;

export function WalletBalanceCard({
  walletInfo,
  isLoading,
  isRefreshing = false,
  onPressAddMoney,
  onPressWithdraw,
  onPressDetails,
}: WalletBalanceCardProps) {
  if (isLoading) {
    return (
      <View className="bg-emerald-700 rounded-[24px] p-4 mb-6 overflow-hidden">
        <View className="absolute -top-10 -right-8 w-32 h-32 rounded-full bg-emerald-500/35" />
        <View className="absolute -bottom-8 -left-6 w-24 h-24 rounded-full bg-emerald-400/25" />
        <View className="py-6 items-center justify-center">
          <ActivityIndicator size="small" color="#22c55e" />
          <Text className="text-emerald-50 text-xs mt-2 font-JakartaMedium">Loading wallet balance...</Text>
        </View>
      </View>
    );
  }

  if (!walletInfo?.wallet) {
    return null;
  }

  const {
    available_balance,
    has_negative_balance,
    pending_withdrawals,
  } = walletInfo.wallet;

  const canWithdraw = Number(available_balance || 0) > 0 && Number(pending_withdrawals || 0) <= 0;
  const statusTone = has_negative_balance ? 'text-amber-200' : 'text-emerald-100';
  const statusCopy = has_negative_balance
    ? 'Recharge to clear commission dues and continue taking rides'
    : 'Balance is ready for wallet top-up and bank withdrawal';

  return (
    <View className="bg-emerald-700 rounded-[24px] p-4 mb-6 overflow-hidden">
      <View className="absolute -top-10 -right-8 w-32 h-32 rounded-full bg-emerald-500/35" />
      <View className="absolute -bottom-10 -left-8 w-28 h-28 rounded-full bg-emerald-400/25" />

      <View className="flex-row justify-between items-start mb-4">
        <View className="flex-row items-center flex-1 mr-3">
          <View className="w-10 h-10 rounded-2xl bg-white/18 items-center justify-center mr-3">
            <Ionicons name="wallet-outline" size={20} color="#ecfdf5" />
          </View>
          <View className="flex-1">
            <Text className="text-white font-JakartaBold text-base">Wallet Balance</Text>
            <Text className={`text-xs mt-1 ${statusTone}`}>
              {statusCopy}
            </Text>
          </View>
        </View>

        {isRefreshing ? (
          <View className="flex-row items-center bg-white/16 px-3 py-2 rounded-full">
            <ActivityIndicator size="small" color="#ecfdf5" />
            <Text className="text-emerald-50 text-xs font-JakartaMedium ml-2">Updating</Text>
          </View>
        ) : (
          <Pressable onPress={onPressDetails} className="bg-white/16 px-3 py-2 rounded-full">
            <Text className="text-emerald-50 font-JakartaSemiBold text-xs">View Details</Text>
          </Pressable>
        )}
      </View>

      <View className="mb-4">
        <Text className="text-emerald-50 text-xs uppercase tracking-[1px] mb-1.5">Available Balance</Text>
        <Text
          className={`font-JakartaBold text-[28px] ${has_negative_balance ? 'text-amber-100' : 'text-white'}`}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {formatRupees(available_balance)}
        </Text>
      </View>

      <View className="flex-row gap-3">
        <Pressable
          onPress={onPressAddMoney}
          className="flex-1 bg-white rounded-2xl py-3 items-center justify-center"
        >
          <View className="flex-row items-center">
            <Ionicons name="add-circle-outline" size={18} color="#065f46" />
            <Text className="text-emerald-900 font-JakartaBold ml-2">Add Money</Text>
          </View>
        </Pressable>

        <Pressable
          onPress={onPressWithdraw}
          disabled={!canWithdraw}
          className={`flex-1 rounded-2xl py-3 items-center justify-center border ${
            canWithdraw ? 'bg-transparent border-white/35' : 'bg-white/12 border-white/12'
          }`}
        >
          <View className="flex-row items-center">
            <Ionicons
              name={Number(pending_withdrawals || 0) > 0 ? 'time-outline' : 'arrow-up-circle-outline'}
              size={18}
              color={canWithdraw ? '#ffffff' : '#d1fae5'}
            />
            <Text className={`font-JakartaBold ml-2 ${canWithdraw ? 'text-white' : 'text-emerald-100'}`}>
              {Number(pending_withdrawals || 0) > 0 ? 'Pending...' : 'Withdraw'}
            </Text>
          </View>
        </Pressable>
      </View>
    </View>
  );
}

export default WalletBalanceCard;
