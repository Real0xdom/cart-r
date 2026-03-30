import { Redirect } from "expo-router";
import { View, Image, StyleSheet } from "react-native";

import { useAuth } from "@/contexts/AuthContext";

const DriverEntry = () => {
  const { user, driverProfile, isLoading } = useAuth();

  // Show branded splash (logo on dark green bg) while checking auth state
  // No duplicate refreshProfile() — AuthContext already fetches profile during initializeAuth()
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

  // Not signed in → sign in screen (everyone sees login first)
  if (!user) {
    return <Redirect href="/sign-in" />;
  }

  // Signed in but no driver profile → NEW driver, show onboarding form
  if (!driverProfile) {
    console.log('[DriverEntry] No driver profile found - redirecting to onboarding');
    return <Redirect href="/onboarding/personal-info" />;
  }

  // Driver profile exists - check verification status from DATABASE (single source of truth)
  const status = driverProfile.verification_status;
  console.log('[DriverEntry] Driver verification status:', status);

  if (status === 'approved') {
    // ✅ APPROVED driver → main app UI (tabs/home)
    console.log('[DriverEntry] Driver is APPROVED - showing main app');
    return <Redirect href="/(tabs)/home" />;
  }

  if (status === 'pending') {
    // ⏳ PENDING verification → show pending screen
    console.log('[DriverEntry] Driver is PENDING - showing verification pending');
    return <Redirect href="/onboarding/verification-pending" />;
  }

  if (status === 'rejected') {
    // ❌ REJECTED → show rejection screen with option to resubmit
    console.log('[DriverEntry] Driver is REJECTED - showing verification pending with rejection info');
    return <Redirect href="/onboarding/verification-pending" />;
  }

  // Default fallback for unknown status - treat as approved
  console.log('[DriverEntry] Unknown status, defaulting to home');
  return <Redirect href="/(tabs)/home" />;
};

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#355A31',
  },
  splashLogo: {
    width: 180,
    height: 180,
  },
});

export default DriverEntry;
