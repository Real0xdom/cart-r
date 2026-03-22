import * as Linking from "expo-linking";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import { supabase } from "@/lib/supabase";

// Token cache for secure storage
export const tokenCache = {
  async getToken(key: string) {
    try {
      if (Platform.OS === 'web') {
        return localStorage.getItem(key);
      }
      const item = await SecureStore.getItemAsync(key);
      return item;
    } catch (error) {
      console.error("SecureStore get item error: ", error);
      return null;
    }
  },
  async saveToken(key: string, value: string) {
    try {
      if (Platform.OS === 'web') {
        localStorage.setItem(key, value);
        return;
      }
      return SecureStore.setItemAsync(key, value);
    } catch (err) {
      console.error("SecureStore save item error: ", err);
    }
  },
  async removeToken(key: string) {
    try {
      if (Platform.OS === 'web') {
        localStorage.removeItem(key);
        return;
      }
      return SecureStore.deleteItemAsync(key);
    } catch (err) {
      console.error("SecureStore remove item error: ", err);
    }
  },
};

// Google OAuth with Supabase
export const googleOAuth = async () => {
  try {
    const redirectUrl = Linking.createURL("/(customer)/(tabs)/home");
    
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
      },
    });

    if (error) throw error;

    return {
      success: true,
      code: "success",
      message: "Redirecting to Google sign in...",
      url: data.url,
    };
  } catch (err: any) {
    console.error("Google OAuth error:", err);
    return {
      success: false,
      code: err?.code || "error",
      message: err?.message || "An error occurred while signing in with Google",
    };
  }
};

// Phone OTP login
export const sendPhoneOTP = async (phone: string) => {
  try {
    const { error } = await supabase.auth.signInWithOtp({
      phone,
      options: {
        data: {
          bypass_fast2sms: process.env.EXPO_PUBLIC_BYPASS_SMS === 'true'
        }
      }
    });

    if (error) throw error;

    return {
      success: true,
      message: "OTP sent successfully",
    };
  } catch (err: any) {
    console.error("Phone OTP error:", err);
    return {
      success: false,
      message: err?.message || "Failed to send OTP",
    };
  }
};

// Verify phone OTP
export const verifyPhoneOTP = async (phone: string, otp: string) => {
  try {
    const { data, error } = await supabase.auth.verifyOtp({
      phone,
      token: otp,
      type: 'sms',
    });

    if (error) throw error;

    return {
      success: true,
      user: data.user,
      session: data.session,
    };
  } catch (err: any) {
    console.error("Verify OTP error:", err);
    return {
      success: false,
      message: err?.message || "Invalid OTP",
    };
  }
};

// Generate booking OTP (for pickup verification)
export const generateBookingOTP = (): string => {
  // Use crypto.getRandomValues if available (web/browser), fallback to Math.random for React Native
  let randomValue: number;
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    randomValue = array[0];
  } else {
    // Fallback for React Native (crypto not available)
    randomValue = Math.floor(Math.random() * 9000);
  }
  return (1000 + (randomValue % 9000)).toString();
};

