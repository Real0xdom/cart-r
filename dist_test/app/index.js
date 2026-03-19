"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const expo_router_1 = require("expo-router");
const react_native_1 = require("react-native");
const AuthContext_1 = require("@/contexts/AuthContext");
const Page = () => {
    const { user, profile, isLoading } = (0, AuthContext_1.useAuth)();
    // Show loading while checking auth state
    if (isLoading) {
        return (<react_native_1.View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <react_native_1.ActivityIndicator size="large" color="#0286FF"/>
      </react_native_1.View>);
    }
    // If user is signed in, redirect based on role
    if (user && profile) {
        if (profile.role === 'admin') {
            return <expo_router_1.Redirect href="/(admin)/dashboard"/>;
        }
        else if (profile.role === 'driver') {
            return <expo_router_1.Redirect href="/(driver)/(tabs)/home"/>;
        }
        else {
            return <expo_router_1.Redirect href="/(customer)/(tabs)/home"/>;
        }
    }
    // If not signed in, go to welcome screen
    return <expo_router_1.Redirect href="/(auth)/welcome"/>;
};
exports.default = Page;
