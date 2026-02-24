import { supabase } from './supabase';

export interface WalletInfo {
  pending_balance: number;
  available_balance: number;
  total_earned: number;
  total_withdrawn: number;
  pending_withdrawals: number;
  bank_details: any;
  beneficiary_status: string;
  verification_status: string;
}

export interface WalletTransaction {
  id: string;
  driver_id: string;
  booking_id: string | null;
  withdrawal_id: string | null;
  type: 'earning' | 'withdrawal' | 'reversal' | 'release' | 'adjustment';
  amount: number;
  balance_type: 'available' | 'pending';
  direction: 'credit' | 'debit';
  status: 'pending' | 'completed' | 'failed';
  description: string | null;
  metadata: any;
  created_at: string;
}

export async function getDriverWalletInfo(driverId: string): Promise<{ data: WalletInfo | null; error: Error | null }> {
  try {
    const { data, error } = await supabase.rpc('get_driver_wallet_info', { p_driver_id: driverId });
    if (error) throw error;
    return { data: data as WalletInfo, error: null };
  } catch (error: any) {
    console.error('Error fetching wallet info:', error);
    return { data: null, error };
  }
}

export async function getDriverWalletTransactions(driverId: string, limit = 50): Promise<{ data: WalletTransaction[] | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('driver_wallet_transactions')
      .select('*')
      .eq('driver_id', driverId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return { data: data as WalletTransaction[], error: null };
  } catch (error: any) {
    console.error('Error fetching wallet transactions:', error);
    return { data: null, error };
  }
}

export async function requestWithdrawal(driverId: string, amount: number): Promise<{ success: boolean; error?: string }> {
  try {
    const idempotencyKey = `wd_${driverId}_${Date.now()}`;
    const { data, error } = await supabase.rpc('request_withdrawal', {
      p_driver_id: driverId,
      p_amount: amount,
      p_idempotency_key: idempotencyKey
    });
    
    if (error) throw error;
    if (data && !data.success) {
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
      .from('platform_settings')
      .select('value')
      .eq('key', key)
      .single();
    if (error) throw error;
    return { data: data.value, error: null };
  } catch (error: any) {
    console.error(`Error fetching setting ${key}:`, error);
    return { data: null, error };
  }
}
