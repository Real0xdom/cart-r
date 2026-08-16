import { supabase } from './supabase';

export const DRIVER_WALLET_DEBT_THRESHOLD = -100;
export const DRIVER_WALLET_RECHARGE_BUFFER = 100;

export interface WalletInfo {
  id: string;
  pending_balance: number;
  available_balance: number;
  total_earned: number;
  total_withdrawn: number;
  pending_withdrawals: number;
  total_commission_owed: number;
  bank_details: any;
  beneficiary_status: string;
  verification_status: string;
  has_negative_balance: boolean;
  requires_recharge: boolean;
  updated_at: string;
}

export interface WalletStats {
  total_rides_completed: number;
  total_earned_this_month: number;
  total_commission_paid: number;
  pending_withdrawals: number;
}

export interface DriverWalletInfoResponse {
  wallet: WalletInfo;
  recent_transactions: WalletTransaction[];
  stats: WalletStats;
}

export interface WalletTransaction {
  id: string;
  driver_id: string;
  booking_id: string | null;
  withdrawal_id: string | null;
  reference_id?: string | null;
  type: 'earning' | 'withdrawal' | 'reversal' | 'release' | 'adjustment' | 'platform_fee';
  amount: number;
  balance_type: 'available' | 'pending';
  direction: 'credit' | 'debit';
  status: 'pending' | 'completed' | 'failed';
  description: string | null;
  metadata: any;
  created_at: string;
}

export interface WalletPaymentTransaction {
  id: string;
  user_id: string;
  amount: number;
  type: 'credit' | 'debit';
  status: 'pending' | 'completed' | 'failed' | string | null;
  payment_order_id: string | null;
  booking_id: string | null;
  description: string | null;
  created_at: string | null;
  updated_at: string | null;
}

function normalizeWalletPaymentOrderId(value: string | null | undefined) {
  return (value || '').trim().toUpperCase();
}

function normalizeWalletPaymentDescription(value: string | null | undefined) {
  return (value || '').trim().toLowerCase();
}

export function isDriverWalletPaymentTransaction(transaction: Pick<WalletPaymentTransaction, 'payment_order_id' | 'description'>) {
  const orderId = normalizeWalletPaymentOrderId(transaction.payment_order_id);
  const description = normalizeWalletPaymentDescription(transaction.description);

  return orderId.startsWith('DRIVERWALLET_') || description.includes('driver wallet top-up');
}

export interface DriverWalletEligibility {
  canAcceptRides: boolean;
  reason?: string;
  currentBalance: number;
  requiredRecharge?: number;
}

export interface DriverWalletRestrictionDetails {
  errorCode: 'wallet_recharge_required';
  message: string;
  currentBalance: number;
  requiredRecharge: number;
}

function getWalletPayload(data: any): Partial<WalletInfo> | null {
  if (data?.wallet && typeof data.wallet === 'object') {
    return data.wallet as Partial<WalletInfo>;
  }

  if (data && typeof data === 'object' && 'available_balance' in data) {
    return data as Partial<WalletInfo>;
  }

  return null;
}

