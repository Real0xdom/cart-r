"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const expo_router_1 = require("expo-router");
const Layout = () => {
    return (<expo_router_1.Stack>
      <expo_router_1.Stack.Screen name="welcome" options={{ headerShown: false }}/>
      <expo_router_1.Stack.Screen name="sign-up" options={{ headerShown: false }}/>
      <expo_router_1.Stack.Screen name="sign-in" options={{ headerShown: false }}/>
    </expo_router_1.Stack>);
};
exports.default = Layout;
