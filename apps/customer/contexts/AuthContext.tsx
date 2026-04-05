import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { router } from 'expo-router';

import { supabase, Database } from '@/lib/supabase';

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
const IS_DEV_BUILD = process.env.EXPO_PUBLIC_ENV === 'development';
const DEV_LOGIN_DISABLED_MESSAGE = 'Login is disabled in the customer development build.';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [driverProfile, setDriverProfile] = useState<DriverProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const isClearingSessionForPhoneAuthRef = useRef(false);
  const isBlockingDisabledAccountRef = useRef(false);
  const currentUserId = user?.id ?? null;

  const isTransientAuthError = (error: unknown) => {
    const message = error instanceof Error ? error.message.toLowerCase() : '';
    return (
      message.includes('network request failed') ||
      message.includes('network error') ||
      message.includes('failed to fetch') ||
      message.includes('timed out') ||
      message.includes('timeout')
    );
  };

  const isExpiredOtpError = (error: unknown) => {
    const message = error instanceof Error ? error.message.toLowerCase() : '';
    return (
      message.includes('token has expired') ||
      message.includes('expired or is invalid') ||
      message.includes('otp_expired')
    );
  };

  const createDevLoginDisabledError = () => new Error(DEV_LOGIN_DISABLED_MESSAGE);

  const clearLocalSession = async () => {
    isClearingSessionForPhoneAuthRef.current = true;
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch (error) {
      console.warn('[AUTH] Failed to clear local session before phone auth:', error);
    } finally {
      setTimeout(() => {
        isClearingSessionForPhoneAuthRef.current = false;
      }, 0);
    }
  };

  const waitBeforeRetry = async (delayMs: number) =>
    new Promise((resolve) => setTimeout(resolve, delayMs));

  const registerPushTokenWithRetry = async (userId: string) => {
    import('@/lib/notifications').then(async ({ registerPushToken }) => {
      let attempts = 0;
      const maxAttempts = 3;

      while (attempts < maxAttempts) {
        try {
          const success = await registerPushToken(userId);
          if (success) {
            console.log('Push token registered after attempt', attempts + 1);
            break;
          }
        } catch (err: any) {
          // If Firebase isn't configured, don't retry because it will never work.
          if (err?.message === 'FIREBASE_NOT_CONFIGURED') {
            console.log('Push notifications disabled (Firebase not configured). Skipping retries.');
            break;
          }
          console.warn(`Attempt ${attempts + 1}/${maxAttempts} failed:`, err);
        }

        attempts++;
        if (attempts < maxAttempts) {
          await new Promise(resolve =>
            setTimeout(resolve, attempts === 1 ? 2000 : 5000)
          );
          console.log(`Retrying push token registration (${attempts}/${maxAttempts})...`);
        }
      }

      if (attempts === maxAttempts) {
        console.error('Failed to register push token after 3 attempts');
      }
    });
  };

  // Fetch or create user profile from database
  const fetchProfile = async (authUser: User) => {
    try {
      // Try to fetch existing profile
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle(); // Use maybeSingle instead of single to avoid error when no rows
      
      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching profile:', error);
        return;
      }

      // If profile doesn't exist, create one
      if (!data) {
        console.log('Creating new profile for user:', authUser.id);
        const phone = authUser.phone || null;
        const email = authUser.email || (phone ? `${phone.replace('+', '')}@phone.cartr.app` : 'unknown@cartr.app');
        const name = authUser.user_metadata?.name || 'Cartr User';

        const { data: newProfile, error: insertError } = await supabase
          .from('users')
          .insert({
            id: authUser.id,
            email,
            name,
            phone,
            role: 'customer', // Default role for customer app
          })
          .select()
          .single();

        if (insertError) {
          // If duplicate key error, profile was created by another call - fetch it
          if (insertError.code === '23505') {
            const { data: existingProfile } = await supabase
              .from('users')
              .select('*')
              .eq('id', authUser.id)
              .single();
            if (existingProfile) {
              setProfile(existingProfile);
            }
            return;
          }
          console.error('Error creating profile:', insertError);
          return;
        }
        setDriverProfile(null);

        setProfile(newProfile);
        return;
      }

      setProfile(data);

      setDriverProfile(null);

      // If user is a driver, fetch driver profile
      if (data?.role === 'driver') {
        const { data: driverData, error: driverError } = await supabase
          .from('drivers')
          .select('*')
          .eq('user_id', authUser.id)
          .maybeSingle();
        
        if (!driverError && driverData) {
          setDriverProfile(driverData);
        }
      }
    } catch (error) {
      console.error('Error in fetchProfile:', error);
    }
  };

  const applySession = async (nextSession: Session | null) => {
    setSession(nextSession);
    setUser(nextSession?.user ?? null);

    if (nextSession?.user) {
      await fetchProfile(nextSession.user);
      void registerPushTokenWithRetry(nextSession.user.id);
      return;
    }

    setProfile(null);
    setDriverProfile(null);
  };

  // Initialize auth state
  useEffect(() => {
    let isMounted = true;

    const initializeAuth = async () => {
      try {
        if (IS_DEV_BUILD) {
          await supabase.auth.signOut({ scope: 'local' });

          if (isMounted) {
            await applySession(null);
          }
          return;
        }

        const { data, error } = await supabase.auth.getSession();

        if (error) {
          throw error;
        }

        if (isMounted) {
          await applySession(data.session);
        }
      } catch (error: any) {
        console.error('Error restoring auth session:', error);

        const message = error?.message?.toLowerCase?.() ?? '';
        if (message.includes('refresh token')) {
          // Clear only the local device session if the cached refresh token is stale.
          await supabase.auth.signOut({ scope: 'local' });
          if (isMounted) {
            await applySession(null);
          }
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    // Timeout guard: if auth takes >6s (slow network), stop blocking the UI.
    // The onAuthStateChange listener below will pick up the session when it arrives.
    const authTimeout = setTimeout(() => {
      if (isMounted) {
        console.warn('[AUTH] Auth initialization timed out after 6s — unblocking UI');
        setIsLoading(false);
      }
    }, 6000);

    void initializeAuth().finally(() => clearTimeout(authTimeout));

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isMounted) {
          return;
        }

        if (IS_DEV_BUILD && session?.user) {
          await supabase.auth.signOut({ scope: 'local' });
          await applySession(null);
          setIsLoading(false);
          router.replace('/sign-in');
          return;
        }

        await applySession(session);
        setIsLoading(false);

        // Handle navigation based on auth state
        if (event === 'SIGNED_IN') {
          // Will navigate based on role in the calling component
        } else if (event === 'SIGNED_OUT') {
          if (isClearingSessionForPhoneAuthRef.current) {
            return;
          }
          router.replace('/');
        }
      }
    );

    return () => {
      isMounted = false;
      clearTimeout(authTimeout);
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const customerProfile = profile as (UserProfile & { customer_app_enabled?: boolean }) | null;

    if (!customerProfile || customerProfile.customer_app_enabled !== false || isBlockingDisabledAccountRef.current) {
      return;
    }

    let isCancelled = false;
    isBlockingDisabledAccountRef.current = true;

    const blockCustomerAccess = async () => {
      try {
        if (!isCancelled) {
          router.replace('/account-blocked');
        }
      } finally {
        isBlockingDisabledAccountRef.current = false;
      }
    };

    void blockCustomerAccess();

    return () => {
      isCancelled = true;
    };
  }, [profile]);

  useEffect(() => {
    if (!currentUserId) {
      return;
    }

    const channel = supabase
      .channel(`customer-profile-sync-${currentUserId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'users',
          filter: `id=eq.${currentUserId}`,
        },
        (payload) => {
          console.log('[AUTH] Customer profile updated remotely - syncing:', payload.new);
          setProfile((prev: UserProfile | null) =>
            prev ? ({ ...prev, ...payload.new } as UserProfile) : prev
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  // Sign up with email/password
  const signUp = async (email: string, password: string, name: string, phone?: string) => {
    try {
      if (IS_DEV_BUILD) {
        throw createDevLoginDisabledError();
      }

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
      if (IS_DEV_BUILD) {
        throw createDevLoginDisabledError();
      }

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
      if (IS_DEV_BUILD) {
        throw createDevLoginDisabledError();
      }

      const normalizedPhone = phone.trim();

      await clearLocalSession();

      let lastError: Error | null = null;
      for (let attempt = 0; attempt < 2; attempt++) {
        const { error } = await supabase.auth.signInWithOtp({
          phone: normalizedPhone,
        });

        if (!error) {
          return { error: null };
        }

        lastError = error;
        if (!isTransientAuthError(error) || attempt === 1) {
          throw error;
        }

        await waitBeforeRetry(1200);
      }

      if (lastError) {
        throw lastError;
      }

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  // Verify OTP
  const verifyOtp = async (phone: string, token: string) => {
    try {
      if (IS_DEV_BUILD) {
        throw createDevLoginDisabledError();
      }

      const normalizedPhone = phone.trim();
      const sanitizedToken = token.replace(/\D/g, '');
      let lastError: Error | null = null;

      for (let attempt = 0; attempt < 2; attempt++) {
        const { data, error } = await supabase.auth.verifyOtp({
          phone: normalizedPhone,
          token: sanitizedToken,
          type: 'sms',
        });

        if (!error) {
          return { error: null, data };
        }

        lastError = error;
        if (!isTransientAuthError(error) || attempt === 1) {
          break;
        }

        await waitBeforeRetry(1200);
      }

      if (lastError && isExpiredOtpError(lastError)) {
        return {
          error: new Error('This OTP expired or was replaced. Please request a new code and use the latest OTP.'),
        };
      }

      if (lastError) {
        throw lastError;
      }

      return { error: new Error('Failed to verify OTP. Please try again.') };
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
      if (IS_DEV_BUILD) {
        throw createDevLoginDisabledError();
      }

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
            email: data.user.email || `${phone}@phone.cartr.app`,
            name: 'Cartr User',
            phone,
            role: targetRole as 'customer' | 'driver',
          });
        }

        // Navigate based on role
        if (targetRole === 'driver') {
          router.replace('/(tabs)/home');
        } else {
          router.replace('/(tabs)/home');
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
    const authUser =
      user ??
      (await supabase.auth.getUser()).data.user ??
      (await supabase.auth.getSession()).data.session?.user ??
      null;

    if (authUser) {
      await fetchProfile(authUser);
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

      const { data: activeBooking } = await supabase
        .from('bookings')
        .select('id')
        .eq('driver_id', driverProfile.id)
        .eq('status', 'in_progress')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Also log to driver_locations table for history
      await supabase.from('driver_locations').insert({
        driver_id: driverProfile.id,
        booking_id: activeBooking?.id ?? null,
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


