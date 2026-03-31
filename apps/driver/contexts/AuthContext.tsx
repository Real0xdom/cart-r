import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { router } from 'expo-router';

import { supabase } from '@/lib/supabase';
import { Database } from '@/lib/database.types';

const ACTIVE_TRACKING_STATUSES = ['accepted', 'driver_arrived', 'in_progress'] as const;

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
  const isClearingSessionForPhoneAuthRef = useRef(false);
  const isBlockingDisabledAccountRef = useRef(false);

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

  // Fetch or create user profile from database
  const fetchProfile = async (authUser: User) => {
    try {
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();
      
      if (userError && userError.code !== 'PGRST116') {
        console.error('Error fetching profile:', userError);
        return;
      }

      if (!userData) {
        const phone = authUser.phone || null;
        const email =
          authUser.email ||
          (phone ? `${phone.replace('+', '')}@phone.cartr.app` : 'unknown@cartr.app');
        const name =
          authUser.user_metadata?.name ||
          authUser.user_metadata?.full_name ||
          'Cartr Driver';

        const { data: newProfile, error: insertError } = await supabase
          .from('users')
          .insert({
            id: authUser.id,
            email,
            name,
            phone,
            role: 'driver',
          })
          .select()
          .single();

        if (insertError) {
          if (insertError.code === '23505') {
            const { data: existingProfile } = await supabase
              .from('users')
              .select('*')
              .eq('id', authUser.id)
              .maybeSingle();

            if (existingProfile) {
              setProfile(existingProfile);
            }
          } else {
            console.error('Error creating profile:', insertError);
            return;
          }
        } else {
          setProfile(newProfile);
        }
      } else {
        setProfile(userData);
      }

      const { data: driverData, error: driverError } = await supabase
        .from('drivers')
        .select('*')
        .eq('user_id', authUser.id)
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
          await supabase.auth.signOut({ scope: 'local' });
          setSession(null);
          setUser(null);
          setIsLoading(false);
          return;
        }
        
        if (isMounted) {
          setSession(session);
          setUser(session?.user ?? null);
          if (session?.user) {
            await fetchProfile(session.user);
          }
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        // Clear any invalid session
        await supabase.auth.signOut({ scope: 'local' });
        if (isMounted) {
          setSession(null);
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };
    
    let isMounted = true;
    
    // Timeout guard: if auth takes >6s (slow network), stop blocking the UI.
    // The onAuthStateChange listener below will pick up the session when it arrives.
    const authTimeout = setTimeout(() => {
      if (isMounted) {
        console.warn('[AUTH] Auth initialization timed out after 6s — unblocking UI');
        setIsLoading(false);
      }
    }, 6000);

    initializeAuth().finally(() => clearTimeout(authTimeout));

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isMounted) return;
        
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          await fetchProfile(session.user);
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
    const currentDriverProfile = driverProfile as (DriverProfile & { driver_app_enabled?: boolean }) | null;

    if (!currentDriverProfile || currentDriverProfile.driver_app_enabled !== false || isBlockingDisabledAccountRef.current) {
      return;
    }

    let isCancelled = false;
    isBlockingDisabledAccountRef.current = true;

    const blockDriverAccess = async () => {
      try {
        if (!isCancelled) {
          router.replace('/account-blocked');
        }
      } finally {
        isBlockingDisabledAccountRef.current = false;
      }
    };

    void blockDriverAccess();

    return () => {
      isCancelled = true;
    };
  }, [driverProfile]);

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
            name: 'Cartr Driver',
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
          current_heading: null,
          last_location_update: new Date().toISOString(),
        })
        .eq('id', driverProfile.id);

      if (error) throw error;

      const { data: activeBookings } = await supabase
        .from('bookings')
        .select('id, status, accepted_at, driver_arrived_at, started_at, updated_at, created_at')
        .eq('driver_id', driverProfile.id)
        .in('status', [...ACTIVE_TRACKING_STATUSES])
        .limit(10);

      const trackedBooking = [...(activeBookings || [])].sort((left: any, right: any) => {
        const leftPriority = left.status === 'in_progress' ? 0 : left.status === 'driver_arrived' ? 1 : 2;
        const rightPriority = right.status === 'in_progress' ? 0 : right.status === 'driver_arrived' ? 1 : 2;
        if (leftPriority !== rightPriority) {
          return leftPriority - rightPriority;
        }

        const leftTimestamp = new Date(left.started_at || left.driver_arrived_at || left.accepted_at || left.updated_at || left.created_at || 0).getTime();
        const rightTimestamp = new Date(right.started_at || right.driver_arrived_at || right.accepted_at || right.updated_at || right.created_at || 0).getTime();
        return rightTimestamp - leftTimestamp;
      })[0];

      // Also log to driver_locations table for history
      await supabase.from('driver_locations').insert({
        driver_id: driverProfile.id,
        booking_id: trackedBooking?.id ?? null,
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
