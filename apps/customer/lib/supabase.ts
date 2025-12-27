import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// Custom storage for Supabase auth using SecureStore
const ExpoSecureStoreAdapter = {
  getItem: async (key: string) => {
    if (Platform.OS === 'web') {
      return localStorage.getItem(key);
    }
    return await SecureStore.getItemAsync(key);
  },
  setItem: async (key: string, value: string) => {
    if (Platform.OS === 'web') {
      localStorage.setItem(key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value);
  },
  removeItem: async (key: string) => {
    if (Platform.OS === 'web') {
      localStorage.removeItem(key);
      return;
    }
    await SecureStore.deleteItemAsync(key);
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Database types (will be generated from schema later)
export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          name: string;
          phone: string | null;
          role: 'customer' | 'driver' | 'admin';
          avatar_url: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['users']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['users']['Insert']>;
      };
      drivers: {
        Row: {
          id: string;
          user_id: string;
          vehicle_type: 'bike' | 'auto' | 'mini' | 'sedan' | 'suv' | 'truck';
          vehicle_number: string;
          vehicle_model: string;
          vehicle_color: string | null;
          verification_status: 'pending' | 'approved' | 'rejected';
          is_online: boolean;
          current_latitude: number | null;
          current_longitude: number | null;
          rating: number;
          total_trips: number;
          total_earnings: number;
        };
        Insert: Omit<Database['public']['Tables']['drivers']['Row'], 'id' | 'rating' | 'total_trips' | 'total_earnings'>;
        Update: Partial<Database['public']['Tables']['drivers']['Insert']>;
      };
      bookings: {
        Row: {
          id: string;
          booking_number: string;
          customer_id: string;
          driver_id: string | null;
          origin_address: string;
          origin_latitude: number;
          origin_longitude: number;
          destination_address: string;
          destination_latitude: number;
          destination_longitude: number;
          vehicle_type: 'bike' | 'auto' | 'mini' | 'sedan' | 'suv' | 'truck';
          estimated_distance: number | null;
          estimated_duration: number | null;
          total_fare: number;
          payment_status: 'pending' | 'paid' | 'refunded';
          payment_method: 'cash' | 'online';
          status: 'pending' | 'accepted' | 'driver_arrived' | 'in_progress' | 'completed' | 'cancelled';
          pickup_otp: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['bookings']['Row']>;
        Update: Partial<Database['public']['Tables']['bookings']['Insert']>;
      };
    };
  };
};
