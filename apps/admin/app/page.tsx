'use client';

import { useEffect, useEffectEvent, useMemo, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  CheckCircle,
  Filter,
  LifeBuoy,
  Package,
  Star,
  TrendingUp,
  Truck,
  Users,
} from 'lucide-react';

import { getDashboardFinanceData, getDashboardOverviewStats, type DashboardFinanceData, type DashboardStats } from '@/app/actions/dashboard';
import Sidebar from '@/components/Sidebar';
import { useRole } from '@/contexts/RoleContext';

interface ChartDataPoint {
  date: string;
  sortDate: string;
  Revenue: number;
  PlatformEarnings: number;
  DriverPayout: number;
}

const DASHBOARD_THEME = {
  greenDark: '#14532D',
  green: '#166534',
  greenSoft: '#DCFCE7',
  orangeDark: '#9A3412',
  orange: '#C2410C',
  orangeSoft: '#FFEDD5',
  grid: '#E7E5E4',
  textMuted: '#6B7280',
  tooltipCursor: '#F6F6F2',
} as const;

export default function Home() {
  const { role, loading: roleLoading } = useRole();
  const canSeeFinance = role === 'admin' || role === 'superadmin';

  const [stats, setStats] = useState<DashboardStats>({
    recentBookings: 0,
    newDriverRequests: 0,
    newUsers: 0,
    totalDrivers: 0,
    totalRatings: 0,
    openTickets: 0,
  });
  const [financeData, setFinanceData] = useState<DashboardFinanceData>({ invoices: [], successfulPayouts: [] });
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [dateRange, setDateRange] = useState<'today' | '7d' | '30d' | '90d' | 'all'>('all');

  const fetchOverviewStats = useEffectEvent(async () => {
    try {
      const data = await getDashboardOverviewStats();
      setStats(data);
    } catch (error) {
      console.error('Error fetching overview stats:', error);
    }
  });

  const fetchFinanceData = useEffectEvent(async (range: typeof dateRange) => {
    try {
      const data = await getDashboardFinanceData(range);
      setFinanceData(data);
    } catch (error) {
      console.error('Error fetching finance data:', error);
    }
  });

  useEffect(() => {
    const loadAll = async () => {
      if (roleLoading || !role) {
        return;
      }

      setLoading(true);
      await fetchOverviewStats();
      if (canSeeFinance) {
        await fetchFinanceData(dateRange);
      } else {
        setFinanceData({ invoices: [], successfulPayouts: [] });
      }
      setLoading(false);
      setLastUpdated(new Date().toLocaleTimeString());
    };

    loadAll();
  }, [dateRange, canSeeFinance, role, roleLoading]);

  const financeSummary = useMemo(() => {
    const paidInvoices = financeData.invoices;
    const successfulPayouts = financeData.successfulPayouts;

    const totalRevenue = paidInvoices.reduce((sum, invoice) => sum + Number(invoice.total_amount || 0), 0);
    const platformEarnings = paidInvoices.reduce((sum, invoice) => sum + Number(invoice.platform_fee || 0), 0);
    const driverPayouts = successfulPayouts.reduce((sum, payout) => sum + Number(payout.amount || 0), 0);
    const avgAmount = paidInvoices.length > 0 ? totalRevenue / paidInvoices.length : 0;

    return {
      totalRevenue,
      avgAmount: Math.round(avgAmount),
      platformEarnings,
      driverPayouts,
    };
  }, [financeData]);

  const chartData = useMemo(() => {
    const dailyData: Record<string, ChartDataPoint> = {};

    financeData.invoices.forEach((invoice) => {
      const createdAt = new Date(invoice.created_at);
      const sortDate = format(createdAt, 'yyyy-MM-dd');

      if (!dailyData[sortDate]) {
        dailyData[sortDate] = {
          date: format(createdAt, 'MMM dd'),
          sortDate,
          Revenue: 0,
          PlatformEarnings: 0,
          DriverPayout: 0,
        };
      }

      dailyData[sortDate].Revenue += Number(invoice.total_amount || 0);
      dailyData[sortDate].PlatformEarnings += Number(invoice.platform_fee || 0);
    });

    financeData.successfulPayouts.forEach((payout) => {
      const createdAt = new Date(payout.created_at);
      const sortDate = format(createdAt, 'yyyy-MM-dd');

      if (!dailyData[sortDate]) {
        dailyData[sortDate] = {
          date: format(createdAt, 'MMM dd'),
          sortDate,
          Revenue: 0,
          PlatformEarnings: 0,
          DriverPayout: 0,
        };
      }

      dailyData[sortDate].DriverPayout += Number(payout.amount || 0);
    });

    return Object.values(dailyData).sort((a, b) => a.sortDate.localeCompare(b.sortDate));
  }, [financeData]);

  const fmt = (amount: number) => `Rs. ${Number(amount).toLocaleString('en-IN')}`;

  return (
    <div className="min-h-screen bg-[var(--color-brand-cream)] font-sans">
      <Sidebar />

      <div className="ml-72 max-w-[1600px] p-8">
        <div className="mb-10 flex items-center justify-between">
          <div>
            <h1 className="mb-1 text-3xl font-bold text-gray-900">Dashboard Overview</h1>
            <p className="text-sm text-gray-500">Key metrics and platform health at a glance.</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="rounded-full border border-gray-100 bg-white px-3 py-1.5 text-sm text-gray-500 shadow-sm">
              Last updated: {lastUpdated || '...'}
            </span>
          </div>
        </div>

        <div className="mb-10 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
          <Link href="/bookings" className="group block cursor-pointer rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
            <div className="mb-4 flex items-start justify-between">
              <div className="rounded-xl bg-emerald-50 p-3 transition-colors group-hover:bg-emerald-100">
                <Package size={22} className="text-emerald-600" />
              </div>
              <span className="rounded-lg bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-600">Last 24h</span>
            </div>
            <h3 className="mb-1 text-sm font-medium text-gray-500">Recent Bookings</h3>
            <p className="text-3xl font-bold tracking-tight text-gray-900">
              {loading ? '...' : stats.recentBookings.toLocaleString()}
            </p>
          </Link>

          <Link href="/drivers" className="group block cursor-pointer rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
            <div className="mb-4 flex items-start justify-between">
              <div className="rounded-xl bg-orange-50 p-3 transition-colors group-hover:bg-orange-100">
                <CheckCircle size={22} className="text-orange-600" />
              </div>
              <span className="rounded-lg bg-orange-50 px-2 py-1 text-xs font-semibold text-orange-600">Action Needed</span>
            </div>
            <h3 className="mb-1 text-sm font-medium text-gray-500">Driver Verification Reqs</h3>
            <p className="text-3xl font-bold tracking-tight text-orange-600">
              {loading ? '...' : stats.newDriverRequests.toLocaleString()}
            </p>
          </Link>

          <Link href="/users" className="group block cursor-pointer rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
            <div className="mb-4 flex items-start justify-between">
              <div className="rounded-xl bg-blue-50 p-3 transition-colors group-hover:bg-blue-100">
                <Users size={22} className="text-blue-600" />
              </div>
              <span className="rounded-lg bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-600">Last 7d</span>
            </div>
            <h3 className="mb-1 text-sm font-medium text-gray-500">New Users</h3>
            <p className="text-3xl font-bold tracking-tight text-gray-900">
              {loading ? '...' : stats.newUsers.toLocaleString()}
            </p>
          </Link>

          <Link href="/drivers" className="group block cursor-pointer rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
            <div className="mb-4 flex items-start justify-between">
              <div className="rounded-xl bg-indigo-50 p-3 transition-colors group-hover:bg-indigo-100">
                <Truck size={22} className="text-indigo-600" />
              </div>
              <span className="rounded-lg bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-600">All Time</span>
            </div>
            <h3 className="mb-1 text-sm font-medium text-gray-500">Total Drivers</h3>
            <p className="text-3xl font-bold tracking-tight text-gray-900">
              {loading ? '...' : stats.totalDrivers.toLocaleString()}
            </p>
          </Link>

          <Link href="/ratings" className="group block cursor-pointer rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
            <div className="mb-4 flex items-start justify-between">
              <div className="rounded-xl bg-yellow-50 p-3 transition-colors group-hover:bg-yellow-100">
                <Star size={22} className="text-yellow-600" />
              </div>
              <span className="rounded-lg bg-yellow-50 px-2 py-1 text-xs font-semibold text-yellow-600">All Time</span>
            </div>
            <h3 className="mb-1 text-sm font-medium text-gray-500">Total Ratings</h3>
            <p className="text-3xl font-bold tracking-tight text-gray-900">
              {loading ? '...' : stats.totalRatings.toLocaleString()}
            </p>
          </Link>

          <Link href="/support" className="group block cursor-pointer rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
            <div className="mb-4 flex items-start justify-between">
              <div className="rounded-xl bg-red-50 p-3 transition-colors group-hover:bg-red-100">
                <LifeBuoy size={22} className="text-red-600" />
              </div>
              {stats.openTickets > 0 && (
                <span className="animate-pulse rounded-lg bg-red-50 px-2 py-1 text-xs font-semibold text-red-600">Needs Attention</span>
              )}
            </div>
            <h3 className="mb-1 text-sm font-medium text-gray-500">Open Support Tickets</h3>
            <p className="text-3xl font-bold tracking-tight text-gray-900">
              {loading ? '...' : stats.openTickets.toLocaleString()}
            </p>
          </Link>
        </div>

        {canSeeFinance && !roleLoading && (
          <div className="rounded-3xl border border-gray-100 bg-white p-8 shadow-sm">
            <div className="mb-8 flex flex-col items-start justify-between gap-4 lg:flex-row lg:items-center">
              <div>
                <h2 className="flex items-center gap-2 text-xl font-bold text-gray-900">
                  <TrendingUp size={20} className="text-green-800" />
                  Financial Analytics
                </h2>
                <p className="mt-1 text-sm text-gray-500">Paid invoice revenue and successful driver payouts</p>
              </div>

              <div className="flex items-center gap-2 rounded-xl border border-gray-100 bg-gray-50 p-1.5">
                {(['today', '7d', '30d', '90d', 'all'] as const).map((range) => (
                  <button
                    key={range}
                    onClick={() => setDateRange(range)}
                    className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
                      dateRange === range
                        ? 'border border-green-200 bg-white text-green-900 shadow-sm'
                        : 'text-gray-500 hover:bg-gray-100/50 hover:text-gray-900'
                    }`}
                  >
                    {range === 'today'
                      ? 'Today'
                      : range === '7d'
                        ? '7 Days'
                        : range === '30d'
                          ? '30 Days'
                          : range === '90d'
                            ? '3 Months'
                            : 'All Time'}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="flex h-[400px] items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
              </div>
            ) : (
              <>
                <div className="mb-8 flex flex-wrap gap-4">
                  <div
                    className="rounded-xl border px-5 py-3"
                    style={{ backgroundColor: DASHBOARD_THEME.greenSoft, borderColor: '#BBF7D0' }}
                  >
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-500">Total Revenue</p>
                    <p className="text-xl font-bold text-green-900">{fmt(financeSummary.totalRevenue)}</p>
                  </div>
                  <div className="rounded-xl border border-gray-100 bg-gray-50 px-5 py-3">
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-500">Avg Amount</p>
                    <p className="text-xl font-bold text-gray-900">{fmt(financeSummary.avgAmount)}</p>
                  </div>
                  <div
                    className="rounded-xl border px-5 py-3"
                    style={{ backgroundColor: '#F0FDF4', borderColor: '#D1FAE5' }}
                  >
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-500">Platform Earnings</p>
                    <p className="text-xl font-bold" style={{ color: DASHBOARD_THEME.green }}>
                      {fmt(financeSummary.platformEarnings)}
                    </p>
                  </div>
                  <div
                    className="rounded-xl border px-5 py-3"
                    style={{ backgroundColor: '#FFF7ED', borderColor: '#FED7AA' }}
                  >
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-500">Driver Payout</p>
                    <p className="text-xl font-bold" style={{ color: DASHBOARD_THEME.orange }}>
                      {fmt(financeSummary.driverPayouts)}
                    </p>
                  </div>
                </div>

                <div className="h-[400px] w-full">
                  {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid stroke={DASHBOARD_THEME.grid} strokeDasharray="3 3" vertical={false} />
                        <XAxis
                          dataKey="date"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: DASHBOARD_THEME.textMuted, fontSize: 12 }}
                          dy={10}
                        />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: DASHBOARD_THEME.textMuted, fontSize: 12 }}
                          tickFormatter={(value) => `Rs.${value}`}
                        />
                        <Tooltip
                          cursor={{ fill: DASHBOARD_THEME.tooltipCursor }}
                          contentStyle={{
                            borderRadius: '12px',
                            border: '1px solid #E7E5E4',
                            boxShadow: '0 10px 30px -12px rgb(0 0 0 / 0.18)',
                          }}
                          formatter={(value) => [fmt(Number(value ?? 0)), '']}
                        />
                        <Legend wrapperStyle={{ paddingTop: '20px', color: DASHBOARD_THEME.textMuted }} iconType="circle" />
                        <Bar dataKey="Revenue" fill={DASHBOARD_THEME.greenDark} radius={[4, 4, 0, 0]} />
                        <Bar dataKey="PlatformEarnings" name="Earnings" fill={DASHBOARD_THEME.green} radius={[4, 4, 0, 0]} />
                        <Bar dataKey="DriverPayout" name="Driver Payout" fill={DASHBOARD_THEME.orange} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center rounded-2xl border border-dashed border-gray-100 bg-gray-50/50 text-gray-400">
                      <Filter className="mb-2 opacity-50" size={32} />
                      <p>No financial data found for this period</p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
