'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Sidebar from '@/components/Sidebar';
import { IndianRupee, Package, Truck, CheckCircle } from 'lucide-react';

interface AnalyticsData {
  totalBookings: number;
  completedTrips: number;
  activeDrivers: number;
  totalRevenue: number;
  pendingVerifications: number;
  openTickets: number;
  todayBookings: number;
  todayRevenue: number;
  weeklyData: { date: string; bookings: number; revenue: number }[];
  vehicleTypeBreakdown: { type: string; count: number }[];
  recentBookings: any[];
}

export default function AnalyticsDashboard() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'today' | 'week' | 'month'>('week');

  useEffect(() => {
    fetchAnalytics();
  }, [timeRange]);

  async function fetchAnalytics() {
    setLoading(true);
    try {
      // Get date ranges
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

      // Total bookings
      const { count: totalBookings } = await supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true });

      // Completed trips
      const { count: completedTrips } = await supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'completed');

      // Active drivers (online)
      const { count: activeDrivers } = await supabase
        .from('drivers')
        .select('*', { count: 'exact', head: true })
        .eq('is_online', true);

      // Total revenue
      const { data: revenueData } = await supabase
        .from('bookings')
        .select('total_fare')
        .eq('status', 'completed');
      const totalRevenue = revenueData?.reduce((sum, b) => sum + (b.total_fare || 0), 0) || 0;

      // Pending verifications
      const { count: pendingVerifications } = await supabase
        .from('drivers')
        .select('*', { count: 'exact', head: true })
        .eq('verification_status', 'pending');

      // Open support tickets
      const { count: openTickets } = await supabase
        .from('support_tickets')
        .select('*', { count: 'exact', head: true })
        .in('status', ['open', 'in_progress']);

      // Today's bookings
      const { count: todayBookings } = await supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', today);

      // Today's revenue
      const { data: todayRevenueData } = await supabase
        .from('bookings')
        .select('total_fare')
        .eq('status', 'completed')
        .gte('created_at', today);
      const todayRevenue = todayRevenueData?.reduce((sum, b) => sum + (b.total_fare || 0), 0) || 0;

      // Weekly data for chart
      const weeklyData = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const dateStr = date.toISOString().split('T')[0];
        const nextDate = new Date(date.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        
        const { count: dayBookings } = await supabase
          .from('bookings')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', dateStr)
          .lt('created_at', nextDate);

        const { data: dayRevenue } = await supabase
          .from('bookings')
          .select('total_fare')
          .eq('status', 'completed')
          .gte('created_at', dateStr)
          .lt('created_at', nextDate);

        weeklyData.push({
          date: date.toLocaleDateString('en-US', { weekday: 'short' }),
          bookings: dayBookings || 0,
          revenue: dayRevenue?.reduce((sum, b) => sum + (b.total_fare || 0), 0) || 0,
        });
      }

      // Vehicle type breakdown
      const { data: vehicleData } = await supabase
        .from('bookings')
        .select('vehicle_type')
        .eq('status', 'completed');
      
      const vehicleCounts: Record<string, number> = {};
      vehicleData?.forEach((b) => {
        vehicleCounts[b.vehicle_type] = (vehicleCounts[b.vehicle_type] || 0) + 1;
      });
      const vehicleTypeBreakdown = Object.entries(vehicleCounts).map(([type, count]) => ({
        type,
        count,
      }));

      // Recent bookings
      const { data: recentBookings } = await supabase
        .from('bookings')
        .select(`
          *,
          customer:users!bookings_customer_id_fkey(name, phone),
          driver:drivers(vehicle_number, user:users!drivers_user_id_fkey(name))
        `)
        .order('created_at', { ascending: false })
        .limit(10);

      setData({
        totalBookings: totalBookings || 0,
        completedTrips: completedTrips || 0,
        activeDrivers: activeDrivers || 0,
        totalRevenue,
        pendingVerifications: pendingVerifications || 0,
        openTickets: openTickets || 0,
        todayBookings: todayBookings || 0,
        todayRevenue,
        weeklyData,
        vehicleTypeBreakdown,
        recentBookings: recentBookings || [],
      });
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  }

  const formatCurrency = (amount: number) => {
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  if (loading || !data) {
    return (
      <div className="min-h-screen bg-[var(--color-brand-cream)] font-sans">
        <Sidebar />
        <div className="ml-72 p-8 flex items-center justify-center">
          <div className="animate-spin w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-brand-cream)] font-sans">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className="ml-72 p-8 max-w-[1600px]">
        {/* Header */}
        <div className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-1">Analytics</h1>
            <p className="text-gray-500 text-sm">Real-time business insights</p>
          </div>
          <div className="flex gap-2">
            {(['today', 'week', 'month'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-5 py-2.5 rounded-xl font-medium transition-all shadow-sm ${
                  timeRange === range
                    ? 'bg-orange-500 text-white shadow-orange-500/20'
                    : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-100'
                }`}
              >
                {range.charAt(0).toUpperCase() + range.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            title="Total Revenue"
            value={formatCurrency(data.totalRevenue)}
            subtitle={`Today: ${formatCurrency(data.todayRevenue)}`}
            icon={<IndianRupee size={24} />}
            color="green"
          />
          <StatCard
            title="Total Bookings"
            value={data.totalBookings.toString()}
            subtitle={`Today: ${data.todayBookings}`}
            icon={<Package size={24} />}
            color="orange"
          />
          <StatCard
            title="Active Drivers"
            value={data.activeDrivers.toString()}
            subtitle={`${data.pendingVerifications} pending verification`}
            icon={<Truck size={24} />}
            color="purple"
          />
          <StatCard
            title="Completed Trips"
            value={data.completedTrips.toString()}
            subtitle={`${Math.round((data.completedTrips / (data.totalBookings || 1)) * 100)}% completion rate`}
            icon={<CheckCircle size={24} />}
            color="emerald"
          />
        </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Weekly Trend */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <h3 className="text-gray-900 font-semibold mb-4">Weekly Trend</h3>
          <div className="h-48 flex items-end justify-between gap-2">
            {data.weeklyData.map((day, i) => (
              <div key={i} className="flex-1 flex flex-col items-center">
                <div
                  className="w-full bg-gray-900 rounded-t"
                  style={{ height: `${(day.bookings / Math.max(...data.weeklyData.map(d => d.bookings), 1)) * 100}%`, minHeight: '4px' }}
                />
                <span className="text-xs text-gray-500 mt-2">{day.date}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Vehicle Type Breakdown */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <h3 className="text-gray-900 font-semibold mb-4">Vehicle Types</h3>
          <div className="space-y-4">
            {data.vehicleTypeBreakdown.map((item) => (
              <div key={item.type} className="flex items-center justify-between">
                <span className="text-gray-700 capitalize">{item.type}</span>
                <div className="flex items-center gap-2">
                  <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gray-900 rounded-full"
                      style={{ width: `${(item.count / (data.completedTrips || 1)) * 100}%` }}
                    />
                  </div>
                  <span className="text-gray-500 text-sm w-8">{item.count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Alerts Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {data.pendingVerifications > 0 && (
          <AlertCard
            title="Pending Verifications"
            count={data.pendingVerifications}
            link="/drivers?filter=pending"
            color="yellow"
          />
        )}
        {data.openTickets > 0 && (
          <AlertCard
            title="Open Tickets"
            count={data.openTickets}
            link="/support"
            color="red"
          />
        )}
      </div>

      {/* Recent Bookings */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
        <h3 className="text-gray-900 font-semibold mb-4">Recent Bookings</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-gray-500 text-sm border-b border-gray-200">
                <th className="pb-3">Customer</th>
                <th className="pb-3">Vehicle</th>
                <th className="pb-3">Fare</th>
                <th className="pb-3">Status</th>
                <th className="pb-3">Time</th>
              </tr>
            </thead>
            <tbody>
              {data.recentBookings.map((booking) => (
                <tr key={booking.id} className="border-b border-gray-100">
                  <td className="py-3 text-gray-900">{booking.customer?.name || 'N/A'}</td>
                  <td className="py-3 text-gray-600 capitalize">{booking.vehicle_type}</td>
                  <td className="py-3 text-green-600 font-medium">{formatCurrency(booking.total_fare)}</td>
                  <td className="py-3">
                    <StatusBadge status={booking.status} />
                  </td>
                  <td className="py-3 text-gray-500 text-sm">
                    {new Date(booking.created_at).toLocaleTimeString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, subtitle, icon, color }: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  color: 'green' | 'orange' | 'purple' | 'emerald';
}) {
  const colors = {
    green: 'bg-green-50 border-green-200 text-green-600',
    orange: 'bg-orange-50 border-orange-200 text-orange-600',
    purple: 'bg-purple-50 border-purple-200 text-purple-600',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-600',
  };

  return (
    <div className={`${colors[color].split(' ').slice(0, 2).join(' ')} border rounded-2xl p-6 shadow-sm`}>
      <div className="flex justify-between items-start mb-4">
        <span className="text-gray-600 text-sm font-medium">{title}</span>
        <div className={colors[color].split(' ')[2]}>
          {icon}
        </div>
      </div>
      <div className="text-3xl font-bold text-gray-900 mb-1">{value}</div>
      <div className="text-gray-500 text-sm">{subtitle}</div>
    </div>
  );
}

function AlertCard({ title, count, link, color }: {
  title: string;
  count: number;
  link: string;
  color: 'yellow' | 'red';
}) {
  const colors = {
    yellow: 'bg-yellow-500/20 border-yellow-500/30 text-yellow-400',
    red: 'bg-red-500/20 border-red-500/30 text-red-400',
  };

  return (
    <a href={link} className={`${colors[color]} border rounded-xl p-4 flex justify-between items-center hover:opacity-80 transition-opacity`}>
      <div>
        <div className="font-semibold">{title}</div>
        <div className="text-sm opacity-80">Requires attention</div>
      </div>
      <div className="text-3xl font-bold">{count}</div>
    </a>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: 'bg-yellow-500/20 text-yellow-400',
    accepted: 'bg-emerald-500/20 text-emerald-400',
    driver_arrived: 'bg-purple-500/20 text-purple-400',
    in_progress: 'bg-indigo-500/20 text-indigo-400',
    completed: 'bg-green-500/20 text-green-400',
    cancelled: 'bg-red-500/20 text-red-400',
  };

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-500/20 text-gray-400'}`}>
      {status.replace('_', ' ')}
    </span>
  );
}
