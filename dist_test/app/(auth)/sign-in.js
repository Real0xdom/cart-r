"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const expo_router_1 = require("expo-router");
// Legacy sign-in page - redirect to welcome screen
const SignIn = () => {
    return <expo_router_1.Redirect href="/(auth)/welcome"/>;
};
exports.default = SignIn;
