import { View, Text, ScrollView, TouchableOpacity, Linking } from 'react-native';

export default function Support() {
  const openLink = (url: string) => Linking.openURL(url);

  return (
    <ScrollView className="flex-1 bg-gray-900">
      <View className="p-5">
        
        <Text className="text-white text-2xl font-JakartaBold mb-2">How can we help?</Text>
        <Text className="text-gray-400 mb-6">Select an option below to get assistance.</Text>

        <View className="gap-4">
            <TouchableOpacity 
                onPress={() => openLink('tel:1800123456')}
                className="bg-gray-800 p-5 rounded-2xl flex-row items-center"
            >
                <View className="w-12 h-12 bg-blue-500/20 rounded-full items-center justify-center mr-4">
                    <Text className="text-2xl">📞</Text>
                </View>
                <View>
                    <Text className="text-white font-JakartaBold text-lg">Call Support</Text>
                    <Text className="text-gray-400">Speak with an agent</Text>
                </View>
            </TouchableOpacity>

            <TouchableOpacity 
                onPress={() => openLink('mailto:support@cart-r.com')}
                className="bg-gray-800 p-5 rounded-2xl flex-row items-center"
            >
                 <View className="w-12 h-12 bg-green-500/20 rounded-full items-center justify-center mr-4">
                    <Text className="text-2xl">✉️</Text>
                </View>
                <View>
                    <Text className="text-white font-JakartaBold text-lg">Email Us</Text>
                    <Text className="text-gray-400">Get a response in 24h</Text>
                </View>
            </TouchableOpacity>
            
            <TouchableOpacity 
                className="bg-gray-800 p-5 rounded-2xl flex-row items-center"
            >
                 <View className="w-12 h-12 bg-purple-500/20 rounded-full items-center justify-center mr-4">
                    <Text className="text-2xl">❓</Text>
                </View>
                <View>
                    <Text className="text-white font-JakartaBold text-lg">FAQs</Text>
                    <Text className="text-gray-400">Common questions</Text>
                </View>
            </TouchableOpacity>
        </View>

        <View className="mt-8 bg-gray-800/50 p-6 rounded-2xl"> 
            <Text className="text-white font-JakartaBold mb-2">Emergency Service</Text>
            <Text className="text-gray-400 text-sm mb-4">
                If you are in an unsafe situation or need immediate emergency assistance, please press the SOS button.
            </Text>
            <TouchableOpacity 
                onPress={() => openLink('tel:112')}
                className="bg-red-500 p-3 rounded-xl"
            >
                <Text className="text-white text-center font-JakartaBold">SOS - Call 112</Text>
            </TouchableOpacity>
        </View>

      </View>
    </ScrollView>
  );
}
