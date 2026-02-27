import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import "react-native-reanimated";
import { LogBox } from "react-native";

import { AuthProvider } from "@/contexts/AuthContext";
import { RideNotificationProvider } from "@/contexts/RideNotificationContext";
import { LanguageProvider } from "@/contexts/LanguageContext";

import { 
  setupNotificationChannels, 
  requestNotificationPermissions,
  addNotificationReceivedListener,
  addNotificationResponseListener 
} from "@/lib/notifications";

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

// Ignore specific warnings
LogBox.ignoreLogs([
  "Supabase:",
  "Warning:",
  "[Layout children]", // Expo router warning about nested routes
]);

// No global notifications overlay as we use system-level Notifee requests now

export default function RootLayout() {
  const [loaded] = useFonts({
    "Jakarta-Bold": require("../assets/fonts/PlusJakartaSans-Bold.ttf"),
    "Jakarta-ExtraBold": require("../assets/fonts/PlusJakartaSans-ExtraBold.ttf"),
    "Jakarta-ExtraLight": require("../assets/fonts/PlusJakartaSans-ExtraLight.ttf"),
    "Jakarta-Light": require("../assets/fonts/PlusJakartaSans-Light.ttf"),
    "Jakarta-Medium": require("../assets/fonts/PlusJakartaSans-Medium.ttf"),
    Jakarta: require("../assets/fonts/PlusJakartaSans-Regular.ttf"),
    "Jakarta-SemiBold": require("../assets/fonts/PlusJakartaSans-SemiBold.ttf"),
  });

  useEffect(() => {
    if (loaded) {
      // Setup notification channels
      setupNotificationChannels();
      // Check and request permissions
      requestNotificationPermissions(true);

      // Setup notification listeners
      const notificationReceivedSubscription = addNotificationReceivedListener((notification) => {
        console.log('📬 [Driver] Notification received:', notification.request.content.title);
      });

      const notificationResponseSubscription = addNotificationResponseListener((response) => {
        console.log('👆 [Driver] Notification tapped:', response.notification.request.content.title);
      });

      SplashScreen.hideAsync();

      return () => {
        notificationReceivedSubscription?.remove?.();
        notificationResponseSubscription?.remove?.();
      };
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <LanguageProvider>
      <AuthProvider>
        <RideNotificationProvider>
          <Stack>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="sign-in" options={{ headerShown: false }} />
            <Stack.Screen name="onboarding" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="profile" options={{ headerShown: false }} />
            <Stack.Screen name="+not-found" />
          </Stack>
        </RideNotificationProvider>
      </AuthProvider>
    </LanguageProvider>
  );
}
