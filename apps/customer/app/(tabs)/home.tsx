import { useAuth } from "@/contexts/AuthContext";
import { router } from "expo-router";
import { View, Text, TouchableOpacity, Image, TextInput, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons"; // Ensure you have this installed or use standard icons
import { images } from "@/constants";

const Home = () => {
  const { profile, signOut } = useAuth();

  return (
    <SafeAreaView className="flex-1 bg-general-900 px-5">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Header */}
        <View className="flex-row items-center justify-between mt-2">
          <View className="flex-row items-center">
            <View className="bg-white p-1 rounded-full shadow-sm mr-3">
               {/* Simple avatar placeholder */}
               <Image source={images.check} className="w-10 h-10 rounded-full" resizeMode="contain" />
            </View>
            <View>
              <Text className="text-gray-500 text-xs font-JakartaMedium">Delivery to</Text>
              <View className="flex-row items-center">
                <Text className="text-black font-JakartaBold text-sm">Northern Gate</Text>
                <Feather name="chevron-down" size={14} color="black" style={{ marginLeft: 4 }} />
              </View>
            </View>
          </View>
          <TouchableOpacity onPress={() => signOut()} className="bg-white p-3 rounded-full shadow-sm">
             <Feather name="bell" size={20} color="black" />
          </TouchableOpacity>
        </View>

        {/* Title */}
        <Text className="text-3xl font-JakartaBold text-black mt-8 leading-tight">
          Reliable Delivery{'\n'}At Your Door
        </Text>

        {/* Search Bar - Navigates to find-ride on press */}
        <TouchableOpacity 
          onPress={() => router.push("/find-ride")}
          className="mt-6 flex-row items-center bg-white rounded-3xl p-4 shadow-sm"
        >
          <Feather name="search" size={20} color="#A0A0A0" />
          <Text className="flex-1 ml-3 font-JakartaMedium text-gray-400">Search...</Text>
          <View className="bg-gray-100 p-2 rounded-full">
             <Feather name="filter" size={16} color="black" />
          </View>
        </TouchableOpacity>

        {/* Current Shipments Header */}
        <View className="mt-8 flex-row items-center justify-between mb-4">
          <Text className="text-lg font-JakartaBold text-black">My Current Shipments</Text>
          <TouchableOpacity onPress={() => router.push("/(tabs)/rides")}>
            <Text className="text-gray-500 font-JakartaMedium text-sm">See All</Text>
          </TouchableOpacity>
        </View>

        {/* Shipment Card */}
        <TouchableOpacity 
            activeOpacity={0.9}
            className="bg-white rounded-[32px] p-5 shadow-sm overflow-hidden relative"
            onPress={() => router.push("/tracking")} // Navigate to details
        >
            {/* Tag */}
            <View className="flex-row justify-between items-start z-10">
                <View className="bg-gray-100 px-4 py-2 rounded-full">
                    <Text className="text-gray-600 text-xs font-JakartaBold">Transit</Text>
                </View>
            </View>

            {/* Truck Image - positioned absolutely to overlap */}
            <View className="items-center -mt-8 mb-4">
                 <Image 
                    source={images.signUpCar} 
                    className="w-64 h-40"
                    resizeMode="contain"
                />
            </View>

            {/* Progress Info */}
            <View className="mt-2">
                <Text className="text-right text-gray-500 text-xs font-JakartaMedium mb-2">4h Away</Text>
                
                {/* Custom Progress Bar */}
                <View className="h-2 bg-gray-100 rounded-full mb-6 relative flex-row items-center">
                    <View className="w-2/3 h-full bg-black rounded-full" />
                    <View className="absolute left-[60%] w-6 h-6 bg-black border-[3px] border-white rounded-full items-center justify-center shadow-sm">
                        <View className="w-1.5 h-1.5 bg-brand-500 rounded-full" />
                    </View>
                    <View className="absolute right-0 w-3 h-3 bg-gray-300 rounded-full border-2 border-white" />
                </View>

                {/* Locations */}
                <View className="flex-row justify-between items-start">
                    <View>
                        <Text className="text-black font-JakartaBold text-sm mb-1">15 Feb 2026</Text>
                        <Text className="text-gray-400 text-xs font-JakartaMedium">Marina, Dubai</Text>
                    </View>
                    <View className="items-end">
                        <Text className="text-black font-JakartaBold text-sm mb-1">Estimated 16 Feb 2026</Text>
                        <Text className="text-gray-400 text-xs font-JakartaMedium">Jumeirah, Dubai</Text>
                    </View>
                </View>
                
                {/* Footer with ID and Action */}
                <View className="mt-6 flex-row items-center justify-between bg-brand-100 p-4 -mx-5 -mb-5">
                    <View className="ml-2">
                        <Text className="text-gray-500 text-xs font-JakartaMedium">Tracking ID</Text>
                        <Text className="text-black font-JakartaBold text-lg">#ER 454-152</Text>
                    </View>
                    <TouchableOpacity className="bg-brand-500 w-12 h-12 rounded-full items-center justify-center shadow-lg mr-2">
                            <Feather name="arrow-up-right" size={24} color="black" />
                    </TouchableOpacity>
                </View>
            </View>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
};

export default Home;