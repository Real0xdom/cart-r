import { Redirect } from "expo-router";
import { View, ActivityIndicator, Image } from "react-native";

import { useAuth } from "@/contexts/AuthContext";

const CustomerEntry = () => {
  const { user, profile, isLoading } = useAuth();

  // Show loading while checking auth state - CartR branded
  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#4CAF50' }}>
        <Image 
          source={require('@/assets/splash-logo.png')} 
          style={{ width: 200, height: 200, marginBottom: 20 }}
          resizeMode="contain"
        />
        <ActivityIndicator size="large" color="#ffffff" />
      </View>
    );
  }

  // If user is signed in, go to home
  if (user && profile) {
    return <Redirect href="/(tabs)/home" />;
  }

  // If not signed in, go to sign-in screen directly
  return <Redirect href="/sign-in" />;
};

export default CustomerEntry;
