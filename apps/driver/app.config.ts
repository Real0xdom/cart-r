import { ExpoConfig, ConfigContext } from 'expo/config';
import fs from 'fs';
import path from 'path';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "Cartr Driver",
  slug: "carter-driver",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "carter-driver",
  userInterfaceStyle: "automatic",
  splash: {
    image: "./assets/splash-logo.png",
    resizeMode: "contain",
    backgroundColor: "#355A31"
  },
  notification: {
    icon: "./assets/images/notification-icon.png",
    color: "#355A31"
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
      NSLocationAlwaysAndWhenInUseUsageDescription: "Cartr Driver needs your location to receive ride requests and navigate to pickups.",
      NSLocationWhenInUseUsageDescription: "Cartr Driver needs your location to receive ride requests."
    }
  },
  android: {
    jsEngine: "hermes",
    adaptiveIcon: {
      foregroundImage: "./assets/images/adaptive-icon.png",
      backgroundColor: "#355A31"
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
    // Resolve google-services.json — check project root first, then android/app fallback
    ...(() => {
      const rootPath = path.join(__dirname, "google-services.json");
      const androidAppPath = path.join(__dirname, "android", "app", "google-services.json");
      if (fs.existsSync(rootPath)) {
        return { googleServicesFile: "./google-services.json" };
      } else if (fs.existsSync(androidAppPath)) {
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
        "origin": "https://driver.cart-r.com/"
      }
    ],
    [
      "expo-location",
      {
        "locationAlwaysAndWhenInUsePermission": "Cartr Driver needs your location to receive ride requests and navigate to pickups.",
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
      "projectId": "2cd0761a-e158-47f2-b8d6-ae09d029a49a"
    }
  }
});
