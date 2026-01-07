import { View, Text, ScrollView, Image, TouchableOpacity, Linking, Alert } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';

export default function Documents() {
  const { driverProfile } = useAuth();
  
  const openImage = (url?: string | null) => {
    if (url) {
      Linking.openURL(url).catch(() => Alert.alert('Error', 'Could not open document'));
    } else {
      Alert.alert('No Document', 'No document image uploaded.');
    }
  };

  const DocumentCard = ({ title, subValue, imageUrl }: { title: string, subValue?: string, imageUrl?: string | null }) => (
    <View className="bg-gray-800 rounded-2xl p-4 mb-4">
      <View className="flex-row justify-between items-start mb-3">
        <View>
          <Text className="text-white font-JakartaSemiBold text-lg">{title}</Text>
          {subValue && <Text className="text-gray-400 text-sm">{subValue}</Text>}
        </View>
        {imageUrl ? (
            <View className="bg-green-500/20 px-2 py-1 rounded">
                <Text className="text-green-400 text-xs">Uploaded</Text>
            </View>
        ) : (
            <View className="bg-red-500/20 px-2 py-1 rounded">
                <Text className="text-red-400 text-xs">Missing</Text>
            </View>
        )}
      </View>
      
      <TouchableOpacity 
        onPress={() => openImage(imageUrl)}
        className="h-32 bg-gray-900 rounded-xl items-center justify-center border border-gray-700 border-dashed"
      >
        {imageUrl ? (
           <Image source={{ uri: imageUrl }} className="w-full h-full rounded-xl" resizeMode="cover" />
        ) : (
           <Text className="text-gray-500">Tap to upload (Coming Soon)</Text>
        )}
      </TouchableOpacity>
    </View>
  );

  return (
    <ScrollView className="flex-1 bg-gray-900">
      <View className="p-5">
        <DocumentCard 
          title="Driving License" 
          subValue={`Expires: ${driverProfile?.license_expiry || 'N/A'}`}
          imageUrl={driverProfile?.license_image_url} 
        />
        <DocumentCard 
          title="RC Book (Registration)" 
          imageUrl={driverProfile?.rc_image_url} 
        />
        <DocumentCard 
          title="Vehicle Insurance" 
          imageUrl={driverProfile?.insurance_image_url} 
        />
      </View>
    </ScrollView>
  );
}
