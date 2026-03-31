import { ExpoConfig, ConfigContext } from 'expo/config';
import fs from 'fs';
import path from 'path';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "Cartr",
  slug: "carter-customer",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "carter",
  userInterfaceStyle: "automatic",
  splash: {
    resizeMode: "contain",
    backgroundColor: "#21461E"
  },
  notification: {
    icon: "./assets/images/notification-icon.png",
    color: "#21461E"
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
      backgroundColor: "#21461E"
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
    // Resolve google-services.json from either the app root or an existing android/app folder.
    ...(() => {
      const rootPath = path.join(__dirname, "google-services.json");
      const androidAppPath = path.join(__dirname, "android", "app", "google-services.json");
      if (fs.existsSync(rootPath)) {
        return { googleServicesFile: "./google-services.json" };
      }
      if (fs.existsSync(androidAppPath)) {
        return { googleServicesFile: "./android/app/google-services.json" };
      }
      return {};
    })(),
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
        "locationAlwaysAndWhenInUsePermission": "Cartr needs your location to show nearby drivers and track your deliveries."
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
      "projectId": "b57fca69-bf0c-441e-bd55-6b0933d76b7d"
    }
  },
  owner: "nanofi1189"
});
