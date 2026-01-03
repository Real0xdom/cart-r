'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import Sidebar from '@/components/Sidebar';
import { 
  Users, 
  Truck, 
  Package, 
  IndianRupee, 
  Bike, 
  Car,
  ArrowRight
} from 'lucide-react';

interface Booking {
  id: string;
  booking_number: string;
  origin_address: string;
  destination_address: string;
  total_fare: number;
  driver_payout: number;
  status: string;
  vehicle_type: string;
  payment_status: string;
  created_at: string;
  customer?: { name: string };
  driver?: { user: { name: string } };
}

interface Stats {
  users: number;
  drivers: number;
  bookings: number;
  revenue: number;
  pendingBookings: number;
  onlineDrivers: number;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'pending': return 'bg-yellow-100 text-yellow-700';
    case 'accepted': return 'bg-emerald-100 text-emerald-700';
    case 'in_progress': return 'bg-green-100 text-green-700';
    case 'completed': return 'bg-gray-100 text-gray-700';
    case 'cancelled': return 'bg-red-100 text-red-700';
    default: return 'bg-gray-100 text-gray-600';
  }
};

export default function Home() {
  const [stats, setStats] = useState<Stats>({
    users: 0,
    drivers: 0,
    bookings: 0,
    revenue: 0,
    pendingBookings: 0,
    onlineDrivers: 0,
  });
  const [recentBookings, setRecentBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch counts
        const [usersRes, driversRes, bookingsRes, onlineDriversRes, pendingRes, completedRes] = await Promise.all([
          supabase.from('users').select('*', { count: 'exact', head: true }),
          supabase.from('drivers').select('*', { count: 'exact', head: true }),
          supabase.from('bookings').select('*', { count: 'exact', head: true }),
          supabase.from('drivers').select('*', { count: 'exact', head: true }).eq('is_online', true),
          supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
          supabase.from('bookings').select('total_fare').eq('status', 'completed'),
        ]);

        // Calculate total revenue
        const totalRevenue = (completedRes.data || []).reduce((sum, b) => sum + (b.total_fare || 0), 0);

        setStats({
          users: usersRes.count || 0,
          drivers: driversRes.count || 0,
          bookings: bookingsRes.count || 0,
          revenue: totalRevenue,
          pendingBookings: pendingRes.count || 0,
          onlineDrivers: onlineDriversRes.count || 0,
        });

        // Fetch recent bookings
        const { data: bookings } = await supabase
          .from('bookings')
          .select(`
            id,
            booking_number,
            origin_address,
            destination_address,
            total_fare,
            driver_payout,
            status,
            vehicle_type,
            payment_status,
            created_at,
            customer:users!bookings_customer_id_fkey(name),
            driver:drivers(user:users(name))
          `)
          .order('created_at', { ascending: false })
          .limit(10);

        // Transform Supabase's array joins into single objects
        const transformedBookings = (bookings || []).map((b: any) => ({
          ...b,
          customer: Array.isArray(b.customer) ? b.customer[0] : b.customer,
          driver: Array.isArray(b.driver) ? b.driver[0] : b.driver,
        })) as Booking[];

        setRecentBookings(transformedBookings);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      }
      setLoading(false);
      setLastUpdated(new Date().toLocaleTimeString());
    }

    fetchData();

    // Set up real-time subscription for new bookings
    const subscription = supabase
      .channel('admin-bookings')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'bookings' },
        (payload) => {
          setRecentBookings(prev => [payload.new as Booking, ...prev.slice(0, 9)]);
          setStats(prev => ({
            ...prev,
            bookings: prev.bookings + 1,
            pendingBookings: prev.pendingBookings + 1,
          }));
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <div className="min-h-screen bg-[var(--color-brand-cream)] font-sans">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className="ml-72 p-8 max-w-[1600px]">
        <div className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-1">Dashboard</h1>
            <p className="text-gray-500 text-sm">Welcome back, here's what's happening today.</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500 bg-white px-3 py-1.5 rounded-full border border-gray-100 shadow-sm">
              Last updated: {lastUpdated || '...'}
            </span>
            {stats.pendingBookings > 0 && (
              <span className="px-4 py-2 bg-orange-100 text-orange-700 rounded-xl text-sm font-semibold animate-pulse shadow-sm border border-orange-200">
                {stats.pendingBookings} pending bookings
              </span>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow group">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-emerald-50 rounded-xl group-hover:bg-emerald-100 transition-colors">
                <Users size={22} className="text-emerald-600" />
              </div>
              <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-1 rounded-lg">Active</span>
            </div>
            <h3 className="text-gray-500 text-sm font-medium mb-1">Total Users</h3>
            <p className="text-3xl font-bold text-gray-900 tracking-tight">
              {loading ? '...' : stats.users.toLocaleString()}
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow group">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-orange-50 rounded-xl group-hover:bg-orange-100 transition-colors">
                <Truck size={22} className="text-orange-600" />
              </div>
              <span className="text-xs font-semibold text-orange-600 bg-orange-50 px-2 py-1 rounded-lg">
                {stats.onlineDrivers} Online
              </span>
            </div>
            <h3 className="text-gray-500 text-sm font-medium mb-1">Drivers</h3>
            <p className="text-3xl font-bold text-gray-900 tracking-tight">
              {loading ? '...' : stats.drivers.toLocaleString()}
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow group">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-green-50 rounded-xl group-hover:bg-green-100 transition-colors">
                <Package size={22} className="text-green-600" />
              </div>
              {stats.pendingBookings > 0 && (
                <span className="text-xs font-semibold text-orange-600 bg-orange-50 px-2 py-1 rounded-lg">
                  {stats.pendingBookings} New
                </span>
              )}
            </div>
            <h3 className="text-gray-500 text-sm font-medium mb-1">Total Bookings</h3>
            <p className="text-3xl font-bold text-gray-900 tracking-tight">
              {loading ? '...' : stats.bookings.toLocaleString()}
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow group">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-purple-50 rounded-xl group-hover:bg-purple-100 transition-colors">
                <IndianRupee size={22} className="text-purple-600" />
              </div>
              <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-1 rounded-lg">+12%</span>
            </div>
            <h3 className="text-gray-500 text-sm font-medium mb-1">Total Revenue</h3>
            <p className="text-3xl font-bold text-gray-900 tracking-tight">
              ₹{loading ? '...' : stats.revenue.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Recent Bookings */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-white">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Recent Bookings</h2>
              <p className="text-sm text-gray-500">Latest ride requests and updates</p>
            </div>
            <Link 
              href="/bookings" 
              className="px-5 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 transition shadow-lg shadow-gray-200"
            >
              View All Bookings
            </Link>
          </div>
          
          {loading ? (
            <div className="p-12 text-center text-gray-500">
              <div className="animate-spin w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full mx-auto mb-4"/>
              Loading data...
            </div>
          ) : recentBookings.length === 0 ? (
            <div className="p-12 text-center text-gray-500 bg-gray-50/50">No bookings yet</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50/50">
                  <tr>
                    <th className="px-8 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Booking Info</th>
                    <th className="px-8 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Route Details</th>
                    <th className="px-8 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-8 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Payment</th>
                    <th className="px-8 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {recentBookings.map((booking) => (
                    <tr key={booking.id} className="hover:bg-gray-50/80 transition-colors group">
                      <td className="px-8 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center">
                            {booking.vehicle_type === 'bike' ? <Bike size={20} className="text-orange-600" /> : <Car size={20} className="text-orange-600" />}
                          </div>
                          <div>
                            <div className="text-sm font-bold text-gray-900">
                              {booking.booking_number}
                            </div>
                            <div className="text-xs text-gray-500 capitalize font-medium">
                              {booking.vehicle_type}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-4">
                        <div className="max-w-[250px]">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="w-2 h-2 rounded-full bg-green-500 shrink-0"/>
                            <div className="text-sm text-gray-900 truncate font-medium">
                              {booking.origin_address}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-red-500 shrink-0"/>
                             <div className="text-xs text-gray-500 truncate">
                              {booking.destination_address}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold capitalize shadow-sm border ${
                          booking.status === 'completed' ? 'bg-green-50 text-green-700 border-green-100' :
                          booking.status === 'cancelled' ? 'bg-red-50 text-red-700 border-red-100' :
                          booking.status === 'pending' ? 'bg-yellow-50 text-yellow-700 border-yellow-100' :
                          'bg-emerald-50 text-emerald-700 border-emerald-100'
                        }`}>
                          {booking.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-8 py-4">
                        <div className="text-sm font-bold text-gray-900">
                          ₹{booking.total_fare}
                        </div>
                        <div className={`text-xs font-medium capitalize ${
                          booking.payment_status === 'paid' ? 'text-green-600' : 'text-orange-500'
                        }`}>
                          {booking.payment_status}
                        </div>
                      </td>
                      <td className="px-8 py-4 text-xs font-medium text-gray-500">
                        {new Date(booking.created_at).toLocaleString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
