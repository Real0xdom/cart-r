"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ProfileLayout;
const expo_router_1 = require("expo-router");
function ProfileLayout() {
    return (<expo_router_1.Stack screenOptions={{ headerShown: false }}>
      <expo_router_1.Stack.Screen name="index"/>
      <expo_router_1.Stack.Screen name="vehicle" options={{
            headerShown: true,
            headerTitle: 'Vehicle Details',
            headerStyle: { backgroundColor: '#111827' },
            headerTintColor: '#fff',
            headerTitleStyle: { fontFamily: 'Jakarta-Bold' }
        }}/>
      <expo_router_1.Stack.Screen name="documents" options={{
            headerShown: true,
            headerTitle: 'My Documents',
            headerStyle: { backgroundColor: '#111827' },
            headerTintColor: '#fff',
            headerTitleStyle: { fontFamily: 'Jakarta-Bold' }
        }}/>
      <expo_router_1.Stack.Screen name="bank" options={{
            headerShown: true,
            headerTitle: 'Bank & Payouts',
            headerStyle: { backgroundColor: '#111827' },
            headerTintColor: '#fff',
            headerTitleStyle: { fontFamily: 'Jakarta-Bold' }
        }}/>
      <expo_router_1.Stack.Screen name="support" options={{
            headerShown: true,
            headerTitle: 'Help & Support',
            headerStyle: { backgroundColor: '#111827' },
            headerTintColor: '#fff',
            headerTitleStyle: { fontFamily: 'Jakarta-Bold' }
        }}/>
      <expo_router_1.Stack.Screen name="reviews" options={{
            headerShown: true,
            headerTitle: 'Ratings & Reviews',
            headerStyle: { backgroundColor: '#111827' },
            headerTintColor: '#fff',
            headerTitleStyle: { fontFamily: 'Jakarta-Bold' }
        }}/>
      <expo_router_1.Stack.Screen name="notifications" options={{
            headerShown: true,
            headerTitle: 'Notifications',
            headerStyle: { backgroundColor: '#111827' },
            headerTintColor: '#fff',
            headerTitleStyle: { fontFamily: 'Jakarta-Bold' }
        }}/>
    </expo_router_1.Stack>);
}
