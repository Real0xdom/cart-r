import { View, Text, ScrollView, Image, TouchableOpacity, Linking, Alert, ActivityIndicator } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Feather } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import { decode } from 'base64-arraybuffer';

export default function Documents() {
  const { driverProfile, refreshProfile } = useAuth();
  const [uploading, setUploading] = useState<string | null>(null);

  const openImage = (url?: string | null) => {
    if (url) {
      Linking.openURL(url).catch(() => Alert.alert('Error', 'Could not open document'));
    } else {
      Alert.alert('No Document', 'No document image uploaded.');
    }
  };

  const uploadDocument = async (field: 'license_image_url' | 'rc_image_url' | 'insurance_image_url') => {
    // Prevent edit if verified
    if (driverProfile?.verification_status === 'approved') {
        Alert.alert('Verified', 'Your documents are verified and cannot be changed. Contact support for updates.');
        return;
    }

    try {
      // Pick Image
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.5,
      });

      if (!result.canceled) {
        setUploading(field);
        const img = result.assets[0];
        const base64 = await FileSystem.readAsStringAsync(img.uri, { encoding: 'base64' });
        
        // Generate Unique ID for filename
        const uniqueId = Math.random().toString(36).substring(2, 15);
        const fileName = `${driverProfile?.id}/${field}_${uniqueId}.jpg`;
        const contentType = 'image/jpeg';

        // Upload to Supabase
        const { error: uploadError } = await supabase.storage
          .from('documents') // Ensure this bucket exists
          .upload(fileName, decode(base64), { contentType, upsert: true });

        if (uploadError) throw uploadError;

        // Get Public URL
        const { data: { publicUrl } } = supabase.storage
          .from('documents')
          .getPublicUrl(fileName);

        // Update Driver Profile
        const { error: updateError } = await supabase
          .from('drivers')
          .update({ [field]: publicUrl })
          .eq('id', driverProfile?.id);

        if (updateError) throw updateError;

        await refreshProfile();
        Alert.alert('Success', 'Document uploaded successfully');
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      Alert.alert('Error', error.message || 'Failed to upload document');
    } finally {
      setUploading(null);
    }
  };

  // Generate a mock unique document ID for display based on the URL or field
  const getDocumentId = (url: string | null | undefined, type: string) => {
     if (!url) return '---';
     // Extract a short hash from the URL or fallback to a generated one based on driver ID
     const shortHash = url.split('/').pop()?.substring(0, 8) || 'DOC';
     return `${type.toUpperCase()}-${shortHash.toUpperCase()}`;
  };

  const DocumentCard = ({ title, subValue, imageUrl, field }: { title: string, subValue?: string, imageUrl?: string | null, field: 'license_image_url' | 'rc_image_url' | 'insurance_image_url' }) => (
    <View className="bg-gray-800 rounded-2xl p-4 mb-4">
      {/* Header Row - Wrapped to prevent overflow */}
      <View className="flex-row justify-between items-start mb-3 flex-wrap">
        <View className="flex-1 mr-2">
          <Text className="text-white font-JakartaSemiBold text-lg">{title}</Text>
          {subValue && <Text className="text-gray-400 text-sm">{subValue}</Text>}
          <Text className="text-gray-500 text-xs mt-1">ID: {getDocumentId(imageUrl, field.split('_')[0])}</Text>
        </View>
        
        {imageUrl ? (
            <View className="bg-green-500/20 px-2 py-1 rounded self-start">
                <Text className="text-green-400 text-xs font-JakartaBold">Verified</Text>
            </View>
        ) : (
            <View className="bg-red-500/20 px-2 py-1 rounded self-start">
                <Text className="text-red-400 text-xs font-JakartaBold">Missing</Text>
            </View>
        )}
      </View>
      
      {/* Upload/View Area */}
      <TouchableOpacity 
        onPress={() => imageUrl ? openImage(imageUrl) : uploadDocument(field)}
        onLongPress={() => !imageUrl || driverProfile?.verification_status !== 'approved' ? uploadDocument(field) : null}
        disabled={uploading === field}
        className="h-40 bg-gray-900 rounded-xl items-center justify-center border border-gray-700 border-dashed overflow-hidden relative"
      >
        {uploading === field ? (
            <ActivityIndicator color="#22c55e" size="large" />
        ) : imageUrl ? (
           <>
             <Image source={{ uri: imageUrl }} className="w-full h-full rounded-xl" resizeMode="cover" />
             {/* Edit Overlay (if allowed) */}
             {driverProfile?.verification_status !== 'approved' && (
                <View className="absolute bottom-2 right-2 bg-black/50 p-2 rounded-full">
                    <Feather name="edit-2" size={16} color="white" />
                </View>
             )}
           </>
        ) : (
           <View className="items-center">
             <Feather name="upload-cloud" size={24} color="#6b7280" />
             <Text className="text-gray-500 mt-2">Tap to upload</Text>
           </View>
        )}
      </TouchableOpacity>
      
      {imageUrl && driverProfile?.verification_status !== 'approved' && (
          <Text className="text-gray-500 text-xs text-center mt-2">Long press to change document</Text>
      )}
    </View>
  );

  return (
    <ScrollView className="flex-1 bg-gray-900">
      <View className="p-5">
        <DocumentCard 
          title="Driving License" 
          subValue={`Expires: ${driverProfile?.license_expiry || 'N/A'}`}
          imageUrl={driverProfile?.license_image_url} 
          field="license_image_url"
        />
        <DocumentCard 
          title="RC Book" 
          subValue="Registration Certificate"
          imageUrl={driverProfile?.rc_image_url} 
          field="rc_image_url"
        />
        <DocumentCard 
          title="Vehicle Insurance" 
          subValue="Policy Document"
          imageUrl={driverProfile?.insurance_image_url} 
          field="insurance_image_url"
        />
      </View>
    </ScrollView>
  );
}
