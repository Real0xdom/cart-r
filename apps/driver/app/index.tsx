import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { View, Image, StyleSheet } from "react-native";

import { useAuth } from "@/contexts/AuthContext";

const DriverEntry = () => {
  const { user, driverProfile, isLoading, refreshProfile } = useAuth();
  const [checkedDriverProfileForUserId, setCheckedDriverProfileForUserId] = useState<string | null>(null);
  const driverAppEnabled = (driverProfile as { driver_app_enabled?: boolean } | null)?.driver_app_enabled;

  useEffect(() => {
    if (!user) {
      setCheckedDriverProfileForUserId(null);
      return;
    }

    if (driverProfile) {
      setCheckedDriverProfileForUserId(user.id);
      return;
    }

    if (isLoading || checkedDriverProfileForUserId === user.id) {
      return;
    }

    let isCancelled = false;

    const hydrateDriverProfile = async () => {
      try {
        await refreshProfile();
      } finally {
        if (!isCancelled) {
          setCheckedDriverProfileForUserId(user.id);
        }
      }
    };

    void hydrateDriverProfile();

    return () => {
      isCancelled = true;
    };
  }, [checkedDriverProfileForUserId, driverProfile, isLoading, user]);

  const isHydratingExistingSession =
    Boolean(user) &&
    !driverProfile &&
    (isLoading || checkedDriverProfileForUserId !== user?.id);

  // Show branded splash (logo on dark green bg) while checking auth state
  // No duplicate refreshProfile() — AuthContext already fetches profile during initializeAuth()
  if (isLoading || isHydratingExistingSession) {
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

  if (driverAppEnabled === false) {
    console.log('[DriverEntry] Driver app access disabled - redirecting to blocked screen');
    return <Redirect href="/account-blocked" />;
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
