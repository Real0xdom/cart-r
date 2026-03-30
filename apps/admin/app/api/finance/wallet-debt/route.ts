import { NextResponse } from 'next/server';

import { supabaseAdmin } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

interface DriverDebtRow {
  driverId: string;
  name: string;
  phone: string;
  email: string;
  availableBalance: number;
  totalCommissionOwed: number;
  updatedAt: string | null;
}

export async function GET() {
  try {
    const [walletsResult, topupsResult] = await Promise.all([
      supabaseAdmin
        .from('driver_wallets')
        .select(`
          driver_id,
          available_balance,
          total_commission_owed,
          updated_at,
          driver:drivers!driver_wallets_driver_id_fkey(
            id,
            user:users!drivers_user_id_fkey(name, phone, email)
          )
        `)
        .or('available_balance.lt.0,total_commission_owed.gt.0')
        .order('updated_at', { ascending: false }),
      supabaseAdmin
        .from('driver_wallet_transactions')
        .select('amount, created_at, metadata')
        .eq('type', 'adjustment')
        .eq('status', 'completed'),
    ]);

    if (walletsResult.error) {
      throw walletsResult.error;
    }
    if (topupsResult.error) {
      throw topupsResult.error;
    }

    const wallets = (walletsResult.data || []) as Array<any>;
    const topups = (topupsResult.data || []) as Array<any>;

    const debtDrivers: DriverDebtRow[] = wallets
      .map((wallet) => ({
        driverId: wallet.driver_id,
        name: wallet.driver?.user?.name || 'Unknown Driver',
        phone: wallet.driver?.user?.phone || '',
        email: wallet.driver?.user?.email || '',
        availableBalance: Number(wallet.available_balance || 0),
        totalCommissionOwed: Number(wallet.total_commission_owed || 0),
        updatedAt: wallet.updated_at || null,
      }))
      .sort((a, b) => b.totalCommissionOwed - a.totalCommissionOwed);

    const completedDriverTopups = topups.filter(
      (txn) => txn?.metadata && typeof txn.metadata === 'object' && txn.metadata.source === 'driver_wallet_topup'
    );

    const recoveredCommissionFromTopups = completedDriverTopups.reduce((sum, txn) => {
      const debtAppliedAmount = Number(txn?.metadata?.debt_applied_amount || 0);
      return sum + debtAppliedAmount;
    }, 0);

    return NextResponse.json({
      driversWithDebt: debtDrivers.filter((driver) => driver.totalCommissionOwed > 0).length,
      negativeWalletDrivers: debtDrivers.filter((driver) => driver.availableBalance < 0).length,
      totalOutstandingCommissionDebt: debtDrivers.reduce((sum, driver) => sum + driver.totalCommissionOwed, 0),
      recoveredCommissionFromTopups,
      debtRecoveryTopupCount: completedDriverTopups.filter((txn) => Number(txn?.metadata?.debt_applied_amount || 0) > 0).length,
      drivers: debtDrivers,
    });
  } catch (error: any) {
    console.error('Failed to load wallet debt summary:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
