import { ExpoConfig, ConfigContext } from 'expo/config';
import fs from 'fs';
import path from 'path';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "Carter Driver",
  slug: "carter-driver",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "carter-driver",
  userInterfaceStyle: "automatic",
  splash: {
    image: "./assets/splash-logo.png",
    resizeMode: "contain",
    backgroundColor: "#31502d"
  },
  notification: {
    icon: "./assets/images/notification-icon.png",
    color: "#22C55E"
  },
  ios: {
    supportsTablet: false,
    bundleIdentifier: "com.carter.driver",
    jsEngine: "hermes",
    config: {
      googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
    },
    infoPlist: {
      UIBackgroundModes: [
        "location",
        "fetch"
      ],
      NSLocationAlwaysAndWhenInUseUsageDescription: "Carter Driver needs your location to receive ride requests and navigate to pickups.",
      NSLocationWhenInUseUsageDescription: "Carter Driver needs your location to receive ride requests."
    }
  },
  android: {
    jsEngine: "hermes",
    adaptiveIcon: {
      foregroundImage: "./assets/images/adaptive-icon.png",
      backgroundColor: "#22C55E"
    },
    package: "com.carter.driver",
    config: {
      googleMaps: {
        apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
      }
    },
    permissions: [
      "ACCESS_FINE_LOCATION",
      "ACCESS_COARSE_LOCATION",
      "ACCESS_BACKGROUND_LOCATION",
      "FOREGROUND_SERVICE",
      "VIBRATE",
      "WAKE_LOCK",
      "USE_FULL_SCREEN_INTENT",
      "android.permission.ACCESS_COARSE_LOCATION",
      "android.permission.ACCESS_FINE_LOCATION",
      "android.permission.ACCESS_BACKGROUND_LOCATION",
      "android.permission.FOREGROUND_SERVICE",
      "android.permission.FOREGROUND_SERVICE_LOCATION",
      "android.permission.WAKE_LOCK",
      "android.permission.USE_FULL_SCREEN_INTENT"
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
        "origin": "https://driver.cart-r.com/"
      }
    ],
    "@react-native-community/datetimepicker",
    [
      "expo-location",
      {
        "locationAlwaysAndWhenInUsePermission": "Carter Driver needs your location to receive ride requests and navigate to pickups.",
        "isAndroidBackgroundLocationEnabled": true
      }
    ],
    "expo-font",
    "expo-secure-store"
  ],
  experiments: {
    typedRoutes: true
  },
  extra: {
    router: {
      "origin": "https://driver.cart-r.com/"
    },
    eas: {
      "projectId": "11cd06f0-40e0-4bd3-8166-f913e65dd2d6"
    }
  },
  owner: "amycarter192"
});
