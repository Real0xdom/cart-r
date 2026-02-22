import { View, Text, ScrollView, Image } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';

export default function VehicleDetails() {
  const { driverProfile } = useAuth();
  const { t } = useLanguage();
  
  if (!driverProfile) return null;

  return (
    <ScrollView className="flex-1 bg-white">
      <View className="p-5">
        
        {/* Vehicle Image */}
        <View className="w-full h-48 bg-gray-100 rounded-xl mb-6 overflow-hidden items-center justify-center">
          {driverProfile.vehicle_image_url ? (
            <Image 
              source={{ uri: driverProfile.vehicle_image_url }} 
              className="w-full h-full"
              resizeMode="cover"
            />
          ) : (
            <Text className="text-4xl">🚗</Text>
          )}
        </View>

        {/* Details Grid */}
        <View className="bg-white rounded-2xl p-5 gap-4 border border-gray-200">
          <View>
            <Text className="text-gray-500 text-sm mb-1">{t('vehicleType')}</Text>
            <Text className="text-gray-900 text-lg font-JakartaBold capitalize">{driverProfile.vehicle_type}</Text>
          </View>
          
          <View className="h-px bg-gray-200" />
          
          <View>
            <Text className="text-gray-500 text-sm mb-1">{t('vehicleNumber')}</Text>
            <Text className="text-gray-900 text-lg font-JakartaBold uppercase">{driverProfile.vehicle_number}</Text>
          </View>
          
          <View className="h-px bg-gray-200" />
          
          <View>
            <Text className="text-gray-500 text-sm mb-1">{t('makeAndModel')}</Text>
            <Text className="text-gray-900 text-lg font-JakartaBold">{driverProfile.vehicle_model}</Text>
          </View>
          
          <View className="h-px bg-gray-200" />
          
          <View>
            <Text className="text-gray-500 text-sm mb-1">{t('color')}</Text>
            <Text className="text-gray-900 text-lg font-JakartaBold capitalize">{driverProfile.vehicle_color || t('notSpecified')}</Text>
          </View>
        </View>
        
        <View className="mt-4 bg-blue-500/10 p-4 rounded-xl">
          <Text className="text-blue-400 text-xs text-center">
            {t('updateVehicleContactSupport')}
          </Text>
        </View>

      </View>
    </ScrollView>
  );
}
