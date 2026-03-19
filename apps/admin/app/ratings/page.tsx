'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Sidebar from '@/components/Sidebar';
import { Star, Search, Filter, RefreshCw, User, ChevronDown } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface Rating {
  id: string;
  booking_id: string;
  rating: number;
  review: string | null;
  rater_type: string;
  created_at: string;
  booking: {
    booking_number: string;
    origin_address?: string;
    destination_address?: string;
  } | null;
  from_user: {
    name: string;
    email: string;
  } | null;
  to_user: {
    name: string;
    email: string;
  } | null;
}

interface RatingStats {
  totalRatings: number;
  avgCustomerRating: number;
  avgDriverRating: number;
  ratingsToday: number;
}

const ratingFilters = [
  { value: 'all', label: 'All Ratings' },
  { value: 'customer', label: 'Customer → Driver' },
  { value: 'driver', label: 'Driver → Customer' },
];

const starFilters = [
  { value: 0, label: 'All Stars' },
  { value: 5, label: '5 Stars' },
  { value: 4, label: '4 Stars' },
  { value: 3, label: '3 Stars' },
  { value: 2, label: '2 Stars' },
  { value: 1, label: '1 Star' },
];

function StarDisplay({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          size={14}
          className={s <= rating ? 'text-yellow-500 fill-yellow-500' : 'text-gray-200'}
        />
      ))}
      <span className="ml-1.5 text-sm font-bold text-gray-900">{rating}.0</span>
    </div>
  );
}

export default function RatingsPage() {
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [starFilter, setStarFilter] = useState(0);
  const [stats, setStats] = useState<RatingStats>({
    totalRatings: 0,
    avgCustomerRating: 0,
    avgDriverRating: 0,
    ratingsToday: 0,
  });

  useEffect(() => {
    fetchRatings();
    fetchStats();
  }, [typeFilter, starFilter]);

  async function fetchStats() {
    try {
      const { data: allRatings, error } = await supabase
        .from('ratings')
        .select('rating, rater_type, created_at');

      if (error) throw error;
      if (!allRatings) return;

      const today = new Date().toISOString().split('T')[0];
      const customerRatings = allRatings.filter((r: any) => r.rater_type === 'customer');
      const driverRatings = allRatings.filter((r: any) => r.rater_type === 'driver');
      const todayRatings = allRatings.filter((r: any) => r.created_at?.startsWith(today));

      setStats({
        totalRatings: allRatings.length,
        avgCustomerRating: customerRatings.length > 0
          ? Number((customerRatings.reduce((a, r) => a + r.rating, 0) / customerRatings.length).toFixed(1))
          : 0,
        avgDriverRating: driverRatings.length > 0
          ? Number((driverRatings.reduce((a, r) => a + r.rating, 0) / driverRatings.length).toFixed(1))
          : 0,
        ratingsToday: todayRatings.length,
      });
    } catch (error: any) {
      console.error('Failed to load stats:', error.message);
    }
  }

  async function fetchRatings() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (typeFilter !== 'all') params.set('type', typeFilter);
      if (starFilter > 0) params.set('star', String(starFilter));
      const res = await fetch(`/api/ratings?${params.toString()}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || res.statusText);
      }
      const data = await res.json();
      setRatings(Array.isArray(data) ? data : []);
    } catch (error: any) {
      toast.error('Failed to load ratings: ' + (error.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  }

  const filteredRatings = searchTerm
    ? ratings.filter(r =>
        r.from_user?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.to_user?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.booking?.booking_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.review?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : ratings;

  return (
    <div className="min-h-screen bg-[var(--color-brand-cream)] font-sans">
      <Sidebar />
      <div className="ml-72 p-8 max-w-[1600px]">
        {/* Header */}
        <div className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-1">Ratings</h1>
            <p className="text-gray-500 text-sm">View all customer and driver ratings</p>
          </div>
          <button
            onClick={() => { fetchRatings(); fetchStats(); }}
            className="px-4 py-2.5 bg-white text-gray-600 rounded-xl font-semibold shadow-sm border border-gray-200 hover:bg-gray-50 transition-all flex items-center gap-2"
          >
            <RefreshCw size={16} /> Refresh
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-yellow-50 flex items-center justify-center">
                <Star size={20} className="text-yellow-600 fill-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.totalRatings}</p>
                <p className="text-xs text-gray-500">Total Ratings</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-lg">👤</div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.avgCustomerRating || '—'}</p>
                <p className="text-xs text-gray-500">Avg Customer Rating</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center text-lg">🚗</div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.avgDriverRating || '—'}</p>
                <p className="text-xs text-gray-500">Avg Driver Rating</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center text-lg">📊</div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.ratingsToday}</p>
                <p className="text-xs text-gray-500">Ratings Today</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-8">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search size={18} className="absolute left-4 top-3 text-gray-400" />
              <input
                type="text"
                placeholder="Search by user name, booking number, or review text..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-11 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white transition-all text-sm"
              />
            </div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              {ratingFilters.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
            <select
              value={starFilter}
              onChange={(e) => setStarFilter(Number(e.target.value))}
              className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              {starFilters.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Ratings Table */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="py-12 flex justify-center">
              <div className="animate-spin w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full" />
            </div>
          ) : filteredRatings.length === 0 ? (
            <div className="py-12 text-center text-gray-500">No ratings found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50/50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Booking</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">From</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">To</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Rating</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Review</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredRatings.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <span className="px-2.5 py-1 bg-gray-100 text-gray-700 rounded-lg text-xs font-mono font-medium">
                          {r.booking?.booking_number || '—'}
                        </span>
                      </td>
                      <td className="px-6 py-4 max-w-[220px]">
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {r.from_user?.name ?? '—'}
                          </p>
                          {r.from_user?.email && (
                            <p className="text-[10px] text-gray-500 truncate">{r.from_user.email}</p>
                          )}
                          {r.booking?.origin_address && (
                            <p className="text-[10px] text-gray-400 truncate mt-0.5" title={r.booking.origin_address}>
                              {r.booking.origin_address}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 max-w-[220px]">
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {r.to_user?.name ?? '—'}
                          </p>
                          {r.to_user?.email && (
                            <p className="text-[10px] text-gray-500 truncate">{r.to_user.email}</p>
                          )}
                          {r.booking?.destination_address && (
                            <p className="text-[10px] text-gray-400 truncate mt-0.5" title={r.booking.destination_address}>
                              {r.booking.destination_address}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                          r.rater_type === 'customer'
                            ? 'bg-blue-50 text-blue-700'
                            : 'bg-green-50 text-green-700'
                        }`}>
                          {r.rater_type === 'customer' ? 'Customer → Driver' : 'Driver → Customer'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <StarDisplay rating={r.rating} />
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-gray-600 max-w-[200px] truncate" title={r.review || ''}>
                          {r.review || <span className="text-gray-300 italic">No review</span>}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-xs text-gray-500 whitespace-nowrap">
                        {new Date(r.created_at).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
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
