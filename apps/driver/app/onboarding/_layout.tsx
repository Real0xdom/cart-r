import { Stack } from "expo-router";

export default function OnboardingLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="personal-info"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="vehicle-info"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="documents"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="verification-pending"
        options={{
          headerShown: false,
          gestureEnabled: false, // Prevent going back
        }}
      />
    </Stack>
  );
}
