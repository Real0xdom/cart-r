"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ({ config }) => ({
    ...config,
    name: "Carter",
    slug: "carter-customer",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "carter",
    userInterfaceStyle: "automatic",
    splash: {
        image: "./assets/splash-logo.png",
        resizeMode: "contain",
        backgroundColor: "#4CAF50"
    },
    ios: {
        supportsTablet: true,
        bundleIdentifier: "com.carter.customer",
        config: {
            googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
        },
        // Required for UPI Intent (showing installed UPI apps) per Cashfree docs
        infoPlist: {
            LSApplicationQueriesSchemes: [
                "phonepe",
                "tez",
                "paytmmp",
                "bhim",
                "amazonpay",
                "credpay"
            ]
        }
    },
    android: {
        adaptiveIcon: {
            foregroundImage: "./assets/images/adaptive-icon.png",
            backgroundColor: "#ffffff"
        },
        package: "com.carter.customer",
        config: {
            googleMaps: {
                apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
            }
        },
        permissions: [
            "android.permission.ACCESS_COARSE_LOCATION",
            "android.permission.ACCESS_FINE_LOCATION"
        ]
    },
    web: {
        bundler: "metro",
        output: "static",
        favicon: "./assets/images/favicon.png"
    },
    plugins: [
        [
            "expo-router",
            {
                "origin": "https://cart-r.com/"
            }
        ],
        [
            "expo-location",
            {
                "locationAlwaysAndWhenInUsePermission": "Carter needs your location to show nearby drivers and track your deliveries."
            }
        ]
    ],
    experiments: {
        typedRoutes: true
    },
    extra: {
        router: {
            "origin": "https://cart-r.com/"
        },
        eas: {
            "projectId": "0bc2f79e-c11f-42ad-80c6-e3fa2d9e09b8"
        }
    }
});
