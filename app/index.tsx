import { Redirect } from "expo-router";
import { View, ActivityIndicator } from "react-native";

import { useAuth } from "@/contexts/AuthContext";

const Page = () => {
  const { user, profile, isLoading } = useAuth();

  // Show loading while checking auth state
  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#0286FF" />
      </View>
    );
  }

  // If user is signed in, redirect based on role
  if (user && profile) {
    if (profile.role === 'admin') {
      return <Redirect href="/(admin)/dashboard" />;
    } else if (profile.role === 'driver') {
      return <Redirect href="/(driver)/(tabs)/home" />;
    } else {
      return <Redirect href="/(customer)/(tabs)/home" />;
    }
  }

  // If not signed in, go to welcome screen
  return <Redirect href="/(auth)/welcome" />;
};

export default Page;

