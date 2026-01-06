import { useAuth } from "@/contexts/AuthContext";
import { Image, Text, View, TouchableOpacity, Alert, ImageSourcePropType } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { icons } from "@/constants";

interface ProfileItemProps {
    icon: ImageSourcePropType;
    title: string;
    onPress: () => void;
}

interface GridItemProps {
    icon: ImageSourcePropType;
    title: string;
    onPress: () => void;
}

const GridItem = ({ icon, title, onPress }: GridItemProps) => (
  <TouchableOpacity
    onPress={onPress}
    className="flex-1 items-center justify-center p-4 bg-gray-50 rounded-xl border border-gray-100 mx-1"
  >
    <View className="w-10 h-10 rounded-full bg-white items-center justify-center border border-gray-100 shadow-sm mb-2">
      <Image source={icon} resizeMode="contain" className="w-5 h-5" />
    </View>
    <Text className="text-sm font-JakartaMedium text-gray-700 text-center">{title}</Text>
  </TouchableOpacity>
);

const ProfileItem = ({ icon, title, onPress }: ProfileItemProps) => (
  <TouchableOpacity
    onPress={onPress}
    className="flex flex-row items-center justify-between w-full py-3 border-b border-gray-100"
  >
    <View className="flex flex-row items-center gap-3">
      <View className="w-8 h-8 rounded-full bg-gray-50 items-center justify-center">
        <Image source={icon} resizeMode="contain" className="w-4 h-4" />
      </View>
      <Text className="text-base font-JakartaMedium text-gray-800">{title}</Text>
    </View>
    <Image source={icons.arrowDown} className="w-4 h-4 -rotate-90" resizeMode="contain" tintColor="#9ca3af" />
  </TouchableOpacity>
);

const Profile = () => {
  const { profile, signOut } = useAuth();

  /* TEST FUNCTION: SIMULATE IDEMPOTENCY */
  const handleTestIdempotency = async () => {
    if (!profile?.id) return Alert.alert("Error", "Login first");

    const key = `TEST-${Date.now()}`;
    const testBookingParams = {
        customerId: profile.id,
        originAddress: "Test Origin",
        originLatitude: 12.9716,
        originLongitude: 77.5946,
        destinationAddress: "Test Dest",
        destinationLatitude: 12.9716,
        destinationLongitude: 77.6,
        vehicleType: "bike" as any,
        idempotencyKey: key
    };

    try {
        Alert.alert("Testing", "Firing 2 identicial requests...");
        
        // Fire two requests in parallel
        const req1 = import("@/lib/bookingUtils").then(m => m.createBooking(testBookingParams));
        const req2 = import("@/lib/bookingUtils").then(m => m.createBooking(testBookingParams));

        const [res1, res2] = await Promise.all([req1, req2]);

        console.log("Res1:", res1);
        console.log("Res2:", res2);

        if (res1.data?.id === res2.data?.id) {
            Alert.alert("Success! ✅", `Idempotency works!\nBoth requests returned Booking ID: ${res1.data?.id}`);
        } else {
            Alert.alert("Failed ❌", "Duplicate bookings created!");
        }

    } catch (e: any) {
        Alert.alert("Error", e.message);
    }
  };


  const handleLogout = async () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
        {
            text: "Cancel",
            style: "cancel"
        },
        {
            text: "Test Idempotency",
            onPress: handleTestIdempotency
        },
        {
            text: "Logout",
            style: "destructive",
            onPress: async () => {
                 await signOut();
                 router.replace("/sign-in");
            }
        }
    ]);
  };

  return (
    <SafeAreaView className="flex-1 bg-white px-5">
      {/* Header */}
      <Text className="text-2xl font-JakartaBold mt-4 mb-6">My Profile</Text>

      {/* User Info Card */}
      <TouchableOpacity 
        onPress={() => router.push("/profile-details")}
        className="flex flex-row items-center bg-green-50 p-4 rounded-xl border border-green-100 mb-4"
      >
        <Image
          source={{
            uri: profile?.avatar_url || "https://ui-avatars.com/api/?name=" + (profile?.name || "User"),
          }}
          className="rounded-full h-14 w-14 border-2 border-white"
        />
        <View className="ml-4 flex-1">
          <Text className="text-lg font-JakartaBold text-gray-900">{profile?.name || "User Name"}</Text>
          <Text className="text-sm text-gray-500 font-Jakarta">{profile?.email || "email@example.com"}</Text>
        </View>
        <View className="w-8 h-8 rounded-full bg-green-500 items-center justify-center">
          <Image source={icons.arrowDown} className="w-4 h-4 -rotate-90" resizeMode="contain" tintColor="white" />
        </View>
      </TouchableOpacity>

      {/* Grid: Saved Addresses & Help Center */}
      <View className="flex flex-row mb-4">
        <GridItem 
          icon={icons.home} 
          title="Saved Addresses" 
          onPress={() => router.push("/saved-addresses")} 
        />
        <GridItem 
          icon={icons.chat} 
          title="Help Center" 
          onPress={() => router.push("/help")} 
        />
      </View>

      {/* List Items */}
      <View className="bg-white rounded-xl px-4 py-2 border border-gray-100 mb-4">
        <ProfileItem 
          icon={icons.email} 
          title="Refer your friends" 
          onPress={() => Alert.alert("Invite", "Referral feature coming soon!")} 
        />
        <ProfileItem 
          icon={icons.list} 
          title="Language" 
          onPress={() => Alert.alert("Language", "Change Language feature coming soon!")} 
        />
        <ProfileItem 
          icon={icons.list} 
          title="Terms and Conditions" 
          onPress={() => router.push("/terms")} 
        />
      </View>

      {/* Logout Button */}
      <TouchableOpacity 
        onPress={handleLogout}
        className="flex flex-row items-center justify-center w-full py-3 bg-red-50 rounded-xl border border-red-100 mt-auto mb-24"
      >
        <Image source={icons.out} className="w-5 h-5 mr-2" resizeMode="contain" tintColor="#ef4444" />
        <Text className="text-base font-JakartaSemiBold text-red-500">Log Out</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

export default Profile;
