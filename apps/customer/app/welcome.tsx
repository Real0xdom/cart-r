import { router } from "expo-router";
import { Image, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useLanguage } from "@/contexts/LanguageContext";
import { images } from "@/constants";

const Welcome = () => {
  const { t } = useLanguage();
  return (
    <SafeAreaView className="flex-1 bg-white justify-between">
      {/* Header Logo */}
      <View className="px-6 pt-2 flex-row items-center">
        <View className="bg-black w-8 h-8 rounded-full items-center justify-center mr-2">
             {/* Using a simple styled text as a logo placeholder */}
            <Text className="text-white font-JakartaExtraBold text-lg">C</Text>
        </View>
        <Text className="text-2xl font-JakartaBold text-black">CARTR</Text>
      </View>

      {/* Main Illustration */}
      <View className="flex-1 items-center justify-center relative">
        {/* Background elements to simulate depth if needed, but keeping it clean for now */}
        <Image
          source={images.signUpCar}
          className="w-full h-[350px]"
          resizeMode="contain"
        />
      </View>

      {/* Bottom Section */}
      <View className="px-6 pb-10">
        <Text className="text-4xl font-JakartaBold text-black mb-4 leading-tight">
          {t("quickSafeReliable")}
        </Text>
        <Text className="text-gray-500 font-JakartaMedium text-base mb-8">
          {t("receivePackagesQuickly")}
        </Text>

        {/* Start Button */}
        <TouchableOpacity
          onPress={() => router.replace("/sign-in")}
          className="bg-general-500 flex-row items-center justify-between p-2 rounded-full h-16 w-full overflow-hidden"
          activeOpacity={0.8}
        >
          {/* Left Arrow Icon (faded) */}
          <View className="w-12 items-center justify-center">
             <Feather name="chevron-left" size={24} color="#A0A0A0" />
          </View>

          {/* Center Content */}
          <View className="flex-row items-center">
             <View className="bg-brand-500 w-10 h-10 rounded-full items-center justify-center mr-3">
                <Feather name="box" size={20} color="black" />
             </View>
             <Text className="text-lg font-JakartaBold text-black">{t("start")}</Text>
          </View>

           {/* Right Arrows Icon */}
           <View className="w-12 items-center justify-center">
              <Feather name="chevrons-right" size={24} color="#A0A0A0" />
           </View>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default Welcome;
