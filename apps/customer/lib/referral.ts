import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

const PENDING_REFERRAL_KEY = 'pending_referral';

type PendingReferral = {
  code: string;
  source_app: 'customer_app' | 'driver_app';
};

async function getStorage(key: string): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      return localStorage.getItem(key);
    }
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

async function setStorage(key: string, value: string): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      localStorage.setItem(key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value);
  } catch {}
}

async function removeStorage(key: string): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      localStorage.removeItem(key);
      return;
    }
    await SecureStore.deleteItemAsync(key);
  } catch {}
}

/** Save referral code from a link (e.g. ?ref=ABC123). Call when app opens with referral param. */
export async function savePendingReferral(
  code: string,
  sourceApp: 'customer_app' | 'driver_app' = 'customer_app'
): Promise<void> {
  const payload: PendingReferral = { code: code.trim().toUpperCase(), source_app: sourceApp };
  await setStorage(PENDING_REFERRAL_KEY, JSON.stringify(payload));
}

/** Get and remove pending referral. Returns null if none. */
export async function getAndClearPendingReferral(): Promise<PendingReferral | null> {
  const raw = await getStorage(PENDING_REFERRAL_KEY);
  await removeStorage(PENDING_REFERRAL_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PendingReferral;
    if (parsed?.code && parsed?.source_app) return parsed;
  } catch {}
  return null;
}

/**
 * Record that the current user was referred (call after creating new user profile).
 * Reads pending referral from storage, looks up referrer, inserts into referrals, clears storage.
 */
export async function recordPendingReferral(
  referredUserId: string,
  sourceApp: 'customer_app' | 'driver_app'
): Promise<void> {
  const pending = await getAndClearPendingReferral();
  if (!pending) return;

  try {
    const { data: referrer } = await supabase
      .from('users')
      .select('id')
      .eq('referral_code', pending.code)
      .maybeSingle();

    if (!referrer?.id || referrer.id === referredUserId) return;

    await supabase.from('referrals').insert({
      referrer_id: referrer.id,
      referred_id: referredUserId,
      referral_code_used: pending.code,
      source_app: sourceApp,
    });
  } catch (e) {
    console.warn('Referral record failed:', e);
  }
}
