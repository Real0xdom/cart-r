import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Image, Text, View, TouchableOpacity, Alert, ImageSourcePropType, Share } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as Linking from "expo-linking";
import { icons } from "@/constants";
import LanguageModal from "@/components/LanguageModal";

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
  const { t } = useLanguage();
  const [languageModalVisible, setLanguageModalVisible] = useState(false);

  const handleReferFriends = async () => {
    let referralCode = (profile as { referral_code?: string } | null)?.referral_code;
    if (!referralCode && profile?.id) {
      const { supabase } = await import("@/lib/supabase");
      const { data } = await supabase.from("users").select("referral_code").eq("id", profile.id).single();
      referralCode = data?.referral_code ?? undefined;
    }
    if (!referralCode) {
      Alert.alert(t("referAndEarn"), t("referMessage"));
      return;
    }
    const baseUrl = Linking.createURL("");
    const shareUrl = baseUrl + (baseUrl.includes("?") ? "&" : "?") + "ref=" + referralCode;
    const message = `Join Carter and get a ride! Use my referral code ${referralCode} when you sign up, or open this link: ${shareUrl}`;
    try {
      await Share.share({
        message,
        title: "Refer Carter",
        url: shareUrl,
      });
    } catch (_e) {
      // User dismissed share
    }
  };

  const handleLogout = async () => {
    Alert.alert(t("logout"), t("logoutConfirm"), [
        {
            text: t("cancel"),
            style: "cancel"
        },
        {
            text: t("logout"),
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
      <LanguageModal visible={languageModalVisible} onClose={() => setLanguageModalVisible(false)} />
      {/* Header */}
      <Text className="text-2xl font-JakartaBold mt-4 mb-6">{t("myProfile")}</Text>

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
          <Text className="text-lg font-JakartaBold text-gray-900">{profile?.name || t("user")}</Text>
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
          title={t("savedAddresses")} 
          onPress={() => router.push("/saved-addresses")} 
        />
        <GridItem 
          icon={icons.chat} 
          title={t("helpCenter")} 
          onPress={() => router.push("/help")} 
        />
      </View>

      {/* List Items */}
      <View className="bg-white rounded-xl px-4 py-2 border border-gray-100 mb-4">
        <ProfileItem 
          icon={icons.email} 
          title={t("referYourFriends")} 
          onPress={handleReferFriends} 
        />
        <ProfileItem 
          icon={icons.list} 
          title={t("language")} 
          onPress={() => setLanguageModalVisible(true)} 
        />
        <ProfileItem 
          icon={icons.list} 
          title={t("termsAndConditions")} 
          onPress={() => router.push("/terms")} 
        />
      </View>

      {/* Logout Button */}
      <TouchableOpacity 
        onPress={handleLogout}
        className="flex flex-row items-center justify-center w-full py-3 bg-red-50 rounded-xl border border-red-100 mt-auto mb-24"
      >
        <Image source={icons.out} className="w-5 h-5 mr-2" resizeMode="contain" tintColor="#ef4444" />
        <Text className="text-base font-JakartaSemiBold text-red-500">{t("logOut")}</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

export default Profile;
