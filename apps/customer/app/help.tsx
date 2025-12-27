import { View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function Help() {
  return (
    <SafeAreaView className="flex-1 bg-white px-5">
      {/* Header */}
      <View className="flex flex-row items-center py-4">
        <TouchableOpacity onPress={() => router.back()} className="mr-4">
          <Ionicons name="arrow-back" size={24} color="black" />
        </TouchableOpacity>
        <Text className="text-xl font-JakartaBold">Help Center</Text>
      </View>

      {/* Content */}
      <View className="flex-1 items-center justify-center">
        <Text className="text-base text-gray-500">Contact us at support@cartr.com</Text>
      </View>
    </SafeAreaView>
  );
}
