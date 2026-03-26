import { View, Text, TouchableOpacity } from 'react-native';
import { useEffect, useState } from 'react';
import { Ionicons, Feather } from '@expo/vector-icons';

import { useLanguage } from '@/contexts/LanguageContext';
import type { Booking } from '@/lib/bookings';

function useCountdown(expiresAt: string | null) {
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    if (!expiresAt) {
      setTimeLeft('');
      return;
    }

    const updateCountdown = () => {
      const now = new Date().getTime();
      const expiry = new Date(expiresAt).getTime();
      const diff = expiry - now;

      if (diff <= 0) {
        setTimeLeft('Expired');
        setIsExpired(true);
      } else {
        const mins = Math.floor(diff / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        setTimeLeft(`${mins}:${secs.toString().padStart(2, '0')}`);
        setIsExpired(false);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  return { timeLeft, isExpired };
}

interface RideRequestCardProps {
  request: Booking;
  index?: number;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
}

export default function RideRequestCard({
  request,
  index,
  onAccept,
  onReject,
}: RideRequestCardProps) {
  const { t } = useLanguage();
  const { timeLeft, isExpired } = useCountdown(request.expires_at || null);

  return (
    <View
      testID={typeof index === 'number' ? `request.card.${index}` : undefined}
      accessibilityLabel={typeof index === 'number' ? `request.card.${index}` : undefined}
      className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm"
    >
      <View className="flex-row items-start gap-3 mb-4">
        <View className="flex-1 min-w-0">
          {((request.tip_amount && request.tip_amount > 0) || (request.fare_multiplier && request.fare_multiplier > 1)) && (
            <View className="bg-orange-500 px-3 py-1 rounded-full self-start mb-2 flex-row items-center">
              <Ionicons name="flash-outline" size={12} color="#fff" />
              <Text className="ml-1 text-white font-JakartaBold text-xs">{t('increasedFare')}</Text>
              {request.tip_amount && request.tip_amount > 0 && (
                <Text className="text-white font-JakartaMedium text-xs ml-1">+₹{request.tip_amount} tip</Text>
              )}
            </View>
          )}

          <Text className="text-gray-500 text-xs mb-1">{t('pickup')}</Text>
          <Text className="text-gray-900 font-JakartaSemiBold text-base" numberOfLines={2}>
            {request.origin_address}
          </Text>
        </View>

        <View className="w-[116px] shrink-0 items-end">
          {timeLeft && (
            <View className={`px-2.5 py-1 rounded-full mb-2 ${
              isExpired ? 'bg-gray-500' : (parseInt(timeLeft, 10) < 1 ? 'bg-red-500' : 'bg-blue-500')
            }`}>
              <View className="flex-row items-center">
                <Ionicons name={isExpired ? 'close-circle-outline' : 'time-outline'} size={12} color="#fff" />
                <Text className="ml-1 text-white font-JakartaBold text-xs">{isExpired ? 'Expired' : timeLeft}</Text>
              </View>
            </View>
          )}

          <View className="w-full bg-green-100 px-3 py-2 rounded-2xl">
            <Text className="text-green-700 font-JakartaBold text-right">₹{request.total_fare}</Text>
            <Text className="text-green-700 text-[10px] text-right mt-0.5 opacity-80 font-JakartaMedium">
              Est. Payout: ₹{Math.round(request.total_fare * 0.8)}
            </Text>
          </View>
        </View>
      </View>

      {request.booking_addons && request.booking_addons.length > 0 && (
        <View className="bg-amber-50 rounded-xl p-2.5 mb-4 border border-amber-200">
          <View className="flex-row items-center mb-2">
            <Feather name="plus-circle" size={16} color="#d97706" />
            <Text className="text-amber-800 font-JakartaBold ml-2 text-sm">Ride Addons Included</Text>
          </View>
          <View className="bg-white rounded-lg p-2 border border-amber-100">
            {request.booking_addons.map((addon: any, addonIndex: number) => (
              <View
                key={`addon-${addonIndex}`}
                className={`flex-row justify-between items-center ${addonIndex > 0 ? 'mt-1.5 pt-1.5 border-t border-amber-50' : ''}`}
              >
                <View className="flex-row items-center flex-1 pr-2">
                  <View className="w-5 h-5 bg-amber-100 rounded-full items-center justify-center mr-2">
                    <Text className="text-amber-700 text-[10px] font-JakartaBold">{addon.quantity}x</Text>
                  </View>
                  <Text className="text-gray-900 font-JakartaSemiBold text-xs flex-1" numberOfLines={1}>
                    {addon.addon_services?.name || 'Additional Service'}
                  </Text>
                </View>
                <Text className="text-green-600 font-JakartaBold text-xs">
                  ₹{addon.total_price || (addon.unit_price * addon.quantity)}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      <View className="mb-4">
        <Text className="text-gray-500 text-xs mb-1">DROP-OFF</Text>
        <Text className="text-gray-900 font-JakartaSemiBold text-base" numberOfLines={2}>
          {request.destination_address}
        </Text>
      </View>

      <View className="flex-row flex-wrap gap-3 mb-4">
        <View className="flex-1 min-w-[30%] bg-gray-50 p-3 rounded-xl border border-gray-200">
          <Text className="text-gray-500 text-xs">{t('distance')}</Text>
          <Text className="text-gray-900 font-JakartaSemiBold">
            {request.estimated_distance ? `${request.estimated_distance.toFixed(1)} km` : '-'}
          </Text>
        </View>
        <View className="flex-1 min-w-[30%] bg-gray-50 p-3 rounded-xl border border-gray-200">
          <Text className="text-gray-500 text-xs">Est. Time</Text>
          <Text className="text-gray-900 font-JakartaSemiBold">
            {request.estimated_duration ? `${request.estimated_duration.toFixed(0)} min` : '-'}
          </Text>
        </View>
        <View className="flex-1 min-w-[30%] bg-gray-50 p-3 rounded-xl border border-gray-200">
          <Text className="text-gray-500 text-xs">{t('payment')}</Text>
          <Text className="text-gray-900 font-JakartaSemiBold capitalize">{request.payment_method}</Text>
        </View>
      </View>

      <View className="flex-row gap-3">
        <TouchableOpacity
          testID={typeof index === 'number' ? `request.decline.${index}` : undefined}
          accessibilityLabel={typeof index === 'number' ? `request.decline.${index}` : undefined}
          onPress={() => onReject(request.id)}
          className="flex-1 bg-red-50 p-4 rounded-xl border border-red-200"
        >
          <Text className="text-red-600 text-center font-JakartaBold">{t('decline')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID={typeof index === 'number' ? `request.accept.${index}` : undefined}
          accessibilityLabel={typeof index === 'number' ? `request.accept.${index}` : undefined}
          onPress={() => onAccept(request.id)}
          className={`flex-1 p-4 rounded-xl ${isExpired ? 'bg-gray-300' : 'bg-green-500'}`}
          disabled={isExpired}
        >
          <Text className={`text-center font-JakartaBold ${isExpired ? 'text-gray-500' : 'text-white'}`}>
            {t('accept')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
