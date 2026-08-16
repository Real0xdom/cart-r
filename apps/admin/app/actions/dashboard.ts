'use server';

import { supabaseAdmin } from '@/lib/supabase-server';
import { subDays, startOfDay } from 'date-fns';

export interface DashboardStats {
  recentBookings: number;
  newDriverRequests: number;
  newUsers: number;
  totalDrivers: number;
  totalRatings: number;
  openTickets: number;
}

export interface InvoiceData {
  id: string;
  total_amount: number;
  platform_fee: number;
  created_at: string;
}

export interface WithdrawalData {
  id: string;
  amount: number;
  created_at: string;
}

export interface DashboardFinanceData {
  invoices: InvoiceData[];
  successfulPayouts: WithdrawalData[];
}

function getStartDateForRange(dateRange: string): Date | null {
  const now = new Date();

  if (dateRange === 'today') return startOfDay(now);
  if (dateRange === '7d') return subDays(now, 7);
  if (dateRange === '30d') return subDays(now, 30);
  if (dateRange === '90d') return subDays(now, 90);

  return null;
}

export async function getDashboardOverviewStats(): Promise<DashboardStats> {
  const now = new Date();
  const oneDayAgo = subDays(now, 1).toISOString();
  const sevenDaysAgo = subDays(now, 7).toISOString();

  try {
    const [
      recentBookingsRes, 
      newDriverReqsRes, 
      newUsersRes, 
      totalDriversRes, 
      ratingsRes, 
      openTicketsRes
    ] = await Promise.all([
      supabaseAdmin.from('bookings').select('*', { count: 'exact', head: true }).gte('created_at', oneDayAgo),
      supabaseAdmin.from('drivers').select('*', { count: 'exact', head: true }).eq('verification_status', 'pending'),
      supabaseAdmin.from('users').select('*', { count: 'exact', head: true }).gte('created_at', sevenDaysAgo),
      supabaseAdmin.from('drivers').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('ratings').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('support_tickets').select('*', { count: 'exact', head: true }).in('status', ['open', 'in_progress']),
    ]);

    return {
      recentBookings: recentBookingsRes.count || 0,
      newDriverRequests: newDriverReqsRes.count || 0,
      newUsers: newUsersRes.count || 0,
      totalDrivers: totalDriversRes.count || 0,
      totalRatings: ratingsRes.count || 0,
      openTickets: openTicketsRes.count || 0,
    };
  } catch (error) {
    console.error('Failed to fetch dashboard overview stats:', error);
    return { recentBookings: 0, newDriverRequests: 0, newUsers: 0, totalDrivers: 0, totalRatings: 0, openTickets: 0 };
  }
}

export async function getDashboardFinanceData(dateRange: string): Promise<DashboardFinanceData> {
  try {
    const startDate = dateRange === 'all' ? null : getStartDateForRange(dateRange);

    let invoiceQuery = supabaseAdmin
      .from('invoices')
      .select('id, total_amount, platform_fee, created_at')
      .eq('payment_status', 'paid');

    let payoutQuery = supabaseAdmin
      .from('withdrawals')
      .select('id, amount, created_at')
      .or('payout_status.eq.SUCCESS,status.eq.paid');

    if (startDate) {
      const isoStartDate = startDate.toISOString();
      invoiceQuery = invoiceQuery.gte('created_at', isoStartDate);
      payoutQuery = payoutQuery.gte('created_at', isoStartDate);
    }

    const [{ data: invoiceData, error: invoiceError }, { data: payoutData, error: payoutError }] = await Promise.all([
      invoiceQuery,
      payoutQuery,
    ]);

    if (invoiceError) {
      console.error('Supabase invoice query error:', invoiceError);
      throw invoiceError;
    }
    if (payoutError) {
      console.error('Supabase payout query error:', payoutError);
      throw payoutError;
    }

    return {
      invoices: (invoiceData as InvoiceData[]) || [],
      successfulPayouts: (payoutData as WithdrawalData[]) || [],
    };
  } catch (error) {
    console.error('Failed to fetch finance data:', error);
    return { invoices: [], successfulPayouts: [] };
  }
}
