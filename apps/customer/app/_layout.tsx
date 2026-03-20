import { useFonts } from "expo-font";
import { Stack, router } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import "react-native-reanimated";
import { LogBox } from "react-native";

import { AuthProvider } from "@/contexts/AuthContext";
import { LocationProvider } from "@/contexts/LocationContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import NetworkBanner from "@/components/NetworkBanner";

import {
  initializeNotifications,
  requestNotificationPermissions,
  showNotificationDeniedAlert,
  addNotificationReceivedListener,
  addNotificationResponseListener,
  parseNotificationData,
} from "@/lib/notifications";
import { checkBatterySaverAndWarn } from "@/lib/batterySaver";

SplashScreen.preventAutoHideAsync();
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

  useEffect(() => {
    if (!loaded) {
      return;
    }

    SplashScreen.hideAsync();
    let notificationReceivedSubscription: any;
    let notificationResponseSubscription: any;

    try {
      void initializeNotifications();
      requestNotificationPermissions().then((granted) => {
        if (!granted) {
          showNotificationDeniedAlert();
        }
      });

      notificationReceivedSubscription = addNotificationReceivedListener((notification) => {
        console.log('[RootLayout] Notification received:', notification.request.content.title);
      });

      notificationResponseSubscription = addNotificationResponseListener((response) => {
        console.log('[RootLayout] Notification tapped:', response.notification.request.content.title);
        const data = parseNotificationData(response.notification);
        if (!data?.bookingId) {
          return;
        }

        if (data.status === 'completed') {
          router.push({
            pathname: '/ride-details/[id]',
            params: { id: data.bookingId },
          });
          return;
        }

        router.push({
          pathname: '/track-ride',
          params: { bookingId: data.bookingId },
        });
      });
    } catch (e) {
      console.warn('Error initializing notifications:', e);
    }

    checkBatterySaverAndWarn();

    return () => {
      notificationReceivedSubscription?.remove?.();
      notificationResponseSubscription?.remove?.();
    };
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <LanguageProvider>
      <LocationProvider>
        <AuthProvider>
          <NetworkBanner />
          <Stack>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="welcome" options={{ headerShown: false }} />
            <Stack.Screen name="sign-in" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false, gestureEnabled: false }} />
            <Stack.Screen name="(stack)" options={{ headerShown: false }} />
            <Stack.Screen name="ride-details/[id]" options={{ headerShown: false }} />
            <Stack.Screen name="find-ride" options={{ headerShown: false }} />
            <Stack.Screen name="receiver-details" options={{ headerShown: false }} />
            <Stack.Screen name="select-vehicle" options={{ headerShown: false }} />
            <Stack.Screen name="review-booking" options={{ headerShown: false }} />
            <Stack.Screen name="confirm-ride" options={{ headerShown: false }} />
            <Stack.Screen name="book-ride" options={{ headerShown: false }} />
            <Stack.Screen name="profile-details" options={{ headerShown: false }} />
            <Stack.Screen name="saved-addresses" options={{ headerShown: false }} />
            <Stack.Screen name="terms" options={{ headerShown: false }} />
            <Stack.Screen name="help" options={{ headerShown: false }} />
            <Stack.Screen name="waiting-for-driver" options={{ headerShown: false, gestureEnabled: false }} />
            <Stack.Screen name="track-ride" options={{ headerShown: false, gestureEnabled: false }} />
            <Stack.Screen name="pay-booking" options={{ headerShown: false, gestureEnabled: false }} />
            <Stack.Screen name="+not-found" />
          </Stack>
        </AuthProvider>
      </LocationProvider>
    </LanguageProvider>
  );
}
