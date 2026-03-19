import { Stack } from 'expo-router';
import { useLanguage } from '@/contexts/LanguageContext';

export default function ProfileLayout() {
  const { t } = useLanguage();
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen 
        name="vehicle" 
        options={{ 
          headerShown: true,
          headerTitle: t('vehicleDetails'),
          headerStyle: { backgroundColor: '#ffffff' },
          headerTintColor: '#111827',
          headerTitleStyle: { fontFamily: 'Jakarta-Bold' }
        }} 
      />
      <Stack.Screen 
        name="documents" 
        options={{ 
          headerShown: true, 
          headerTitle: t('myDocuments'),
          headerStyle: { backgroundColor: '#ffffff' },
          headerTintColor: '#111827',
          headerTitleStyle: { fontFamily: 'Jakarta-Bold' }
        }} 
      />
      <Stack.Screen 
        name="bank" 
        options={{ 
          headerShown: true, 
          headerTitle: t('bankAndPayouts'),
          headerStyle: { backgroundColor: '#ffffff' },
          headerTintColor: '#111827',
          headerTitleStyle: { fontFamily: 'Jakarta-Bold' }
        }} 
      />
      <Stack.Screen 
        name="support" 
        options={{ 
          headerShown: true, 
          headerTitle: t('helpSupport'),
          headerStyle: { backgroundColor: '#ffffff' },
          headerTintColor: '#111827',
          headerTitleStyle: { fontFamily: 'Jakarta-Bold' }
        }} 
      />
      <Stack.Screen 
        name="reviews" 
        options={{ 
          headerShown: true, 
          headerTitle: t('ratingsReviews'),
          headerStyle: { backgroundColor: '#ffffff' },
          headerTintColor: '#111827',
          headerTitleStyle: { fontFamily: 'Jakarta-Bold' }
        }} 
      />
      <Stack.Screen 
        name="notifications" 
        options={{ 
          headerShown: true, 
          headerTitle: t('notifications'),
          headerStyle: { backgroundColor: '#ffffff' },
          headerTintColor: '#111827',
          headerTitleStyle: { fontFamily: 'Jakarta-Bold' }
        }} 
      />
       <Stack.Screen 
         name="terms" 
         options={{ 
           headerShown: false
         }} 
       />
       <Stack.Screen 
         name="faq" 
         options={{ 
           headerShown: false
         }} 
       />
    </Stack>
  );
}
