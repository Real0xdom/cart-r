import { router } from "expo-router";
import { View, Text, TouchableOpacity, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import Map from "@/components/Map";
import { images } from "@/constants";

const Tracking = () => {
  return (
    <View className="flex-1 bg-white">
        {/* Map Background */}
        <View className="absolute inset-0 h-[60%]"> 
           <Map />
           {/* Simple overlay to blend top if needed, but keeping it clean */}
        </View>

        {/* Header */}
        <SafeAreaView className="z-10 bg-transparent pointer-events-box-none">
             <View className="flex-row items-center justify-between px-5 pt-2">
                 <TouchableOpacity 
                    onPress={() => router.back()}
                    className="w-12 h-12 bg-white rounded-full items-center justify-center shadow-sm"
                 >
                      <Feather name="chevron-left" size={24} color="black" />
                 </TouchableOpacity>
                 <Text className="text-xl font-JakartaBold text-black">Smart Tracking</Text>
                 <TouchableOpacity 
                    className="w-12 h-12 bg-white rounded-full items-center justify-center shadow-sm"
                 >
                      <Feather name="more-vertical" size={24} color="black" />
                 </TouchableOpacity>
             </View>
        </SafeAreaView>

        {/* Bottom Card */}
        <View className="absolute bottom-0 w-full bg-general-900 rounded-t-[40px] pt-8 pb-8 px-6 h-[60%] justify-start shadow-[0_-10px_40px_rgba(0,0,0,0.1)]">
            {/* Driver Info */}
            <View className="mb-6">
                 <View className="flex-row items-center justify-between">
                     <View className="flex-row items-center">
                         <View className="w-14 h-14 rounded-full bg-gray-300 overflow-hidden border-2 border-white">
                            <Image source={images.signUpCar} className="w-full h-full" resizeMode="cover" />
                         </View>
                         <View className="ml-4">
                             <Text className="text-lg font-JakartaBold text-black">Cameron Williamson</Text>
                             <Text className="text-gray-500 font-JakartaMedium text-sm">ID: VSK-4592SP</Text>
                         </View>
                     </View>
                 </View>

                 {/* Actions */}
                 <View className="flex-row mt-6 space-x-4">
                     <TouchableOpacity className="flex-1 bg-white p-4 rounded-2xl flex-row items-center justify-center shadow-sm">
                          <Feather name="phone" size={20} color="black" />
                          <Text className="ml-2 font-JakartaBold text-black">Call</Text>
                     </TouchableOpacity>
                     <TouchableOpacity className="flex-1 bg-white p-4 rounded-2xl flex-row items-center justify-center shadow-sm">
                          <Feather name="message-square" size={20} color="black" />
                          <Text className="ml-2 font-JakartaBold text-black">Message</Text>
                     </TouchableOpacity>
                 </View>
            </View>

            {/* Route Details Card */}
             <View className="bg-white rounded-[32px] p-6 flex-1 shadow-sm justify-between">
                  {/* From / To */}
                  <View className="flex-row justify-between">
                      <View>
                          <Text className="text-lg font-JakartaBold text-black">From</Text>
                          <Text className="text-gray-400 text-sm font-JakartaMedium mt-1">Marina, Dubai</Text>
                      </View>
                       <View className="items-end">
                          <Text className="text-lg font-JakartaBold text-black">To</Text>
                          <Text className="text-gray-400 text-sm font-JakartaMedium mt-1">Jumeirah, Dubai</Text>
                      </View>
                  </View>
                  
                  {/* Divider with timeline look if needed, but using simple separator for now */}
                   <View className="h-[1px] bg-gray-100 my-4" />
                  
                   <View className="flex-row justify-between mb-4">
                      <View>
                          <Text className="text-lg font-JakartaBold text-black">Customer</Text>
                          <Text className="text-gray-400 text-sm font-JakartaMedium mt-1">Henry Blake</Text>
                      </View>
                       <View className="items-end">
                          <Text className="text-lg font-JakartaBold text-black">Date</Text>
                          <Text className="text-gray-400 text-sm font-JakartaMedium mt-1">16 Feb 2026</Text>
                      </View>
                  </View>

                  {/* ID and Go Track */}
                   <View className="flex-row items-center justify-between">
                       <View>
                           <Text className="text-gray-500 font-JakartaBold text-sm">#ER</Text>
                           <Text className="text-black font-JakartaExtraBold text-xl">454-152-47N</Text>
                       </View>
                        <TouchableOpacity className="bg-brand-500 pl-4 pr-6 py-4 rounded-full flex-row items-center shadow-md">
                             <View className="bg-black/10 w-8 h-8 rounded-full items-center justify-center mr-3">
                                <Feather name="map-pin" size={16} color="black" />
                             </View>
                             <Text className="font-JakartaBold text-black text-lg">Go Track</Text>
                             <View className="ml-2">
                                <Feather name="chevrons-right" size={20} color="black" />
                             </View>
                        </TouchableOpacity>
                   </View>
             </View>
        </View>
    </View>
  )
}

export default Tracking;
