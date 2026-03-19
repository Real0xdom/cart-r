import { useAuth } from "@/contexts/AuthContext";
import { Image, Text, View, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import InputField from "@/components/InputField";

const ProfileDetails = () => {
  const { profile } = useAuth();

  return (
    <SafeAreaView className="flex-1 bg-white px-5">
      <View className="flex flex-row items-center py-4">
        <TouchableOpacity onPress={() => router.back()} className="mr-4">
          <Ionicons name="arrow-back" size={24} color="black" />
        </TouchableOpacity>

        <Text className="text-xl font-JakartaBold flex-1">Profile Details</Text>

        <TouchableOpacity onPress={() => router.push("/edit-profile")}
          className="ml-auto">
          <Text className="text-success-500 font-JakartaSemiBold">Edit</Text>
        </TouchableOpacity>
      </View>

      <View className="items-center my-6">
        <Image
          source={{
            uri:
              profile?.avatar_url ||
              "https://ui-avatars.com/api/?name=" + (profile?.name || "User"),
          }}
          className="rounded-full h-24 w-24 border-2 border-gray-100"
        />
      </View>

      <View className="bg-gray-50 rounded-xl p-4">
        <InputField
          label="Name"
          placeholder={profile?.name || "Not Found"}
          containerStyle="w-full"
          inputStyle="p-3"
          editable={false}
        />

        <InputField
          label="Email"
          placeholder={profile?.email || "Not Found"}
          containerStyle="w-full"
          inputStyle="p-3"
          editable={false}
        />

        <InputField
          label="Phone"
          placeholder={profile?.phone || "Not Found"}
          containerStyle="w-full"
          inputStyle="p-3"
          editable={false}
        />
      </View>
    </SafeAreaView>
  );
};

export default ProfileDetails;
