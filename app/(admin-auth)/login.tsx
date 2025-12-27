
import { View, Text, TextInput, TouchableOpacity } from "react-native";
import { useAuth } from "@/contexts/AuthContext";
import { SafeAreaView } from "react-native-safe-area-context";

export default function AdminLogin() {
  const { adminSignIn } = useAuth();

  return (
    <SafeAreaView className="flex-1 bg-gray-100 justify-center items-center">
      <View className="bg-white p-8 rounded-xl w-[360px] shadow">
        <Text className="text-2xl font-JakartaBold mb-6 text-center">
          Carter Admin
        </Text>

        <TextInput
          placeholder="Admin Email"
          className="border px-4 py-3 rounded-lg mb-4"
        />

        <TextInput
          placeholder="Password"
          secureTextEntry
          className="border px-4 py-3 rounded-lg mb-6"
        />

        <TouchableOpacity
          onPress={adminSignIn}
          className="bg-black py-3 rounded-lg"
        >
          <Text className="text-white text-center font-JakartaMedium">
            Login
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
