'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Sidebar from '@/components/Sidebar';
import Link from 'next/link';
import { ArrowLeft, MapPin, User, Phone, Calendar, CreditCard, Clock, AlertTriangle, CheckCircle, Navigation } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface BookingDetail {
  id: string;
  booking_number: string;
  origin_address: string;
  destination_address: string;
  origin_latitude: number;
  origin_longitude: number;
  destination_latitude: number;
  destination_longitude: number;
  total_fare: number;
  driver_payout: number;
  status: string;
  vehicle_type: string;
  payment_status: string;
  payment_method: string;
  created_at: string;
  accepted_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  customer?: { 
    name: string; 
    phone: string; 
    email: string;
    avatar_url: string | null;
  };
  driver?: { 
    vehicle_number: string;
    vehicle_model: string;
    user: { 
      name: string; 
      phone: string;
      avatar_url: string | null;
    } 
  };
}

export default function BookingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (params.id) {
      fetchBooking(params.id as string);
    }
  }, [params.id]);

  async function fetchBooking(id: string) {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          customer:users!bookings_customer_id_fkey(name, phone, email, avatar_url),
          driver:drivers(
            vehicle_number, 
            vehicle_model,
            user:users!drivers_user_id_fkey(name, phone, avatar_url)
          )
        `)
        .eq('id', id)
        .single();
      
      if (error) throw error;
      setBooking(data);
    } catch (error) {
      console.error('Error fetching booking:', error);
      toast.error('Could not load booking details');
    } finally {
      setLoading(false);
    }
  }

  async function handleCancelBooking() {
    if (!booking) return;
    if (!confirm('Are you sure you want to cancel this booking? This action cannot be undone.')) return;

    setUpdating(true);
    try {
      const response = await fetch('/api/bookings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: booking.id,
          status: 'cancelled',
          cancellation_reason: 'Cancelled by Admin',
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to cancel booking');
      }
      
      toast.success('Booking cancelled successfully');
      fetchBooking(booking.id);
    } catch (error: any) {
      toast.error('Failed to cancel: ' + error.message);
    } finally {
      setUpdating(false);
    }
  }

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      queued: 'bg-sky-100 text-sky-800 border-sky-200',
      accepted: 'bg-blue-100 text-blue-800 border-blue-200',
      driver_arrived: 'bg-purple-100 text-purple-800 border-purple-200',
      in_progress: 'bg-indigo-100 text-indigo-800 border-indigo-200',
      completed: 'bg-green-100 text-green-800 border-green-200',
      cancelled: 'bg-red-100 text-red-800 border-red-200',
    };
    return styles[status] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-brand-cream)] font-sans">
        <Sidebar />
        <div className="ml-72 p-8 flex items-center justify-center">
            <div className="animate-spin w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full" />
        </div>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-screen bg-[var(--color-brand-cream)] font-sans">
         <Sidebar />
         <div className="ml-72 p-8 text-center text-gray-500">Booking not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-brand-cream)] font-sans">
      <Sidebar />
      <div className="ml-72 p-8 max-w-[1600px]">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link href="/bookings" className="flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors">
            <ArrowLeft size={18} /> Back to Bookings
          </Link>
        </div>

        <div className="flex justify-between items-start mb-8">
            <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                    Booking #{booking.booking_number}
                </h1>
                <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-full text-sm font-bold border capitalize ${getStatusBadge(booking.status)}`}>
                        {booking.status.replace('_', ' ')}
                    </span>
                    <span className="text-gray-500 text-sm flex items-center gap-1">
                        <Calendar size={14} />
                        {new Date(booking.created_at).toLocaleString()}
                    </span>
                </div>
            </div>

            {/* Admin Actions */}
            {['pending', 'queued', 'accepted', 'driver_arrived', 'in_progress'].includes(booking.status) && (
                <button 
                    onClick={handleCancelBooking}
                    disabled={updating}
                    className="px-5 py-2.5 bg-red-50 text-red-600 border border-red-200 rounded-xl font-semibold hover:bg-red-100 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                    <AlertTriangle size={18} />
                    {updating ? 'Cancelling...' : 'Cancel Booking'}
                </button>
            )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Details */}
            <div className="lg:col-span-2 space-y-6">
                {/* Route Card */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                    <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <Navigation size={20} className="text-orange-500" /> Route Details
                    </h2>
                    
                    <div className="relative pl-8 space-y-8">
                        {/* Timeline line */}
                        <div className="absolute left-2.5 top-2 bottom-6 w-0.5 bg-gray-200" />

                        <div className="relative">
                            <div className="absolute -left-[30px] w-5 h-5 rounded-full bg-green-500 border-4 border-white shadow-sm" />
                            <div>
                                <p className="text-xs text-gray-500 mb-1">PICKUP</p>
                                <p className="font-semibold text-gray-900 text-lg">{booking.origin_address}</p>
                                <p className="text-xs text-gray-400 font-mono mt-1">{booking.origin_latitude.toFixed(6)}, {booking.origin_longitude.toFixed(6)}</p>
                            </div>
                        </div>

                        <div className="relative">
                           <div className="absolute -left-[30px] w-5 h-5 rounded-full bg-red-500 border-4 border-white shadow-sm" />
                            <div>
                                <p className="text-xs text-gray-500 mb-1">DROP-OFF</p>
                                <p className="font-semibold text-gray-900 text-lg">{booking.destination_address}</p>
                                <p className="text-xs text-gray-400 font-mono mt-1">{booking.destination_latitude.toFixed(6)}, {booking.destination_longitude.toFixed(6)}</p>
                            </div>
                        </div>
                    </div>

                    {/* Map Placeholder - could integrate Google Maps here later */}
                    <div className="mt-8 h-64 bg-gray-100 rounded-xl flex items-center justify-center text-gray-400">
                        <MapPin size={32} className="mb-2" />
                        <span className="text-sm">Map View Integration</span>
                    </div>
                </div>

                {/* Fare Breakdown */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                     <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <CreditCard size={20} className="text-orange-500" /> Fare & Payment
                    </h2>
                    
                    <div className="grid grid-cols-2 gap-8">
                        <div>
                            <p className="text-gray-500 text-sm mb-1">Total Fare</p>
                            <p className="text-3xl font-bold text-gray-900">₹{booking.total_fare}</p>
                            <p className="text-sm text-gray-500 mt-1 capitalize">{booking.vehicle_type} Ride</p>
                        </div>
                         <div>
                            <p className="text-gray-500 text-sm mb-1">Driver Payout</p>
                            <p className="text-2xl font-bold text-emerald-600">₹{booking.driver_payout}</p>
                            <p className="text-sm text-gray-500 mt-1">Net Earnings</p>
                        </div>
                    </div>

                    <div className="mt-6 pt-6 border-t border-gray-100 grid grid-cols-2 gap-4">
                        <div className="p-4 bg-gray-50 rounded-xl">
                            <p className="text-xs text-gray-500 mb-1">Payment Status</p>
                            <p className={`font-bold capitalize ${
                                ['paid', 'completed'].includes(booking.payment_status) ? 'text-green-600' : 
                                booking.payment_status === 'partial_paid' ? 'text-blue-600' :
                                'text-orange-600'
                            }`}>
                                {booking.payment_status.replace('_', ' ')}
                            </p>
                        </div>
                        <div className="p-4 bg-gray-50 rounded-xl">
                            <p className="text-xs text-gray-500 mb-1">Payment Method</p>
                            <p className="font-bold text-gray-900 capitalize">{booking.payment_method}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Sidebar Info */}
            <div className="space-y-6">
                {/* Customer Card */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                     <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">Customer</h2>
                     {booking.customer ? (
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center overflow-hidden">
                                {booking.customer.avatar_url ? (
                                    <img src={booking.customer.avatar_url} alt="" className="w-full h-full object-cover"/>
                                ) : (
                                    <User size={20} className="text-gray-400" />
                                )}
                            </div>
                            <div>
                                <p className="font-bold text-gray-900">{booking.customer.name}</p>
                                <div className="flex items-center gap-2 text-sm text-gray-500 mt-0.5">
                                    <Phone size={12} /> {booking.customer.phone}
                                </div>
                            </div>
                        </div>
                     ) : (
                         <div className="text-gray-500 italic">Unknown Customer</div>
                     )}
                </div>

                {/* Driver Card */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                     <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">Driver</h2>
                     {booking.driver ? (
                        <div>
                            <div className="flex items-center gap-4 mb-4">
                                <div className="w-12 h-12 bg-orange-50 rounded-full flex items-center justify-center overflow-hidden">
                                    {booking.driver.user.avatar_url ? (
                                        <img src={booking.driver.user.avatar_url} alt="" className="w-full h-full object-cover"/>
                                    ) : (
                                        <User size={20} className="text-orange-500" />
                                    )}
                                </div>
                                <div>
                                    <p className="font-bold text-gray-900">{booking.driver.user.name}</p>
                                    <div className="flex items-center gap-2 text-sm text-gray-500 mt-0.5">
                                        <Phone size={12} /> {booking.driver.user.phone}
                                    </div>
                                </div>
                            </div>
                            <div className="p-3 bg-gray-50 rounded-xl">
                                <p className="text-xs text-gray-500 mb-1">Vehicle Details</p>
                                <p className="font-semibold text-gray-900">{booking.driver.vehicle_number}</p>
                                <p className="text-sm text-gray-600">{booking.driver.vehicle_model}</p>
                            </div>
                        </div>
                     ) : (
                         <div className="p-6 bg-gray-50 rounded-xl text-center border-dashed border-2 border-gray-200">
                             <p className="text-gray-500 font-medium">No Driver Assigned</p>
                             <p className="text-xs text-gray-400 mt-1">Waiting for acceptance</p>
                         </div>
                     )}
                </div>

                {/* Timeline */}
                 <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                     <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">Timeline</h2>
                     <div className="space-y-4">
                        <TimelineItem 
                            label="Created" 
                            time={booking.created_at} 
                            active={true}
                        />
                         <TimelineItem 
                            label="Accepted" 
                            time={booking.accepted_at} 
                            active={!!booking.accepted_at}
                        />
                         <TimelineItem 
                            label="Started" 
                            time={booking.started_at} 
                            active={!!booking.started_at}
                        />
                         <TimelineItem 
                            label="Completed" 
                            time={booking.completed_at} 
                            active={!!booking.completed_at}
                        />
                        {booking.cancelled_at && (
                             <TimelineItem 
                                label="Cancelled" 
                                time={booking.cancelled_at} 
                                active={true}
                                isError
                            />
                        )}
                     </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}

function TimelineItem({ label, time, active, isError }: { label: string, time: string | null, active: boolean, isError?: boolean }) {
    return (
        <div className={`flex justify-between items-center ${active ? 'opacity-100' : 'opacity-40'}`}>
            <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${isError ? 'bg-red-500' : 'bg-green-500'}`} />
                <span className={`text-sm font-medium ${isError ? 'text-red-700' : 'text-gray-900'}`}>{label}</span>
            </div>
            {time && (
                <span className="text-xs text-gray-500 font-mono">
                    {new Date(time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </span>
            )}
        </div>
    )
}
