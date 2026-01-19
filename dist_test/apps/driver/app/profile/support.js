"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = Support;
const react_native_1 = require("react-native");
function Support() {
    const openLink = (url) => react_native_1.Linking.openURL(url);
    return (<react_native_1.ScrollView className="flex-1 bg-gray-900">
      <react_native_1.View className="p-5">
        
        <react_native_1.Text className="text-white text-2xl font-JakartaBold mb-2">How can we help?</react_native_1.Text>
        <react_native_1.Text className="text-gray-400 mb-6">Select an option below to get assistance.</react_native_1.Text>

        <react_native_1.View className="gap-4">
            <react_native_1.TouchableOpacity onPress={() => openLink('tel:1800123456')} className="bg-gray-800 p-5 rounded-2xl flex-row items-center">
                <react_native_1.View className="w-12 h-12 bg-blue-500/20 rounded-full items-center justify-center mr-4">
                    <react_native_1.Text className="text-2xl">📞</react_native_1.Text>
                </react_native_1.View>
                <react_native_1.View>
                    <react_native_1.Text className="text-white font-JakartaBold text-lg">Call Support</react_native_1.Text>
                    <react_native_1.Text className="text-gray-400">Speak with an agent</react_native_1.Text>
                </react_native_1.View>
            </react_native_1.TouchableOpacity>

            <react_native_1.TouchableOpacity onPress={() => openLink('mailto:support@cart-r.com')} className="bg-gray-800 p-5 rounded-2xl flex-row items-center">
                 <react_native_1.View className="w-12 h-12 bg-green-500/20 rounded-full items-center justify-center mr-4">
                    <react_native_1.Text className="text-2xl">✉️</react_native_1.Text>
                </react_native_1.View>
                <react_native_1.View>
                    <react_native_1.Text className="text-white font-JakartaBold text-lg">Email Us</react_native_1.Text>
                    <react_native_1.Text className="text-gray-400">Get a response in 24h</react_native_1.Text>
                </react_native_1.View>
            </react_native_1.TouchableOpacity>
            
            <react_native_1.TouchableOpacity onPress={() => {
            const { router } = require('expo-router');
            router.push('/profile/faq');
        }} className="bg-gray-800 p-5 rounded-2xl flex-row items-center">
                 <react_native_1.View className="w-12 h-12 bg-purple-500/20 rounded-full items-center justify-center mr-4">
                    <react_native_1.Text className="text-2xl">❓</react_native_1.Text>
                </react_native_1.View>
                <react_native_1.View>
                    <react_native_1.Text className="text-white font-JakartaBold text-lg">FAQs</react_native_1.Text>
                    <react_native_1.Text className="text-gray-400">Common questions</react_native_1.Text>
                </react_native_1.View>
            </react_native_1.TouchableOpacity>
        </react_native_1.View>

        <react_native_1.View className="mt-8 bg-gray-800/50 p-6 rounded-2xl"> 
            <react_native_1.Text className="text-white font-JakartaBold mb-2">Emergency Service</react_native_1.Text>
            <react_native_1.Text className="text-gray-400 text-sm mb-4">
                If you are in an unsafe situation or need immediate emergency assistance, please press the SOS button.
            </react_native_1.Text>
            <react_native_1.TouchableOpacity onPress={() => openLink('tel:112')} className="bg-red-500 p-3 rounded-xl">
                <react_native_1.Text className="text-white text-center font-JakartaBold">SOS - Call 112</react_native_1.Text>
            </react_native_1.TouchableOpacity>
        </react_native_1.View>

      </react_native_1.View>
    </react_native_1.ScrollView>);
}
