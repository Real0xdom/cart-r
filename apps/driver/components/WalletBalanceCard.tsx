import React from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import type { DriverWalletInfoResponse } from '@/lib/wallet';

interface WalletBalanceCardProps {
  walletInfo: DriverWalletInfoResponse | null;
  isLoading: boolean;
}

export function WalletBalanceCard({ walletInfo, isLoading }: WalletBalanceCardProps) {
  if (isLoading) {
    return (
      <View className="bg-white rounded-2xl p-4 mb-6 border border-gray-200 shadow-sm">
        <View className="py-4 items-center justify-center">
          <ActivityIndicator size="small" color="#22c55e" />
        </View>
      </View>
    );
  }

  if (!walletInfo?.wallet) {
    return null;
  }

  const { available_balance, pending_balance, has_negative_balance, total_commission_owed } = walletInfo.wallet;

  return (
    <Pressable
      onPress={() => router.push('/(tabs)/earnings')}
      className="bg-white rounded-2xl p-4 mb-6 border border-gray-200 shadow-sm"
    >
      <View className="flex-row justify-between items-center mb-4">
        <View className="flex-row items-center">
          <View className="w-10 h-10 rounded-full bg-green-100 items-center justify-center mr-3">
            <Ionicons name="wallet-outline" size={20} color="#16a34a" />
          </View>
          <View>
            <Text className="text-gray-900 font-JakartaBold text-base">Wallet Balance</Text>
            <Text className="text-gray-500 text-xs">
              {has_negative_balance ? 'Commission due on cash rides' : 'Ready for withdrawals and recharges'}
            </Text>
          </View>
        </View>
        <Text className="text-green-600 font-JakartaSemiBold text-xs">View Details</Text>
      </View>

      <View className="flex-row items-center">
        <View className="flex-1">
          <Text className="text-gray-500 text-xs mb-1">Available</Text>
          <Text className={`font-JakartaBold text-2xl ${has_negative_balance ? 'text-red-500' : 'text-green-600'}`}>
            Rs {Number(available_balance || 0).toFixed(2)}
          </Text>
          {has_negative_balance && (
            <Text className="text-amber-600 text-xs mt-1">
              Recharge required to clear debt
            </Text>
          )}
        </View>

        <View className="w-px h-14 bg-gray-200 mx-4" />

        <View className="flex-1">
          <Text className="text-gray-500 text-xs mb-1">Pending</Text>
          <Text className="text-gray-900 font-JakartaBold text-2xl">
            Rs {Number(pending_balance || 0).toFixed(2)}
          </Text>
          <Text className="text-gray-400 text-xs mt-1">
            {total_commission_owed > 0 ? `Debt tracked: Rs ${Number(total_commission_owed).toFixed(2)}` : 'Releases after trip settlement'}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

export default WalletBalanceCard;
