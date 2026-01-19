"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const expo_router_1 = require("expo-router");
const react_native_1 = require("react-native");
const AuthContext_1 = require("@/contexts/AuthContext");
const CustomerEntry = () => {
    const { user, profile, isLoading } = (0, AuthContext_1.useAuth)();
    // Show loading while checking auth state - CartR branded
    if (isLoading) {
        return (<react_native_1.View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#4CAF50' }}>
        <react_native_1.Image source={require('@/assets/splash-logo.png')} style={{ width: 200, height: 200, marginBottom: 20 }} resizeMode="contain"/>
        <react_native_1.ActivityIndicator size="large" color="#ffffff"/>
      </react_native_1.View>);
    }
    // If user is signed in, go to home
    if (user && profile) {
        return <expo_router_1.Redirect href="/(tabs)/home"/>;
    }
    // If not signed in, go to sign-in screen directly
    return <expo_router_1.Redirect href="/sign-in"/>;
};
exports.default = CustomerEntry;
