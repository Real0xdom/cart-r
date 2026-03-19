import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { router } from 'expo-router';

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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [driverProfile, setDriverProfile] = useState<DriverProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch user profile from database
  const fetchProfile = async (userId: string) => {
    try {
      // Fetch user profile (might not exist for new phone auth users)
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
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  // Initialize auth state
  useEffect(() => {
    // Get initial session
    const initializeAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        // Handle invalid refresh token by signing out
        if (error) {
          console.warn('Session error, signing out:', error.message);
          await supabase.auth.signOut();
          setSession(null);
          setUser(null);
          setIsLoading(false);
          return;
        }
        
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchProfile(session.user.id);
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        // Clear any invalid session
        await supabase.auth.signOut();
        setSession(null);
        setUser(null);
      }
      setIsLoading(false);
    };
    
    initializeAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          await fetchProfile(session.user.id);
          // Register push token with retries
          import('@/lib/notifications').then(async ({ registerPushToken }) => {
            let attempts = 0;
            const maxAttempts = 3;
            
            while (attempts < maxAttempts) {
              try {
                const success = await registerPushToken(supabase, session.user.id);
                if (success) {
                  console.log('✅ Push token registered after attempt', attempts + 1);
                  break;
                }
              } catch (err) {
                console.warn(`Attempt ${attempts + 1}/${maxAttempts} failed:`, err);
              }
              
              attempts++;
              if (attempts < maxAttempts) {
                // Wait before retrying (2 seconds, then 5 seconds)
                await new Promise(resolve => 
                  setTimeout(resolve, attempts === 1 ? 2000 : 5000)
                );
                console.log(`Retrying push token registration (${attempts}/${maxAttempts})...`);
              }
            }
            
            if (attempts === maxAttempts) {
              console.error('❌ Failed to register push token after 3 attempts');
            }
          });
        } else {
          setProfile(null);
          setDriverProfile(null);
        }

        // Handle navigation based on auth state
        if (event === 'SIGNED_IN') {
          // Will navigate based on role in the calling component
        } else if (event === 'SIGNED_OUT') {
          router.replace('/');
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // [G4] Realtime sync for driver profile — keeps is_online and verification_status
  // up to date across devices and reflects admin overrides (suspend, force-offline) immediately.
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
          console.log('[AUTH] Driver profile updated remotely — syncing:', payload.new);
          setDriverProfile((prev: DriverProfile | null) => prev ? { ...prev, ...payload.new } : prev);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [driverProfile?.id]);

  // Sign up with email/password
  const signUp = async (email: string, password: string, name: string, phone?: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name, phone },
        },
      });

      if (error) throw error;

      // Create user profile in database
      if (data.user) {
        const { error: profileError } = await supabase.from('users').insert({
          id: data.user.id,
          email,
          name,
          phone: phone || null,
          role: 'customer', // Default role
        });

        if (profileError) throw profileError;
      }

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  // Sign in with email/password
  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  // Sign in with phone (OTP)
  const signInWithPhone = async (phone: string) => {
    try {
      const { error } = await supabase.auth.signInWithOtp({
        phone,
      });

      if (error) throw error;
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  // Verify OTP
  const verifyOtp = async (phone: string, token: string) => {
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        phone,
        token,
        type: 'sms',
      });

      if (error) throw error;
      return { error: null, data };
    } catch (error) {
      return { error: error as Error };
    }
  };

  // Sign in with WhatsApp/Phone (alias for signInWithPhone)
  const signInWithWhatsApp = async (phone: string) => {
    return signInWithPhone(phone);
  };

  // Verify WhatsApp/Phone OTP with role-based navigation
  const verifyWhatsAppOtp = async (phone: string, token: string, targetRole: string) => {
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        phone,
        token,
        type: 'sms',
      });

      if (error) throw error;

      // Check if user profile exists
      if (data.user) {
        const { data: existingProfile } = await supabase
          .from('users')
          .select('*')
          .eq('id', data.user.id)
          .single();

        // Create profile if it doesn't exist
        if (!existingProfile) {
          await supabase.from('users').insert({
            id: data.user.id,
            email: data.user.email || `${phone}@phone.carter.app`,
            name: 'Carter User',
            phone,
            role: targetRole as 'customer' | 'driver',
          });
        }

        // Navigate based on role
        if (targetRole === 'driver') {
          router.replace('/(tabs)/home');
        } else {
          router.replace('/');
        }
      }

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  // Sign out
  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setDriverProfile(null);
  };

  // Refresh profile
  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
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
