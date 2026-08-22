'use client';
import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import Sidebar from '@/components/Sidebar';
import { 
  Users, 
  Truck, 
  Package, 
  CheckCircle, 
  Star,
  LifeBuoy,
  TrendingUp,
  Filter
} from 'lucide-react';
import { format, subDays, startOfDay, endOfDay, isAfter, isBefore, isSameDay } from 'date-fns';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';

interface ChartDataPoint {
  date: string;
  Revenue: number;
  PlatformEarnings: number;
  DriverPayout: number;
  Pending: number;
}

import { getDashboardOverviewStats, getDashboardFinanceData, type DashboardStats, type InvoiceData } from '@/app/actions/dashboard';

export default function Home() {
  const [stats, setStats] = useState<DashboardStats>({
    recentBookings: 0,
    newDriverRequests: 0,
    newUsers: 0,
    totalDrivers: 0,
    totalRatings: 0,
    openTickets: 0,
  });
  
  const [invoices, setInvoices] = useState<InvoiceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [dateRange, setDateRange] = useState<'today' | '7d' | '30d' | '90d' | 'all'>('7d');

  const fetchOverviewStats = async () => {
    try {
      const data = await getDashboardOverviewStats();
      setStats(data);
    } catch (error) {
      console.error('Error fetching overview stats:', error);
    }
  };

  const fetchFinanceData = async () => {
    try {
      const data = await getDashboardFinanceData(dateRange);
      setInvoices(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching finance data:', error);
      setInvoices([]);
    }
  };

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      await fetchOverviewStats();
      await fetchFinanceData();
      setLoading(false);
      setLastUpdated(new Date().toLocaleTimeString());
    };
    loadAll();
  }, [dateRange]);

  // Compute aggregated numbers for the selected range
  const financeSummary = useMemo(() => {
    const validInvoices = Array.isArray(invoices) ? invoices : [];
    const paidInvoices = validInvoices.filter(i => i.payment_status === 'paid');
    const pendingInvoices = validInvoices.filter(i => i.payment_status !== 'paid');

    const totalRevenue = paidInvoices.reduce((sum, i) => sum + Number(i.total_amount || 0), 0);
    const platformEarnings = paidInvoices.reduce((sum, i) => sum + Number(i.platform_fee || 0), 0);
    const driverPayouts = paidInvoices.reduce((sum, i) => sum + Number(i.driver_payout || 0), 0);
    const pendingAmount = pendingInvoices.reduce((sum, i) => sum + Number(i.total_amount || 0), 0);
    const avgAmount = validInvoices.length > 0 ? totalRevenue / paidInvoices.length || 0 : 0;

    return {
      totalRevenue,
      avgAmount: Math.round(avgAmount),
      platformEarnings,
      driverPayouts,
      pendingAmount
    };
  }, [invoices]);

  // Aggregate data for the chart by date
  const chartData = useMemo(() => {
    const dailyData: Record<string, ChartDataPoint> = {};
    const validInvoices = Array.isArray(invoices) ? invoices : [];

    validInvoices.forEach(inv => {
      const dateKey = format(new Date(inv.created_at), 'MMM dd');
      if (!dailyData[dateKey]) {
        dailyData[dateKey] = {
          date: dateKey,
          Revenue: 0,
          PlatformEarnings: 0,
          DriverPayout: 0,
          Pending: 0
        };
      }
      
      if (inv.payment_status === 'paid') {
        dailyData[dateKey].Revenue += Number(inv.total_amount || 0);
        dailyData[dateKey].PlatformEarnings += Number(inv.platform_fee || 0);
        dailyData[dateKey].DriverPayout += Number(inv.driver_payout || 0);
      } else {
        dailyData[dateKey].Pending += Number(inv.total_amount || 0);
      }
    });

    // Sort by date sequentially
    return Object.values(dailyData).sort((a, b) => {
      // Basic sorting by month/day 
      return new Date(a.date + " " + new Date().getFullYear()).getTime() - 
             new Date(b.date + " " + new Date().getFullYear()).getTime();
    });
  }, [invoices]);

  const fmt = (n: number) => '₹' + Number(n).toLocaleString('en-IN');

  return (
    <div className="min-h-screen bg-[var(--color-brand-cream)] font-sans">
      <Sidebar />

      <div className="ml-72 p-8 max-w-[1600px]">
        {/* Header */}
        <div className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-1">Dashboard Overview</h1>
            <p className="text-gray-500 text-sm">Key metrics and platform health at a glance.</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500 bg-white px-3 py-1.5 rounded-full border border-gray-100 shadow-sm">
              Last updated: {lastUpdated || '...'}
            </span>
          </div>
        </div>

        {/* Overview Stat Cards Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-10">
          
          <Link href="/bookings" className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow group cursor-pointer block">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-emerald-50 rounded-xl group-hover:bg-emerald-100 transition-colors">
                <Package size={22} className="text-emerald-600" />
              </div>
              <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">Last 24h</span>
            </div>
            <h3 className="text-gray-500 text-sm font-medium mb-1">Recent Bookings</h3>
            <p className="text-3xl font-bold text-gray-900 tracking-tight">
              {loading ? '...' : stats.recentBookings.toLocaleString()}
            </p>
          </Link>

          <Link href="/drivers" className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow group cursor-pointer block">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-orange-50 rounded-xl group-hover:bg-orange-100 transition-colors">
                <CheckCircle size={22} className="text-orange-600" />
              </div>
              <span className="text-xs font-semibold text-orange-600 bg-orange-50 px-2 py-1 rounded-lg">Action Needed</span>
            </div>
            <h3 className="text-gray-500 text-sm font-medium mb-1">Driver Verification Reqs</h3>
            <p className="text-3xl font-bold text-orange-600 tracking-tight">
              {loading ? '...' : stats.newDriverRequests.toLocaleString()}
            </p>
          </Link>

          <Link href="/users" className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow group cursor-pointer block">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-blue-50 rounded-xl group-hover:bg-blue-100 transition-colors">
                <Users size={22} className="text-blue-600" />
              </div>
              <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">Last 7d</span>
            </div>
            <h3 className="text-gray-500 text-sm font-medium mb-1">New Users</h3>
            <p className="text-3xl font-bold text-gray-900 tracking-tight">
              {loading ? '...' : stats.newUsers.toLocaleString()}
            </p>
          </Link>

          <Link href="/drivers" className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow group cursor-pointer block">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-indigo-50 rounded-xl group-hover:bg-indigo-100 transition-colors">
                <Truck size={22} className="text-indigo-600" />
              </div>
              <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg">All Time</span>
            </div>
            <h3 className="text-gray-500 text-sm font-medium mb-1">Total Drivers</h3>
            <p className="text-3xl font-bold text-gray-900 tracking-tight">
              {loading ? '...' : stats.totalDrivers.toLocaleString()}
            </p>
          </Link>

          <Link href="/ratings" className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow group cursor-pointer block">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-yellow-50 rounded-xl group-hover:bg-yellow-100 transition-colors">
                <Star size={22} className="text-yellow-600" />
              </div>
              <span className="text-xs font-semibold text-yellow-600 bg-yellow-50 px-2 py-1 rounded-lg">All Time</span>
            </div>
            <h3 className="text-gray-500 text-sm font-medium mb-1">Total Ratings</h3>
            <p className="text-3xl font-bold text-gray-900 tracking-tight">
              {loading ? '...' : stats.totalRatings.toLocaleString()}
            </p>
          </Link>

          <Link href="/support" className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow group cursor-pointer block">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-red-50 rounded-xl group-hover:bg-red-100 transition-colors">
                <LifeBuoy size={22} className="text-red-600" />
              </div>
              {stats.openTickets > 0 && (
                <span className="text-xs font-semibold text-red-600 bg-red-50 px-2 py-1 rounded-lg animate-pulse">Needs Attention</span>
              )}
            </div>
            <h3 className="text-gray-500 text-sm font-medium mb-1">Open Support Tickets</h3>
            <p className="text-3xl font-bold text-gray-900 tracking-tight">
              {loading ? '...' : stats.openTickets.toLocaleString()}
            </p>
          </Link>

        </div>

        {/* Finance Analytics Section */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <TrendingUp size={20} className="text-green-600" />
                Financial Analytics
              </h2>
              <p className="text-sm text-gray-500 mt-1">Revenue breakdowns based on completed (paid) invoices</p>
            </div>
            
            <div className="flex items-center gap-2 bg-gray-50 p-1.5 rounded-xl border border-gray-100">
              {(['today', '7d', '30d', '90d', 'all'] as const).map(range => (
                <button
                  key={range}
                  onClick={() => setDateRange(range)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    dateRange === range 
                      ? 'bg-white text-gray-900 shadow-sm border border-gray-200' 
                      : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100/50'
                  }`}
                >
                  {range === 'today' ? 'Today' : 
                   range === '7d' ? '7 Days' : 
                   range === '30d' ? '30 Days' : 
                   range === '90d' ? '3 Months' : 'All Time'}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="h-[400px] flex items-center justify-center">
              <div className="animate-spin w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full"/>
            </div>
          ) : (
            <>
              {/* Finance Summary Pills */}
              <div className="flex flex-wrap gap-4 mb-8">
                <div className="bg-gray-50 px-5 py-3 rounded-xl border border-gray-100">
                  <p className="text-xs text-gray-500 font-semibold mb-1 uppercase tracking-wider">Total Revenue</p>
                  <p className="text-xl font-bold text-green-600">{fmt(financeSummary.totalRevenue)}</p>
                </div>
                <div className="bg-gray-50 px-5 py-3 rounded-xl border border-gray-100">
                  <p className="text-xs text-gray-500 font-semibold mb-1 uppercase tracking-wider">Avg Amount</p>
                  <p className="text-xl font-bold text-gray-900">{fmt(financeSummary.avgAmount)}</p>
                </div>
                <div className="bg-gray-50 px-5 py-3 rounded-xl border border-gray-100">
                  <p className="text-xs text-gray-500 font-semibold mb-1 uppercase tracking-wider">Platform Earnings</p>
                  <p className="text-xl font-bold text-purple-600">{fmt(financeSummary.platformEarnings)}</p>
                </div>
                <div className="bg-gray-50 px-5 py-3 rounded-xl border border-gray-100">
                  <p className="text-xs text-gray-500 font-semibold mb-1 uppercase tracking-wider">Driver Payout</p>
                  <p className="text-xl font-bold text-cyan-600">{fmt(financeSummary.driverPayouts)}</p>
                </div>
                <div className="bg-gray-50 px-5 py-3 rounded-xl border border-gray-100 flex-grow text-right">
                  <p className="text-xs text-gray-500 font-semibold mb-1 uppercase tracking-wider">Pending (Unpaid)</p>
                  <p className="text-xl font-bold text-orange-600">{fmt(financeSummary.pendingAmount)}</p>
                </div>
              </div>

              {/* Chart */}
              <div className="h-[400px] w-full min-w-0">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                    <BarChart
                      data={chartData}
                      margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                      <XAxis 
                        dataKey="date" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: '#6B7280', fontSize: 12 }} 
                        dy={10}
                      />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: '#6B7280', fontSize: 12 }}
                        tickFormatter={(val) => `₹${val}`}
                      />
                      <Tooltip 
                        cursor={{ fill: '#F3F4F6' }}
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        formatter={(value: any) => [`₹${Number(value).toLocaleString('en-IN')}`, undefined]}
                      />
                      <Legend 
                        wrapperStyle={{ paddingTop: '20px' }} 
                        iconType="circle"
                      />
                      <Bar dataKey="Revenue" fill="#10B981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="PlatformEarnings" name="Earnings" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="DriverPayout" name="Payout" fill="#06B6D4" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Pending" fill="#F97316" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 bg-gray-50/50 rounded-2xl border border-gray-100 border-dashed">
                    <Filter className="mb-2 opacity-50" size={32} />
                    <p>No financial data found for this period</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
