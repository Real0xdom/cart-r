'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import { Search, Filter, RefreshCw, Bike, Car, ChevronDown, X, User, CreditCard, MapPin, Truck as TruckIcon } from 'lucide-react';

interface Booking {
  id: string;
  booking_number: string;
  origin_address: string;
  destination_address: string;
  total_fare: number;
  driver_payout: number;
  tip_amount: number;
  status: string;
  vehicle_type: string;
  payment_status: string;
  payment_method: string;
  receiver_name: string;
  receiver_phone: string;
  pickup_otp: string;
  delivery_otp: string;
  estimated_distance: number;
  estimated_duration: number;
  created_at: string;
  completed_at: string;
  customer?: { name: string; phone: string };
  driver?: { 
    vehicle_number: string;
    vehicle_model: string;
    user: { name: string; phone: string } 
  };
}

const statusOptions = [
  { value: 'all', label: 'All Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'driver_arrived', label: 'Driver Arrived' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const getStatusColor = (status: string) => {
  switch (status) {
    case 'pending': return 'bg-yellow-100 text-yellow-700';
    case 'accepted': return 'bg-emerald-100 text-emerald-700';
    case 'driver_arrived': return 'bg-indigo-100 text-indigo-700';
    case 'in_progress': return 'bg-green-100 text-green-700';
    case 'completed': return 'bg-gray-100 text-gray-700';
    case 'cancelled': return 'bg-red-100 text-red-700';
    default: return 'bg-gray-100 text-gray-600';
  }
};

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/bookings?status=${statusFilter}`);
      const data = await response.json();
      
      if (!response.ok) {
        console.error('Error fetching bookings:', data.error);
      } else {
        setBookings(data || []);
      }
    } catch (error) {
      console.error('Error fetching bookings:', error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchBookings();
  }, [statusFilter]);

  const filteredBookings = bookings.filter(b =>
    searchTerm === '' ||
    b.booking_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.origin_address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.destination_address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.receiver_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[var(--color-brand-cream)] font-sans">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className="ml-72 p-8 max-w-[1600px]">
        <div className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-1">Bookings</h1>
            <p className="text-gray-500 text-sm">Manage and track all trip requests</p>
          </div>
          <button 
            onClick={fetchBookings}
            className="px-5 py-2.5 bg-orange-500 text-white rounded-xl font-semibold shadow-md shadow-orange-500/20 hover:bg-orange-600 transition-all flex items-center gap-2"
          >
            <RefreshCw size={16} /> Refresh
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-8">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search size={18} className="absolute left-4 top-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by booking #, address, name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white transition-all"
              />
            </div>
            <div className="relative">
              <Filter size={18} className="absolute left-4 top-3.5 text-gray-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="pl-11 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white transition-all appearance-none cursor-pointer font-medium"
              >
                {statusOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-4 top-4 text-gray-400 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Bookings Table */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-500">
              <div className="animate-spin w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full mx-auto mb-4"/>
              Loading bookings...
            </div>
          ) : filteredBookings.length === 0 ? (
            <div className="p-12 text-center text-gray-500 bg-gray-50/50">No bookings found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50/50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Booking Info</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Route Details</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Fare</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Customer</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredBookings.map((booking) => (
                    <tr key={booking.id} className="hover:bg-gray-50/80 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center shadow-sm group-hover:bg-white group-hover:shadow-md transition-all">
                            {booking.vehicle_type === 'bike' ? <Bike size={18} className="text-orange-600" /> : <Car size={18} className="text-orange-600" />}
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
                      <td className="px-6 py-4">
                        <div className="max-w-[200px]">
                           <div className="flex items-center gap-2 mb-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0"/>
                            <div className="text-sm text-gray-900 truncate font-medium">
                              {booking.origin_address}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0"/>
                             <div className="text-xs text-gray-500 truncate">
                              {booking.destination_address}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold capitalize shadow-sm border ${
                          booking.status === 'completed' ? 'bg-green-50 text-green-700 border-green-100' :
                          booking.status === 'cancelled' ? 'bg-red-50 text-red-700 border-red-100' :
                          booking.status === 'pending' ? 'bg-yellow-50 text-yellow-700 border-yellow-100' :
                          'bg-emerald-50 text-emerald-700 border-emerald-100'
                        }`}>
                          {booking.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-bold text-gray-900">
                          ₹{booking.total_fare}
                        </div>
                        <div className={`text-xs font-medium capitalize ${
                          booking.payment_status === 'paid' ? 'text-green-600' : 'text-orange-500'
                        }`}>
                          {booking.payment_status}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">
                          {booking.customer?.name || 'Guest User'}
                        </div>
                        <div className="text-xs text-gray-500">
                          {booking.customer?.phone || ''}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => setSelectedBooking(booking)}
                          className="px-4 py-2 bg-gray-900 text-white text-xs font-semibold rounded-lg hover:bg-gray-800 transition shadow-md"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Booking Detail Modal */}
        {selectedBooking && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-200">
              {/* Modal Header */}
              <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 rounded-t-3xl">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Booking Details</h2>
                  <p className="text-sm text-gray-500">ID: {selectedBooking.booking_number}</p>
                </div>
                <button 
                  onClick={() => setSelectedBooking(null)}
                  className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-red-50 hover:text-red-500 hover:border-red-100 transition-colors shadow-sm"
                >
                  ✕
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-6 space-y-6">
                
                {/* Status Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                    <p className="text-xs text-gray-400 font-medium uppercase mb-1">Status</p>
                    <span className={`px-2 py-1 rounded-lg text-xs font-bold capitalize ${
                      selectedBooking.status === 'completed' ? 'bg-green-100 text-green-700' :
                      selectedBooking.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                      'bg-emerald-100 text-emerald-700'
                    }`}>
                      {selectedBooking.status.replace('_', ' ')}
                    </span>
                  </div>
                   <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                    <p className="text-xs text-gray-400 font-medium uppercase mb-1">Vehicle</p>
                    <p className="text-sm font-bold text-gray-900 capitalize">{selectedBooking.vehicle_type}</p>
                  </div>
                   <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                    <p className="text-xs text-gray-400 font-medium uppercase mb-1">Distance</p>
                    <p className="text-sm font-bold text-gray-900">{selectedBooking.estimated_distance?.toFixed(1) || 0} km</p>
                  </div>
                   <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                    <p className="text-xs text-gray-400 font-medium uppercase mb-1">Duration</p>
                    <p className="text-sm font-bold text-gray-900">{selectedBooking.estimated_duration?.toFixed(0) || 0} min</p>
                  </div>
                </div>

                {/* Route */}
                <div className="bg-white border-2 border-dashed border-gray-100 rounded-2xl p-5 relative overflow-hidden">
                  <div className="absolute left-8 top-8 bottom-8 w-0.5 bg-gray-200"></div>
                  <div className="space-y-6 relative z-10">
                    <div className="flex gap-4">
                      <div className="w-4 h-4 rounded-full bg-green-500 shrink-0 border-4 border-white shadow-sm mt-1"/>
                      <div>
                        <p className="text-xs text-gray-400 font-bold uppercase mb-1">Pick Up</p>
                        <p className="text-sm font-medium text-gray-900">{selectedBooking.origin_address}</p>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <div className="w-4 h-4 rounded-full bg-red-500 shrink-0 border-4 border-white shadow-sm mt-1"/>
                       <div>
                        <p className="text-xs text-gray-400 font-bold uppercase mb-1">Drop Off</p>
                        <p className="text-sm font-medium text-gray-900">{selectedBooking.destination_address}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Info Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Customer */}
                  <div className="bg-emerald-50/50 rounded-2xl p-5 border border-emerald-100">
                    <h3 className="text-xs font-bold text-emerald-800 uppercase mb-3 flex items-center gap-2">
                      👤 Customer Details
                    </h3>
                    <div className="space-y-2">
                       <p className="text-sm font-bold text-gray-900">{selectedBooking.customer?.name || 'Guest'}</p>
                       <p className="text-sm text-gray-600">{selectedBooking.customer?.phone}</p>
                    </div>
                  </div>

                  {/* Payment */}
                  <div className="bg-green-50/50 rounded-2xl p-5 border border-green-100">
                    <h3 className="text-xs font-bold text-green-800 uppercase mb-3 flex items-center gap-2">
                      💳 Payment Details
                    </h3>
                     <div className="space-y-1">
                       <p className="text-2xl font-bold text-gray-900">₹{selectedBooking.total_fare}</p>
                       <div className="flex items-center gap-2">
                         <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                           selectedBooking.payment_status === 'paid' ? 'bg-green-200 text-green-800 ' : 'bg-orange-200 text-orange-800'
                         }`}>
                           {selectedBooking.payment_status?.toUpperCase()}
                         </span>
                         <span className="text-xs text-gray-500 uppercase">{selectedBooking.payment_method}</span>
                       </div>
                    </div>
                  </div>
                </div>

                {/* Driver Section */}
                {selectedBooking.driver ? (
                  <div className="bg-gray-900 rounded-2xl p-5 text-white shadow-lg">
                    <h3 className="text-xs font-bold text-gray-400 uppercase mb-4 flex items-center gap-2">
                      🚕 Assigned Driver
                    </h3>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center text-xl font-bold text-white border-2 border-gray-700">
                           {selectedBooking.driver.user?.name?.[0]}
                        </div>
                        <div>
                           <p className="font-bold text-lg">{selectedBooking.driver.user?.name}</p>
                           <p className="text-sm text-gray-400">{selectedBooking.driver.user?.phone}</p>
                        </div>
                      </div>
                      <div className="text-right">
                         <div className="bg-gray-800 px-3 py-1 rounded-lg border border-gray-700 inline-block mb-1">
                           <p className="font-mono font-bold tracking-wider">{selectedBooking.driver.vehicle_number}</p>
                         </div>
                         <p className="text-xs text-gray-400 capitalize">{selectedBooking.driver.vehicle_model}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                   <div className="bg-gray-50 rounded-2xl p-5 border border-dashed border-gray-300 text-center">
                     <p className="text-gray-400 font-medium">No driver assigned to this booking yet</p>
                   </div>
                )}

              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
