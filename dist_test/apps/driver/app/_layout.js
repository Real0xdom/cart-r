"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = RootLayout;
const expo_font_1 = require("expo-font");
const expo_router_1 = require("expo-router");
const SplashScreen = __importStar(require("expo-splash-screen"));
const react_1 = require("react");
require("react-native-reanimated");
const react_native_1 = require("react-native");
const AuthContext_1 = require("@/contexts/AuthContext");
// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();
// Ignore specific warnings
react_native_1.LogBox.ignoreLogs([
    "Supabase:",
    "Warning:",
    "[Layout children]", // Expo router warning about nested routes
]);
function RootLayout() {
    const [loaded] = (0, expo_font_1.useFonts)({
        "Jakarta-Bold": require("../assets/fonts/PlusJakartaSans-Bold.ttf"),
        "Jakarta-ExtraBold": require("../assets/fonts/PlusJakartaSans-ExtraBold.ttf"),
        "Jakarta-ExtraLight": require("../assets/fonts/PlusJakartaSans-ExtraLight.ttf"),
        "Jakarta-Light": require("../assets/fonts/PlusJakartaSans-Light.ttf"),
        "Jakarta-Medium": require("../assets/fonts/PlusJakartaSans-Medium.ttf"),
        Jakarta: require("../assets/fonts/PlusJakartaSans-Regular.ttf"),
        "Jakarta-SemiBold": require("../assets/fonts/PlusJakartaSans-SemiBold.ttf"),
    });
    (0, react_1.useEffect)(() => {
        if (loaded) {
            SplashScreen.hideAsync();
        }
    }, [loaded]);
    if (!loaded) {
        return null;
    }
    return (<AuthContext_1.AuthProvider>
      <expo_router_1.Stack>
        <expo_router_1.Stack.Screen name="index" options={{ headerShown: false }}/>
        <expo_router_1.Stack.Screen name="sign-in" options={{ headerShown: false }}/>
        <expo_router_1.Stack.Screen name="onboarding" options={{ headerShown: false }}/>
        <expo_router_1.Stack.Screen name="(tabs)" options={{ headerShown: false }}/>
        <expo_router_1.Stack.Screen name="profile" options={{ headerShown: false }}/>
        <expo_router_1.Stack.Screen name="ride" options={{ headerShown: false }}/>
        <expo_router_1.Stack.Screen name="+not-found"/>
      </expo_router_1.Stack>
    </AuthContext_1.AuthProvider>);
}
