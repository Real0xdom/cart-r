'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import { RefreshCw, Bell, Users, Truck, Star, ArrowRight } from 'lucide-react';

interface Driver {
  id: string;
  user_id: string;
  vehicle_type: string;
  vehicle_number: string;
  vehicle_model: string;
  verification_status: 'pending' | 'approved' | 'rejected';
  rating: number;
  total_trips: number;
  total_earnings: number;
  is_online: boolean;
  created_at: string;
  user: {
    name: string;
    email: string;
    phone: string;
  };
}

export default function DriversPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected' | 'resubmissions'>('all');

  useEffect(() => {
    fetchDrivers();
  }, [filter]);

  async function fetchDrivers() {
    setLoading(true);
    try {
      const response = await fetch(`/api/drivers?filter=${filter}`);
      const data = await response.json();
      
      if (!response.ok) {
        console.error('Error fetching drivers:', data.error);
      } else {
        setDrivers(data || []);
      }
    } catch (error) {
      console.error('Error fetching drivers:', error);
    }
    setLoading(false);
  }

  const getStatusBadge = (status: string) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
    };
    return styles[status as keyof typeof styles] || 'bg-gray-100 text-gray-800';
  };

  const pendingCount = drivers.filter(d => d.verification_status === 'pending').length;

  return (
    <div className="min-h-screen bg-[var(--color-brand-cream)] font-sans">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className="ml-72 p-8 max-w-[1600px]">
        <div className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-1">Drivers</h1>
            <p className="text-gray-500 text-sm">Manage and verify driver applications</p>
          </div>
          <div className="flex items-center gap-4">
            {pendingCount > 0 && (
              <span className="flex items-center gap-2 px-4 py-2 bg-orange-100 text-orange-700 rounded-xl text-sm font-semibold animate-pulse shadow-sm border border-orange-200">
                <Bell size={16} /> {pendingCount} pending verification{pendingCount > 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-8">
          {['all', 'pending', 'approved', 'rejected', 'resubmissions'].map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status as any)}
              className={`px-5 py-2.5 rounded-xl font-medium transition-all shadow-sm ${
                filter === status
                  ? 'bg-orange-500 text-white shadow-orange-500/20'
                  : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-100'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>

        {/* Drivers Table */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-500">
              <div className="animate-spin w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full mx-auto mb-4"/>
              Loading drivers...
            </div>
          ) : drivers.length === 0 ? (
            <div className="p-12 text-center text-gray-500 bg-gray-50/50">
              No drivers found with {filter} status
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50/50">
                  <tr>
                    <th className="text-left px-8 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Driver</th>
                    <th className="text-left px-8 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Vehicle</th>
                    <th className="text-left px-8 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="text-left px-8 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Stats</th>
                    <th className="text-left px-8 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Joined</th>
                    <th className="text-left px-8 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {drivers.map((driver) => (
                    <tr key={driver.id} className="hover:bg-gray-50/80 transition-colors group">
                      <td className="px-8 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-orange-50 rounded-full flex items-center justify-center">
                            <Truck size={18} className="text-orange-600" />
                          </div>
                          <div>
                            <p className="font-bold text-gray-900">{driver.user?.name || 'N/A'}</p>
                            <p className="text-xs text-gray-500">{driver.user?.phone || driver.user?.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-4">
                        <div>
                          <p className="font-semibold text-gray-900">{driver.vehicle_number}</p>
                          <p className="text-xs text-gray-500">{driver.vehicle_model} • {driver.vehicle_type}</p>
                        </div>
                      </td>
                      <td className="px-8 py-4">
                        <div className="flex items-center gap-2">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold capitalize ${getStatusBadge(driver.verification_status)}`}>
                            {driver.verification_status}
                          </span>
                          {driver.is_online && (
                            <span className="w-2 h-2 bg-green-500 rounded-full" title="Online"></span>
                          )}
                        </div>
                      </td>
                      <td className="px-8 py-4">
                        <div className="text-sm">
                          <p className="text-gray-900 flex items-center gap-1"><Star size={12} className="text-yellow-500" /> {driver.rating?.toFixed(1) || 'N/A'}</p>
                          <p className="text-gray-500 text-xs">{driver.total_trips || 0} trips</p>
                        </div>
                      </td>
                      <td className="px-8 py-4 text-xs font-medium text-gray-500">
                        {new Date(driver.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-8 py-4">
                        <Link
                          href={`/drivers/${driver.id}`}
                          className="text-orange-600 hover:text-orange-800 font-semibold text-sm flex items-center gap-1"
                        >
                          View <ArrowRight size={14} />
                        </Link>
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
