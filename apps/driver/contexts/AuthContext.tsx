import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import 'react-native-get-random-values';

import { supabase } from '@/lib/supabase';
import { Database } from '@/lib/database.types';

type UserProfile = Database['public']['Tables']['users']['Row'];
type DriverProfile = Database['public']['Tables']['drivers']['Row'];

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  driverProfile: DriverProfile | null;
  isLoading: boolean;
  signUp: (email: string, password: string, name: string, phone?: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithPhone: (phone: string) => Promise<{ error: Error | null }>;
  signInWithWhatsApp: (phone: string) => Promise<{ error: Error | null }>;
  verifyOtp: (phone: string, token: string) => Promise<{ error: Error | null; data?: { user: User | null; session: Session | null } }>;
  verifyWhatsAppOtp: (phone: string, token: string, targetRole: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  toggleDriverOnline: (isOnline: boolean) => Promise<void>;
  updateDriverLocation: (latitude: number, longitude: number) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Session storage keys
const FAST2SMS_USER_KEY = '@fast2sms_user_driver';
const FAST2SMS_SESSION_KEY = '@fast2sms_session_driver';
const FAST2SMS_PROFILE_KEY = '@fast2sms_profile_driver';
const FAST2SMS_DRIVER_PROFILE_KEY = '@fast2sms_driver_profile';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [driverProfile, setDriverProfile] = useState<DriverProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load session from storage on mount
  useEffect(() => {
    loadStoredSession();
  }, []);

  const loadStoredSession = async () => {
    try {
      const [storedUser, storedSession, storedProfile, storedDriverProfile] = await Promise.all([
        AsyncStorage.getItem(FAST2SMS_USER_KEY),
        AsyncStorage.getItem(FAST2SMS_SESSION_KEY),
        AsyncStorage.getItem(FAST2SMS_PROFILE_KEY),
        AsyncStorage.getItem(FAST2SMS_DRIVER_PROFILE_KEY),
      ]);

      if (storedUser && storedSession) {
        setUser(JSON.parse(storedUser));
        setSession(JSON.parse(storedSession));
        if (storedProfile) {
          setProfile(JSON.parse(storedProfile));
        }
        if (storedDriverProfile) {
          setDriverProfile(JSON.parse(storedDriverProfile));
        }
      }
    } catch (error) {
      console.error('Error loading session:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveSession = async (
    userData: User,
    sessionData: Session,
    profileData: UserProfile,
    driverData?: DriverProfile
  ) => {
    try {
      await Promise.all([
        AsyncStorage.setItem(FAST2SMS_USER_KEY, JSON.stringify(userData)),
        AsyncStorage.setItem(FAST2SMS_SESSION_KEY, JSON.stringify(sessionData)),
        AsyncStorage.setItem(FAST2SMS_PROFILE_KEY, JSON.stringify(profileData)),
        driverData ? AsyncStorage.setItem(FAST2SMS_DRIVER_PROFILE_KEY, JSON.stringify(driverData)) : Promise.resolve(),
      ]);
    } catch (error) {
      console.error('Error saving session:', error);
    }
  };

  const clearSession = async () => {
    try {
      await Promise.all([
        AsyncStorage.removeItem(FAST2SMS_USER_KEY),
        AsyncStorage.removeItem(FAST2SMS_SESSION_KEY),
        AsyncStorage.removeItem(FAST2SMS_PROFILE_KEY),
        AsyncStorage.removeItem(FAST2SMS_DRIVER_PROFILE_KEY),
      ]);
    } catch (error) {
      console.error('Error clearing session:', error);
    }
  };

  // Fetch user profile from database
  const fetchProfile = async (userId: string) => {
    try {
      // Fetch user profile
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (!userError && userData) {
        setProfile(userData);
      }

      // Always try to fetch driver profile in the driver app
      const { data: driverData, error: driverError } = await supabase
        .from('drivers')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (!driverError && driverData) {
        setDriverProfile(driverData);
      } else {
        setDriverProfile(null);
      }

      return { userData, driverData };
    } catch (error) {
      console.error('Error fetching profile:', error);
      return { userData: null, driverData: null };
    }
  };

  // [G4] Realtime sync for driver profile
  useEffect(() => {
    if (!driverProfile?.id) return;

    const channel = supabase
      .channel(`driver-profile-sync-${driverProfile.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'drivers',
          filter: `id=eq.${driverProfile.id}`,
        },
        (payload) => {
          console.log('[AUTH] Driver profile updated remotely - syncing:', payload.new);
          setDriverProfile((prev: DriverProfile | null) => prev ? { ...prev, ...payload.new } : prev);
          // Update storage
          AsyncStorage.setItem(FAST2SMS_DRIVER_PROFILE_KEY, JSON.stringify({ ...driverProfile, ...payload.new }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [driverProfile?.id]);

  // Sign up with email/password (kept for compatibility)
  const signUp = async (email: string, password: string, name: string, phone?: string) => {
    try {
      const { error: profileError } = await supabase.from('users').insert({
        email,
        name,
        phone: phone || null,
        role: 'driver',
      });

      if (profileError) throw profileError;

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  // Sign in with email/password (kept for compatibility)
  const signIn = async (email: string, password: string) => {
    try {
      // Find user by email
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single();

      if (userError || !userData) {
        throw new Error('User not found');
      }

      // Fetch driver profile
      const { data: driverData } = await supabase
        .from('drivers')
        .select('*')
        .eq('user_id', userData.id)
        .maybeSingle();

      // Create mock session
      const mockUser = {
        id: userData.id,
        email: userData.email,
        phone: userData.phone,
        user_metadata: { name: userData.name },
        app_metadata: {},
        aud: 'authenticated',
        created_at: new Date().toISOString(),
      } as unknown as User;

      const mockSession = {
        user: mockUser,
        access_token: 'fast2sms-session',
        refresh_token: 'fast2sms-refresh',
        expires_in: 3600,
        token_type: 'bearer',
      } as unknown as Session;

      setUser(mockUser);
      setSession(mockSession);
      setProfile(userData);
      if (driverData) {
        setDriverProfile(driverData);
      }
      await saveSession(mockUser, mockSession, userData, driverData || undefined);

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  // Sign in with phone (OTP) using Supabase Auth
  const signInWithPhone = async (phone: string) => {
    try {
      const { error } = await supabase.auth.signInWithOtp({
        phone: phone.trim(),
      });

      if (error) throw error;
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  // Verify OTP using Supabase Auth
  const verifyOtp = async (phone: string, token: string) => {
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        phone: phone.trim(),
        token: token.replace(/\D/g, ''),
        type: 'sms',
      });

      if (error) throw error;
      if (!data.user || !data.session) {
        throw new Error('Failed to create session');
      }

      // Fetch profile and driver data
      const { userData, driverData } = await fetchProfile(data.user.id);

      setUser(data.user);
      setSession(data.session);
      if (userData) setProfile(userData);
      if (driverData) setDriverProfile(driverData);

      // Still save to AsyncStorage for backwards compatibility with the existing load logic
      await saveSession(
        data.user,
        data.session,
        userData || ({} as UserProfile),
        driverData || undefined
      );

      console.log('[AuthContext] OTP Verified Successfully');
      return { error: null, data: { user: data.user, session: data.session } };
    } catch (error) {
      console.error('[AuthContext] verifyOtp failed with error:', error);
      return { error: error as Error };
    }
  };

  // Sign in with WhatsApp/Phone (alias for signInWithPhone)
  const signInWithWhatsApp = async (phone: string) => {
    return signInWithPhone(phone);
  };

  // Verify WhatsApp/Phone OTP with role-based navigation
  const verifyWhatsAppOtp = async (phone: string, token: string, targetRole: string) => {
    return verifyOtp(phone, token);
  };

  // Sign out
  const signOut = async () => {
    await clearSession();
    setUser(null);
    setSession(null);
    setProfile(null);
    setDriverProfile(null);
    router.replace('/');
  };

  // Refresh profile
  const refreshProfile = async () => {
    if (user?.id) {
      const { userData, driverData } = await fetchProfile(user.id);
      if (userData) {
        await AsyncStorage.setItem(FAST2SMS_PROFILE_KEY, JSON.stringify(userData));
      }
      if (driverData) {
        await AsyncStorage.setItem(FAST2SMS_DRIVER_PROFILE_KEY, JSON.stringify(driverData));
      }
    }
  };

  // Toggle driver online status
  const toggleDriverOnline = async (isOnline: boolean) => {
    if (!driverProfile) return;

    try {
      const { error } = await supabase
        .from('drivers')
        .update({ is_online: isOnline })
        .eq('id', driverProfile.id);

      if (error) throw error;

      setDriverProfile({ ...driverProfile, is_online: isOnline });
    } catch (error) {
      console.error('Error toggling online status:', error);
    }
  };

  // Update driver location
  const updateDriverLocation = async (latitude: number, longitude: number) => {
    if (!driverProfile) return;

    try {
      const { error } = await supabase
        .from('drivers')
        .update({
          current_latitude: latitude,
          current_longitude: longitude,
          last_location_update: new Date().toISOString(),
        })
        .eq('id', driverProfile.id);

      if (error) throw error;

      // Also log to driver_locations table for history
      await supabase.from('driver_locations').insert({
        driver_id: driverProfile.id,
        latitude,
        longitude,
      });
    } catch (error) {
      console.error('Error updating location:', error);
    }
  };

  const value: AuthContextType = {
    user,
    session,
    profile,
    driverProfile,
    isLoading,
    signUp,
    signIn,
    signInWithPhone,
    signInWithWhatsApp,
    verifyOtp,
    verifyWhatsAppOtp,
    signOut,
    refreshProfile,
    toggleDriverOnline,
    updateDriverLocation,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
