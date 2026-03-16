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
  driver_payout: number;
  payment_status: string;
  created_at: string;
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

export async function getDashboardFinanceData(dateRange: string): Promise<InvoiceData[]> {
  try {
    let query = supabaseAdmin.from('invoices').select('id, total_amount, platform_fee, driver_payout, payment_status, created_at');
    
    if (dateRange !== 'all') {
      const now = new Date();
      let startDate;
      if (dateRange === 'today') startDate = startOfDay(now);
      else if (dateRange === '7d') startDate = subDays(now, 7);
      else if (dateRange === '30d') startDate = subDays(now, 30);
      else if (dateRange === '90d') startDate = subDays(now, 90);
      
      if (startDate) {
        query = query.gte('created_at', startDate.toISOString());
      }
    }

    const { data, error } = await query;
    
    if (error) {
      console.error('Supabase query error:', error);
      throw error;
    }
    
    return data as InvoiceData[];
  } catch (error) {
    console.error('Failed to fetch finance data:', error);
    return [];
  }
}