function toMoneyAmount(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

export function getDriverWalletRequiredRecharge(balance: number): number {
  return Math.abs(balance) + DRIVER_WALLET_RECHARGE_BUFFER;
}

export function getDriverWalletRechargeNavigationTarget() {
  return {
    pathname: '/(tabs)/earnings',
    params: { openRecharge: '1' },
  } as const;
}

export function parseDriverWalletRestriction(result: any): DriverWalletRestrictionDetails | null {
  if (result?.error !== 'wallet_recharge_required') {
    return null;
  }

  const currentBalance = toMoneyAmount(result.current_balance, 0);
  const requiredRecharge = toMoneyAmount(
    result.required_recharge,
    getDriverWalletRequiredRecharge(currentBalance)
  );

  return {
    errorCode: 'wallet_recharge_required',
    message:
      typeof result.message === 'string' && result.message.trim().length > 0
        ? result.message
        : 'Negative wallet balance. Please recharge to continue.',
    currentBalance,
    requiredRecharge,
  };
}

export async function checkDriverWalletEligibility(driverId: string): Promise<DriverWalletEligibility> {
  console.log('[WALLET] Checking driver wallet eligibility', { driverId });

  const { data, error } = await supabase.rpc('get_driver_wallet_info', { p_driver_id: driverId });

  if (error) {
    console.error('[WALLET] Failed to fetch driver wallet info:', error);
    throw error;
  }

  const wallet = getWalletPayload(data);

  if (!wallet) {
    console.warn('[WALLET] Driver wallet missing from RPC payload', { driverId });
    return {
      canAcceptRides: false,
      reason: 'Wallet not initialized',
      currentBalance: 0,
    };
  }

  const currentBalance = toMoneyAmount(wallet.available_balance, 0);
  const requiresRecharge =
    typeof wallet.requires_recharge === 'boolean'
      ? wallet.requires_recharge
      : currentBalance < DRIVER_WALLET_DEBT_THRESHOLD;

  console.log('[WALLET] Driver wallet eligibility result', {
    driverId,
    currentBalance,
    threshold: DRIVER_WALLET_DEBT_THRESHOLD,
    requiresRecharge,
  });

  if (requiresRecharge) {
    return {
      canAcceptRides: false,
      reason: 'Negative wallet balance. Please recharge to continue.',
      currentBalance,
      requiredRecharge: getDriverWalletRequiredRecharge(currentBalance),
    };
  }

  return {
    canAcceptRides: true,
    currentBalance,
  };
}

export async function getDriverWalletInfo(driverId: string): Promise<{ data: DriverWalletInfoResponse | null; error: Error | null }> {
  try {
    const { data, error } = await supabase.rpc('get_driver_wallet_info', { p_driver_id: driverId });
    if (error) throw error;
    return { data: data as unknown as DriverWalletInfoResponse, error: null };
  } catch (error: any) {
    console.error('Error fetching wallet info:', error);
    return { data: null, error };
  }
}

export async function getDriverWalletTransactions(driverId: string, limit = 50) {
  try {
    // @ts-ignore
    const { data, error } = await supabase
      .from('driver_wallet_transactions')
      .select('*')
      .eq('driver_id', driverId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return { data: data as any, error: null };
  } catch (error: any) {
    console.error('Error fetching wallet transactions:', error);
    return { data: null, error };
  }
}

export async function getWalletPaymentTransactions(userId: string, limit = 50): Promise<{ data: WalletPaymentTransaction[] | null; error: Error | null }> {
  try {
    const fetchLimit = Math.max(limit * 3, 30);
    const { data, error } = await supabase
      .from('wallet_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(fetchLimit);

    if (error) throw error;
    const filtered = (data as WalletPaymentTransaction[]).filter(isDriverWalletPaymentTransaction).slice(0, limit);
    return { data: filtered, error: null };
  } catch (error: any) {
    console.error('Error fetching wallet payment transactions:', error);
    return { data: null, error };
  }
}

export async function requestWithdrawal(driverId: string, amount: number): Promise<{ success: boolean; error?: string }> {
  try {
    const idempotencyKey = `wd_${driverId}_${Date.now()}`;
    // @ts-ignore
    const { data, error } = await supabase.rpc('request_withdrawal', {
      p_driver_id: driverId,
      p_amount: amount,
      p_idempotency_key: idempotencyKey
    });
    
    if (error) throw error;
    
    // @ts-ignore
    if (data && !data.success) {
      // @ts-ignore
      return { success: false, error: data.error };
    }
    
    return { success: true };
  } catch (error: any) {
    console.error('Error requesting withdrawal:', error);
    return { success: false, error: error.message };
  }
}

export async function getPlatformSetting(key: string): Promise<{ data: any | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      // @ts-ignore
      .from('platform_settings')
      .select('value')
      .eq('key', key)
      .maybeSingle();
    if (error) throw error;
    // @ts-ignore
    return { data: data?.value || null, error: null };
  } catch (error: any) {
    console.error(`Error fetching setting ${key}:`, error);
    return { data: null, error };
  }
}

export interface WithdrawalRequest {
  id: string;
  driver_id: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected' | 'paid' | 'failed' | 'reversed';
  payout_reference: string | null;
  payout_status: string | null;
  payout_error: string | null;
  notes: string | null;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
  processed_at: string | null;
}

export async function getDriverWithdrawals(driverId: string, limit = 20): Promise<{ data: WithdrawalRequest[] | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('withdrawals')
      .select('*')
      .eq('driver_id', driverId)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    return { data: data as WithdrawalRequest[], error: null };
  } catch (error: any) {
    console.error('Error fetching withdrawals:', error);
    return { data: null, error };
  }
}
