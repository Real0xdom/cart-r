import { Redirect } from "expo-router";
import { View, ActivityIndicator } from "react-native";
import { useEffect } from "react";

import { useAuth } from "@/contexts/AuthContext";

const DriverEntry = () => {
  const { user, driverProfile, isLoading, refreshProfile } = useAuth();

  // Refresh profile on mount to ensure we have latest data from database
  useEffect(() => {
    if (user && !isLoading) {
      // Always fetch fresh data from database on app launch
      refreshProfile();
    }
  }, [user, isLoading]);

  // Show loading while checking auth state or fetching profile
  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#22C55E' }}>
        <ActivityIndicator size="large" color="#ffffff" />
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

export default DriverEntry;
