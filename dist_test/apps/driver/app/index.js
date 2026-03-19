"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const expo_router_1 = require("expo-router");
const react_native_1 = require("react-native");
const react_1 = require("react");
const AuthContext_1 = require("@/contexts/AuthContext");
const DriverEntry = () => {
    const { user, driverProfile, isLoading, refreshProfile } = (0, AuthContext_1.useAuth)();
    // Refresh profile on mount to ensure we have latest data from database
    (0, react_1.useEffect)(() => {
        if (user && !isLoading) {
            // Always fetch fresh data from database on app launch
            refreshProfile();
        }
    }, [user, isLoading]);
    // Show loading while checking auth state or fetching profile
    if (isLoading) {
        return (<react_native_1.View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#22C55E' }}>
        <react_native_1.ActivityIndicator size="large" color="#ffffff"/>
      </react_native_1.View>);
    }
    // Not signed in → sign in screen (everyone sees login first)
    if (!user) {
        return <expo_router_1.Redirect href="/sign-in"/>;
    }
    // Signed in but no driver profile → NEW driver, show onboarding form
    if (!driverProfile) {
        console.log('[DriverEntry] No driver profile found - redirecting to onboarding');
        return <expo_router_1.Redirect href="/onboarding/personal-info"/>;
    }
    // Driver profile exists - check verification status from DATABASE (single source of truth)
    const status = driverProfile.verification_status;
    console.log('[DriverEntry] Driver verification status:', status);
    if (status === 'approved') {
        // ✅ APPROVED driver → main app UI (tabs/home)
        console.log('[DriverEntry] Driver is APPROVED - showing main app');
        return <expo_router_1.Redirect href="/(tabs)/home"/>;
    }
    if (status === 'pending') {
        // ⏳ PENDING verification → show pending screen
        console.log('[DriverEntry] Driver is PENDING - showing verification pending');
        return <expo_router_1.Redirect href="/onboarding/verification-pending"/>;
    }
    if (status === 'rejected') {
        // ❌ REJECTED → show rejection screen with option to resubmit
        console.log('[DriverEntry] Driver is REJECTED - showing verification pending with rejection info');
        return <expo_router_1.Redirect href="/onboarding/verification-pending"/>;
    }
    // Default fallback for unknown status - treat as approved
    console.log('[DriverEntry] Unknown status, defaulting to home');
    return <expo_router_1.Redirect href="/(tabs)/home"/>;
};
exports.default = DriverEntry;
