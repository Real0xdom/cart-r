import { Redirect } from "expo-router";
import { View, ActivityIndicator } from "react-native";

import { useAuth } from "@/contexts/AuthContext";

const DriverEntry = () => {
  const { user, driverProfile, isLoading } = useAuth();

  // Show loading while checking auth state
  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#22C55E' }}>
        <ActivityIndicator size="large" color="#ffffff" />
      </View>
    );
  }

  // If driver is signed in and verified, go to home
  if (user && driverProfile) {
    return <Redirect href="/(tabs)/home" />;
  }

  // If not signed in, go to sign-in screen
  return <Redirect href="/sign-in" />;
};

export default DriverEntry;
