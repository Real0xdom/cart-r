import { Redirect } from "expo-router";
import { View, ActivityIndicator } from "react-native";

import { useAuth } from "@/contexts/AuthContext";

const CustomerEntry = () => {
  const { user, isLoading } = useAuth();

  // Show loading while checking auth state - CartR branded
  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#21461E' }}>
        <ActivityIndicator size="large" color="#ffffff" />
      </View>
    );
  }

  // If user is signed in, go to home
  if (user) {
    return <Redirect href="/(tabs)/home" />;
  }

  // If not signed in, go to sign-in screen directly
  return <Redirect href="/sign-in" />;
};

export default CustomerEntry;
