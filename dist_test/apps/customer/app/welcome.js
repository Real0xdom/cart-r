"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const expo_router_1 = require("expo-router");
const react_native_1 = require("react-native");
const react_native_safe_area_context_1 = require("react-native-safe-area-context");
const vector_icons_1 = require("@expo/vector-icons");
const constants_1 = require("@/constants");
const Welcome = () => {
    return (<react_native_safe_area_context_1.SafeAreaView className="flex-1 bg-white justify-between">
      {/* Header Logo */}
      <react_native_1.View className="px-6 pt-2 flex-row items-center">
        <react_native_1.View className="bg-black w-8 h-8 rounded-full items-center justify-center mr-2">
             {/* Using a simple styled text as a logo placeholder */}
            <react_native_1.Text className="text-white font-JakartaExtraBold text-lg">C</react_native_1.Text>
        </react_native_1.View>
        <react_native_1.Text className="text-2xl font-JakartaBold text-black">CARTR</react_native_1.Text>
      </react_native_1.View>

      {/* Main Illustration */}
      <react_native_1.View className="flex-1 items-center justify-center relative">
        {/* Background elements to simulate depth if needed, but keeping it clean for now */}
        <react_native_1.Image source={constants_1.images.signUpCar} className="w-full h-[350px]" resizeMode="contain"/>
      </react_native_1.View>

      {/* Bottom Section */}
      <react_native_1.View className="px-6 pb-10">
        <react_native_1.Text className="text-4xl font-JakartaBold text-black mb-4 leading-tight">
          Quick, Safe,{'\n'}And Reliable{'\n'}Delivery
        </react_native_1.Text>
        <react_native_1.Text className="text-gray-500 font-JakartaMedium text-base mb-8">
          Receive your packages quickly, safely, and without any hassle.
        </react_native_1.Text>

        {/* Start Button */}
        <react_native_1.TouchableOpacity onPress={() => expo_router_1.router.replace("/sign-in")} className="bg-general-500 flex-row items-center justify-between p-2 rounded-full h-16 w-full overflow-hidden" activeOpacity={0.8}>
          {/* Left Arrow Icon (faded) */}
          <react_native_1.View className="w-12 items-center justify-center">
             <vector_icons_1.Feather name="chevron-left" size={24} color="#A0A0A0"/>
          </react_native_1.View>

          {/* Center Content */}
          <react_native_1.View className="flex-row items-center">
             <react_native_1.View className="bg-brand-500 w-10 h-10 rounded-full items-center justify-center mr-3">
                <vector_icons_1.Feather name="box" size={20} color="black"/>
             </react_native_1.View>
             <react_native_1.Text className="text-lg font-JakartaBold text-black">Start</react_native_1.Text>
          </react_native_1.View>

           {/* Right Arrows Icon */}
           <react_native_1.View className="w-12 items-center justify-center">
              <vector_icons_1.Feather name="chevrons-right" size={24} color="#A0A0A0"/>
           </react_native_1.View>
        </react_native_1.TouchableOpacity>
      </react_native_1.View>
    </react_native_safe_area_context_1.SafeAreaView>);
};
exports.default = Welcome;
