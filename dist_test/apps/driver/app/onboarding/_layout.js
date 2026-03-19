"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = OnboardingLayout;
const expo_router_1 = require("expo-router");
function OnboardingLayout() {
    return (<expo_router_1.Stack>
      <expo_router_1.Stack.Screen name="personal-info" options={{
            headerShown: false,
        }}/>
      <expo_router_1.Stack.Screen name="vehicle-info" options={{
            headerShown: false,
        }}/>
      <expo_router_1.Stack.Screen name="documents" options={{
            headerShown: false,
        }}/>
      <expo_router_1.Stack.Screen name="verification-pending" options={{
            headerShown: false,
            gestureEnabled: false, // Prevent going back
        }}/>
    </expo_router_1.Stack>);
}
