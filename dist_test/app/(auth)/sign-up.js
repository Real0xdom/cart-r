"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const expo_router_1 = require("expo-router");
// Legacy sign-up page - redirect to welcome screen
const SignUp = () => {
    return <expo_router_1.Redirect href="/(auth)/welcome"/>;
};
exports.default = SignUp;
