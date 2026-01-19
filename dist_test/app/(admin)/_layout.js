"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const expo_router_1 = require("expo-router");
const AuthContext_1 = require("@/contexts/AuthContext");
const AdminLayout = () => {
    const { adminSession, isLoading } = (0, AuthContext_1.useAuth)();
    if (isLoading)
        return null;
    if (!adminSession) {
        return <expo_router_1.Redirect href="/(admin-auth)/login"/>;
    }
    return (<expo_router_1.Stack>
      <expo_router_1.Stack.Screen name="dashboard" options={{ headerShown: false }}/>
    </expo_router_1.Stack>);
};
exports.default = AdminLayout;
