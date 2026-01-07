import { Stack } from 'expo-router';

export default function ProfileLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen 
        name="vehicle" 
        options={{ 
          headerShown: true,
          headerTitle: 'Vehicle Details',
          headerStyle: { backgroundColor: '#111827' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontFamily: 'Jakarta-Bold' }
        }} 
      />
      <Stack.Screen 
        name="documents" 
        options={{ 
          headerShown: true, 
          headerTitle: 'My Documents',
          headerStyle: { backgroundColor: '#111827' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontFamily: 'Jakarta-Bold' }
        }} 
      />
      <Stack.Screen 
        name="bank" 
        options={{ 
          headerShown: true, 
          headerTitle: 'Bank & Payouts',
          headerStyle: { backgroundColor: '#111827' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontFamily: 'Jakarta-Bold' }
        }} 
      />
      <Stack.Screen 
        name="support" 
        options={{ 
          headerShown: true, 
          headerTitle: 'Help & Support',
          headerStyle: { backgroundColor: '#111827' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontFamily: 'Jakarta-Bold' }
        }} 
      />
      <Stack.Screen 
        name="reviews" 
        options={{ 
          headerShown: true, 
          headerTitle: 'Ratings & Reviews',
          headerStyle: { backgroundColor: '#111827' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontFamily: 'Jakarta-Bold' }
        }} 
      />
      <Stack.Screen 
        name="notifications" 
        options={{ 
          headerShown: true, 
          headerTitle: 'Notifications',
          headerStyle: { backgroundColor: '#111827' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontFamily: 'Jakarta-Bold' }
        }} 
      />
    </Stack>
  );
}
