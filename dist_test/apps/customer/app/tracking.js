"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const expo_router_1 = require("expo-router");
const react_native_1 = require("react-native");
const react_native_safe_area_context_1 = require("react-native-safe-area-context");
const vector_icons_1 = require("@expo/vector-icons");
const Map_1 = __importDefault(require("@/components/Map"));
const constants_1 = require("@/constants");
const Tracking = () => {
    return (<react_native_1.View className="flex-1 bg-white">
        {/* Map Background */}
        <react_native_1.View className="absolute inset-0 h-[60%]"> 
           <Map_1.default />
           {/* Simple overlay to blend top if needed, but keeping it clean */}
        </react_native_1.View>

        {/* Header */}
        <react_native_safe_area_context_1.SafeAreaView className="z-10 bg-transparent pointer-events-box-none">
             <react_native_1.View className="flex-row items-center justify-between px-5 pt-2">
                 <react_native_1.TouchableOpacity onPress={() => expo_router_1.router.back()} className="w-12 h-12 bg-white rounded-full items-center justify-center shadow-sm">
                      <vector_icons_1.Feather name="chevron-left" size={24} color="black"/>
                 </react_native_1.TouchableOpacity>
                 <react_native_1.Text className="text-xl font-JakartaBold text-black">Smart Tracking</react_native_1.Text>
                 <react_native_1.TouchableOpacity className="w-12 h-12 bg-white rounded-full items-center justify-center shadow-sm">
                      <vector_icons_1.Feather name="more-vertical" size={24} color="black"/>
                 </react_native_1.TouchableOpacity>
             </react_native_1.View>
        </react_native_safe_area_context_1.SafeAreaView>

        {/* Bottom Card */}
        <react_native_1.View className="absolute bottom-0 w-full bg-general-900 rounded-t-[40px] pt-8 pb-8 px-6 h-[60%] justify-start shadow-[0_-10px_40px_rgba(0,0,0,0.1)]">
            {/* Driver Info */}
            <react_native_1.View className="mb-6">
                 <react_native_1.View className="flex-row items-center justify-between">
                     <react_native_1.View className="flex-row items-center">
                         <react_native_1.View className="w-14 h-14 rounded-full bg-gray-300 overflow-hidden border-2 border-white">
                            <react_native_1.Image source={constants_1.images.signUpCar} className="w-full h-full" resizeMode="cover"/>
                         </react_native_1.View>
                         <react_native_1.View className="ml-4">
                             <react_native_1.Text className="text-lg font-JakartaBold text-black">Cameron Williamson</react_native_1.Text>
                             <react_native_1.Text className="text-gray-500 font-JakartaMedium text-sm">ID: VSK-4592SP</react_native_1.Text>
                         </react_native_1.View>
                     </react_native_1.View>
                 </react_native_1.View>

                 {/* Actions */}
                 <react_native_1.View className="flex-row mt-6 space-x-4">
                     <react_native_1.TouchableOpacity className="flex-1 bg-white p-4 rounded-2xl flex-row items-center justify-center shadow-sm">
                          <vector_icons_1.Feather name="phone" size={20} color="black"/>
                          <react_native_1.Text className="ml-2 font-JakartaBold text-black">Call</react_native_1.Text>
                     </react_native_1.TouchableOpacity>
                     <react_native_1.TouchableOpacity className="flex-1 bg-white p-4 rounded-2xl flex-row items-center justify-center shadow-sm">
                          <vector_icons_1.Feather name="message-square" size={20} color="black"/>
                          <react_native_1.Text className="ml-2 font-JakartaBold text-black">Message</react_native_1.Text>
                     </react_native_1.TouchableOpacity>
                 </react_native_1.View>
            </react_native_1.View>

            {/* Route Details Card */}
             <react_native_1.View className="bg-white rounded-[32px] p-6 flex-1 shadow-sm justify-between">
                  {/* From / To */}
                  <react_native_1.View className="flex-row justify-between">
                      <react_native_1.View>
                          <react_native_1.Text className="text-lg font-JakartaBold text-black">From</react_native_1.Text>
                          <react_native_1.Text className="text-gray-400 text-sm font-JakartaMedium mt-1">Marina, Dubai</react_native_1.Text>
                      </react_native_1.View>
                       <react_native_1.View className="items-end">
                          <react_native_1.Text className="text-lg font-JakartaBold text-black">To</react_native_1.Text>
                          <react_native_1.Text className="text-gray-400 text-sm font-JakartaMedium mt-1">Jumeirah, Dubai</react_native_1.Text>
                      </react_native_1.View>
                  </react_native_1.View>
                  
                  {/* Divider with timeline look if needed, but using simple separator for now */}
                   <react_native_1.View className="h-[1px] bg-gray-100 my-4"/>
                  
                   <react_native_1.View className="flex-row justify-between mb-4">
                      <react_native_1.View>
                          <react_native_1.Text className="text-lg font-JakartaBold text-black">Customer</react_native_1.Text>
                          <react_native_1.Text className="text-gray-400 text-sm font-JakartaMedium mt-1">Henry Blake</react_native_1.Text>
                      </react_native_1.View>
                       <react_native_1.View className="items-end">
                          <react_native_1.Text className="text-lg font-JakartaBold text-black">Date</react_native_1.Text>
                          <react_native_1.Text className="text-gray-400 text-sm font-JakartaMedium mt-1">16 Feb 2026</react_native_1.Text>
                      </react_native_1.View>
                  </react_native_1.View>

                  {/* ID and Go Track */}
                   <react_native_1.View className="flex-row items-center justify-between">
                       <react_native_1.View>
                           <react_native_1.Text className="text-gray-500 font-JakartaBold text-sm">#ER</react_native_1.Text>
                           <react_native_1.Text className="text-black font-JakartaExtraBold text-xl">454-152-47N</react_native_1.Text>
                       </react_native_1.View>
                        <react_native_1.TouchableOpacity className="bg-brand-500 pl-4 pr-6 py-4 rounded-full flex-row items-center shadow-md">
                             <react_native_1.View className="bg-black/10 w-8 h-8 rounded-full items-center justify-center mr-3">
                                <vector_icons_1.Feather name="map-pin" size={16} color="black"/>
                             </react_native_1.View>
                             <react_native_1.Text className="font-JakartaBold text-black text-lg">Go Track</react_native_1.Text>
                             <react_native_1.View className="ml-2">
                                <vector_icons_1.Feather name="chevrons-right" size={20} color="black"/>
                             </react_native_1.View>
                        </react_native_1.TouchableOpacity>
                   </react_native_1.View>
             </react_native_1.View>
        </react_native_1.View>
    </react_native_1.View>);
};
exports.default = Tracking;
