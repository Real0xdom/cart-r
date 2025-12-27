import { Redirect } from "expo-router";
import { View, ActivityIndicator } from "react-native";

import { useAuth } from "@/contexts/AuthContext";

const CustomerEntry = () => {
  const { user, profile, isLoading } = useAuth();

  // Show loading while checking auth state
  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#0286FF" />
      </View>
    );
  }

  // If user is signed in, go to home
  if (user && profile) {
    return <Redirect href="/(tabs)/home" />;
  }

  // If not signed in, go to welcome screen
  return <Redirect href="/welcome" />;
};

export default CustomerEntry;
