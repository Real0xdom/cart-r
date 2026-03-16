import { ExpoConfig, ConfigContext } from 'expo/config';
import fs from 'fs';
import path from 'path';

export default ({ config }: ConfigContext): ExpoConfig => ({
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
    backgroundColor: "#31502d"
  },
  notification: {
    icon: "./assets/images/notification-icon.png",
    color: "#4CAF50"
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
      "android.permission.ACCESS_FINE_LOCATION",
      "VIBRATE",
      "WAKE_LOCK"
    ],
    // Only add google-services.json if it exists to avoid build errors
    ...(fs.existsSync(path.join(__dirname, "google-services.json")) 
      ? { googleServicesFile: "./google-services.json" } 
      : {}),
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
    ],
    "expo-notifications"
  ],
  experiments: {
    typedRoutes: true
  },
  extra: {
    router: {
      "origin": "https://cart-r.com/"
    },
    eas: {
      "projectId": "b9192aff-c534-4495-aac5-d2fe15a2a92f"
    }
  },
  owner: "amycarter192"
});
