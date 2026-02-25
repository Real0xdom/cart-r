import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import "react-native-reanimated";
import { LogBox } from "react-native";

import { AuthProvider } from "@/contexts/AuthContext";
import { LocationProvider } from "@/contexts/LocationContext";
import { LanguageProvider } from "@/contexts/LanguageContext";

import { 
  initializeNotifications, 
  requestNotificationPermissions,
  addNotificationReceivedListener,
  addNotificationResponseListener 
} from "@/lib/notifications";

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

// Ignore specific warnings
LogBox.ignoreLogs(["Supabase:", "Warning:"]);

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
  console.log('[SplashDebug] useFonts loaded:', loaded);

  useEffect(() => {
    if (loaded) {
      console.log('[SplashDebug] Fonts loaded, hiding splash screen.');
      // Hide splash screen immediately when fonts are loaded
      SplashScreen.hideAsync();
      // Setup notifications
      let notificationReceivedSubscription: any;
      let notificationResponseSubscription: any;
      try {
        initializeNotifications();
        requestNotificationPermissions();
        // Setup notification listeners
        notificationReceivedSubscription = addNotificationReceivedListener((notification) => {
          console.log('📬 [RootLayout] Notification received:', notification.request.content.title);
        });
        notificationResponseSubscription = addNotificationResponseListener((response) => {
          console.log('👆 [RootLayout] Notification tapped:', response.notification.request.content.title);
        });
      } catch (e) {
        console.warn('Error initializing notifications:', e);
      }
      return () => {
        notificationReceivedSubscription?.remove?.();
        notificationResponseSubscription?.remove?.();
      };
    } else {
      console.log('[SplashDebug] Fonts not loaded yet.');
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <LanguageProvider>
      <LocationProvider>
        <AuthProvider>
          <Stack>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="welcome" options={{ headerShown: false }} />
            <Stack.Screen name="sign-in" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false, gestureEnabled: false }} />
            <Stack.Screen name="find-ride" options={{ headerShown: false }} />
            <Stack.Screen name="receiver-details" options={{ headerShown: false }} />
            <Stack.Screen name="select-vehicle" options={{ headerShown: false }} />
            <Stack.Screen name="confirm-ride" options={{ headerShown: false }} />
            <Stack.Screen name="book-ride" options={{ headerShown: false }} />
            <Stack.Screen name="profile-details" options={{ headerShown: false }} />
            <Stack.Screen name="saved-addresses" options={{ headerShown: false }} />
            <Stack.Screen name="terms" options={{ headerShown: false }} />
            <Stack.Screen name="help" options={{ headerShown: false }} />
            <Stack.Screen name="+not-found" />
          </Stack>
        </AuthProvider>
      </LocationProvider>
    </LanguageProvider>
  );
}
