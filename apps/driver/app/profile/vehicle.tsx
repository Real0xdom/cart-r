import { View, Text, ScrollView, Image } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';

export default function VehicleDetails() {
  const { driverProfile } = useAuth();
  
  if (!driverProfile) return null;

  return (
    <ScrollView className="flex-1 bg-gray-900">
      <View className="p-5">
        
        {/* Vehicle Image */}
        <View className="w-full h-48 bg-gray-800 rounded-xl mb-6 overflow-hidden items-center justify-center">
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
        <View className="bg-gray-800 rounded-2xl p-5 gap-4">
          <View>
            <Text className="text-gray-400 text-sm mb-1">Vehicle Type</Text>
            <Text className="text-white text-lg font-JakartaBold capitalize">{driverProfile.vehicle_type}</Text>
          </View>
          
          <View className="h-px bg-gray-700" />
          
          <View>
            <Text className="text-gray-400 text-sm mb-1">Vehicle Number</Text>
            <Text className="text-white text-lg font-JakartaBold uppercase">{driverProfile.vehicle_number}</Text>
          </View>
          
          <View className="h-px bg-gray-700" />
          
          <View>
            <Text className="text-gray-400 text-sm mb-1">Make & Model</Text>
            <Text className="text-white text-lg font-JakartaBold">{driverProfile.vehicle_model}</Text>
          </View>
          
          <View className="h-px bg-gray-700" />
          
          <View>
            <Text className="text-gray-400 text-sm mb-1">Color</Text>
            <Text className="text-white text-lg font-JakartaBold capitalize">{driverProfile.vehicle_color || 'Not Specified'}</Text>
          </View>
        </View>
        
        <View className="mt-4 bg-blue-500/10 p-4 rounded-xl">
          <Text className="text-blue-400 text-xs text-center">
            To update vehicle details, please contact support. Changes require re-verification.
          </Text>
        </View>

      </View>
    </ScrollView>
  );
}
