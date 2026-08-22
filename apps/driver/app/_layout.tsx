import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import "react-native-reanimated";
import { LogBox } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { AuthProvider } from "@/contexts/AuthContext";
import { RideNotificationProvider } from "@/contexts/RideNotificationContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import NetworkBanner from "@/components/NetworkBanner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient();

import { 
  setupNotificationChannels, 
  requestNotificationPermissions,
  addNotificationReceivedListener,
  addNotificationResponseListener 
} from "@/lib/notifications";

// Prevent the splash screen from auto-hiding before asset loading is complete.
void SplashScreen.preventAutoHideAsync().catch((error) => {
  console.warn("[RootLayout] Failed to prevent splash auto hide:", error);
});

// Ignore specific warnings
LogBox.ignoreLogs([
  "Supabase:",
  "Warning:",
  "[Layout children]", // Expo router warning about nested routes
]);

// No global notifications overlay as we use system-level Notifee requests now

export default function RootLayout() {
  const [loaded, fontError] = useFonts({
    "Jakarta-Bold": require("../assets/fonts/PlusJakartaSans-Bold.ttf"),
    "Jakarta-ExtraBold": require("../assets/fonts/PlusJakartaSans-ExtraBold.ttf"),
    "Jakarta-ExtraLight": require("../assets/fonts/PlusJakartaSans-ExtraLight.ttf"),
    "Jakarta-Light": require("../assets/fonts/PlusJakartaSans-Light.ttf"),
    "Jakarta-Medium": require("../assets/fonts/PlusJakartaSans-Medium.ttf"),
    Jakarta: require("../assets/fonts/PlusJakartaSans-Regular.ttf"),
    "Jakarta-SemiBold": require("../assets/fonts/PlusJakartaSans-SemiBold.ttf"),
  });

  useEffect(() => {
    let isMounted = true;
    let notificationReceivedSubscription:
      | ReturnType<typeof addNotificationReceivedListener>
      | undefined;
    let notificationResponseSubscription:
      | ReturnType<typeof addNotificationResponseListener>
      | undefined;

    const bootstrap = async () => {
      if (!loaded && !fontError) {
        return;
      }

      if (fontError) {
        console.error("[RootLayout] Font loading failed:", fontError);
      }

      try {
        await SplashScreen.hideAsync();
      } catch (error) {
        console.warn("[RootLayout] Failed to hide splash screen:", error);
      }

      try {
        await setupNotificationChannels();
      } catch (error) {
        console.error("[RootLayout] Notification channel setup failed:", error);
      }

      try {
        await requestNotificationPermissions(true);
      } catch (error) {
        console.error("[RootLayout] Notification permission request failed:", error);
      }

      if (!isMounted) {
        return;
      }

      try {
        notificationReceivedSubscription = addNotificationReceivedListener((notification) => {
          console.log('📬 [Driver] Notification received:', notification.request.content.title);
        });

        notificationResponseSubscription = addNotificationResponseListener((response) => {
          console.log('👆 [Driver] Notification tapped:', response.notification.request.content.title);
        });
      } catch (error) {
        console.error("[RootLayout] Failed to attach notification listeners:", error);
      }
    };

    void bootstrap();

    return () => {
      isMounted = false;
      notificationReceivedSubscription?.remove?.();
      notificationResponseSubscription?.remove?.();
    };
  }, [loaded, fontError]);

  useEffect(() => {
    const fallbackTimer = setTimeout(() => {
      void SplashScreen.hideAsync().catch(() => {});
    }, 4000);

    return () => clearTimeout(fallbackTimer);
  }, []);

  if (!loaded && !fontError) {
    return null;
  }

  if (fontError) {
    console.warn("[RootLayout] Continuing without custom fonts.");
  }

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <LanguageProvider>
          <AuthProvider>
            <RideNotificationProvider>
              <NetworkBanner />
              <Stack>
                <Stack.Screen name="index" options={{ headerShown: false }} />
                <Stack.Screen name="sign-in" options={{ headerShown: false }} />
                <Stack.Screen
                  name="account-blocked"
                  options={{
                    headerShown: false,
                    presentation: "transparentModal",
                    animation: "fade",
                  }}
                />
                <Stack.Screen name="onboarding" options={{ headerShown: false }} />
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="profile" options={{ headerShown: false }} />
                <Stack.Screen name="ride/[id]" options={{ headerShown: true, headerTitle: 'Active Ride', headerStyle: { backgroundColor: "#ffffff" }, headerTintColor: "#111827", headerTitleStyle: { fontFamily: "Jakarta-Bold" } }} />
                <Stack.Screen name="ride/verify-otp" options={{ headerShown: false }} />
                <Stack.Screen name="ride/collect-payment" options={{ headerShown: false }} />
                <Stack.Screen name="ride/invoice" options={{ headerShown: false }} />
                <Stack.Screen name="ride/debug-sms" options={{ headerShown: false }} />
                <Stack.Screen
                  name="vehicle-info"
                  options={{
                    headerShown: true,
                    headerTitle: "Vehicle Details",
                    headerStyle: { backgroundColor: "#ffffff" },
                    headerTintColor: "#111827",
                    headerTitleStyle: { fontFamily: "Jakarta-Bold" },
                  }}
                />
                <Stack.Screen name="+not-found" />
              </Stack>
            </RideNotificationProvider>
          </AuthProvider>
        </LanguageProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
