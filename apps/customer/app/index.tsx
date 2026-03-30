import { Redirect } from "expo-router";
import { View, Image, StyleSheet } from "react-native";

import { useAuth } from "@/contexts/AuthContext";

const CustomerEntry = () => {
  const { user, isLoading } = useAuth();

  // Show branded splash (logo on dark green bg) while checking auth state
  if (isLoading) {
    return (
      <View style={styles.splashContainer}>
        <Image
          source={require("../assets/splash-logo.png")}
          style={styles.splashLogo}
          resizeMode="contain"
        />
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

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#21461E',
  },
  splashLogo: {
    width: 180,
    height: 180,
  },
});

export default CustomerEntry;
