'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import Image from 'next/image';
import toast from 'react-hot-toast';
import { User, ArrowLeft, Star, MapPin, Calendar, CheckCircle, XCircle, Car, CreditCard, Phone, Mail, History, Clock, FileText } from 'lucide-react';

interface DriverDetail {
  id: string;
  user_id: string;
  vehicle_type: string;
  vehicle_number: string;
  vehicle_model: string;
  vehicle_color: string;
  license_number: string;
  license_expiry: string;
  license_image_url: string | null;
  rc_image_url: string | null;
  insurance_image_url: string | null;
  vehicle_image_url: string | null;
  verification_status: 'pending' | 'approved' | 'rejected';
  rejection_reason: string | null;
  rating: number;
  total_trips: number;
  total_earnings: number;
  is_online: boolean;
  created_at: string;
  user: {
    name: string;
    email: string;
    phone: string;
    avatar_url: string | null;
  };
}

interface VerificationHistoryEntry {
  id: string;
  driver_id: string;
  action: 'submitted' | 'approved' | 'rejected' | 'resubmitted';
  rejection_reason: string | null;
  document_snapshot: {
    license_image_url?: string;
    rc_image_url?: string;
    insurance_image_url?: string;
    vehicle_image_url?: string;
    license_number?: string;
    license_expiry?: string;
    vehicle_number?: string;
    vehicle_model?: string;
    vehicle_type?: string;
  } | null;
  admin_id: string | null;
  created_at: string;
}

export default function DriverDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [driver, setDriver] = useState<DriverDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editData, setEditData] = useState({ vehicle_number: '', vehicle_model: '', vehicle_type: '' });
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'details' | 'history'>('details');
  const [verificationHistory, setVerificationHistory] = useState<VerificationHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    if (params.id) {
      fetchDriver(params.id as string);
      fetchVerificationHistory(params.id as string);
    }
  }, [params.id]);

  async function fetchDriver(id: string) {
    setLoading(true);
    try {
      // Use API route to fetch driver (server-side with service role key bypasses RLS)
      const response = await fetch(`/api/drivers/${id}`);
      
      if (!response.ok) {
        console.error('API error:', response.status);
        setLoading(false);
        return;
      }

      const driverData = await response.json();
      console.log('Driver data from API:', driverData);
      
      setDriver(driverData);
      setEditData({
         vehicle_number: driverData.vehicle_number || '',
         vehicle_model: driverData.vehicle_model || '',
         vehicle_type: driverData.vehicle_type || 'Mini'
      });
    } catch (err) {
      console.error('Error:', err);
    }
    setLoading(false);
  }

  async function fetchVerificationHistory(id: string) {
    setHistoryLoading(true);
    try {
      const response = await fetch(`/api/drivers/${id}/history`);
      if (response.ok) {
        const historyData = await response.json();
        setVerificationHistory(historyData);
      }
    } catch (err) {
      console.error('Error fetching history:', err);
    }
    setHistoryLoading(false);
  }

  async function handleSaveDetails() {
    if (!driver) return;
    setActionLoading(true);
    try {
       const response = await fetch('/api/drivers', {
         method: 'PATCH',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
            id: driver.id,
            ...editData
         })
       });

       if (!response.ok) throw new Error("Failed to update driver details");

       toast.success("Driver details updated successfully");
       setShowEditModal(false);
       fetchDriver(driver.id);
    } catch(err: any) {
       toast.error(err.message);
    }
    setActionLoading(false);
  }

  async function approveDriver() {
    if (!driver) return;
    setActionLoading(true);

    try {
      // Use API route to update driver (will also record history)
      const response = await fetch('/api/drivers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: driver.id,
          verification_status: 'approved',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to approve driver');
      }

      // Create notification for driver
      await supabase.from('notifications').insert({
        user_id: driver.user_id,
        title: 'Account Approved! 🎉',
        body: 'Your driver account has been verified. You can now start accepting rides!',
        data: { type: 'verification_approved' },
      });

      toast.success('Driver approved successfully!');
      fetchDriver(driver.id);
      fetchVerificationHistory(driver.id);
    } catch (error: any) {
      toast.error('Failed to approve driver: ' + error.message);
    }
    setActionLoading(false);
  }

  async function rejectDriver() {
    if (!driver || !rejectionReason.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }
    setActionLoading(true);

    try {
      // Use API route to update driver (will also record history)
      const response = await fetch('/api/drivers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: driver.id,
          verification_status: 'rejected',
          rejection_reason: rejectionReason,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to reject driver');
      }

      // Create notification for driver
      await supabase.from('notifications').insert({
        user_id: driver.user_id,
        title: 'Verification Update',
        body: 'Your driver verification was not approved. Please check the app for details.',
        data: { type: 'verification_rejected', reason: rejectionReason },
      });

      toast.success('Driver rejected');
      setShowRejectModal(false);
      setRejectionReason('');
      fetchDriver(driver.id);
      fetchVerificationHistory(driver.id);
    } catch (error: any) {
      toast.error('Failed to reject driver: ' + error.message);
    }
    setActionLoading(false);
  }

  const getStatusBadge = (status: string) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      approved: 'bg-green-100 text-green-800 border-green-200',
      rejected: 'bg-red-100 text-red-800 border-red-200',
    };
    return styles[status as keyof typeof styles] || 'bg-gray-100 text-gray-800';
  };

  const getActionBadge = (action: string) => {
    const config = {
      submitted: { bg: 'bg-blue-100', text: 'text-blue-800', icon: '📝', label: 'Application Submitted' },
      approved: { bg: 'bg-green-100', text: 'text-green-800', icon: '✅', label: 'Approved' },
      rejected: { bg: 'bg-red-100', text: 'text-red-800', icon: '❌', label: 'Rejected' },
      resubmitted: { bg: 'bg-orange-100', text: 'text-orange-800', icon: '🔄', label: 'Resubmitted' },
    };
    return config[action as keyof typeof config] || { bg: 'bg-gray-100', text: 'text-gray-800', icon: '📋', label: action };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-brand-cream)] p-8 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!driver) {
    return (
      <div className="min-h-screen bg-[var(--color-brand-cream)] p-8 flex items-center justify-center">
        <div className="text-gray-500">Driver not found</div>
      </div>
    );
  }

  const documents = [
    { label: 'Driving License', url: driver.license_image_url },
    { label: 'Vehicle RC', url: driver.rc_image_url },
    { label: 'Insurance', url: driver.insurance_image_url },
    { label: 'Vehicle Photo', url: driver.vehicle_image_url },
  ];

  return (
    <div className="min-h-screen bg-[var(--color-brand-cream)] p-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link href="/drivers" className="flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors">
          <ArrowLeft size={18} /> Back to Drivers
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Driver Info Card */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="text-center mb-6">
              <div className="w-24 h-24 bg-gradient-to-br from-orange-100 to-orange-50 rounded-full mx-auto mb-4 flex items-center justify-center overflow-hidden border-4 border-white shadow-lg">
                {driver.user?.avatar_url ? (
                  <Image
                    src={driver.user.avatar_url}
                    alt={driver.user.name}
                    width={96}
                    height={96}
                    className="rounded-full object-cover"
                  />
                ) : (
                  <User size={40} className="text-orange-500" />
                )}
              </div>
              <h2 className="text-xl font-bold text-gray-900">{driver.user?.name || 'Unknown Driver'}</h2>
              <div className="flex items-center justify-center gap-2 text-gray-500 mt-1">
                <Phone size={14} />
                <span>{driver.user?.phone || 'No phone'}</span>
              </div>
              <div className="flex items-center justify-center gap-2 text-gray-400 text-sm mt-1">
                <Mail size={14} />
                <span>{driver.user?.email || 'No email'}</span>
              </div>
            </div>

            <div className={`px-4 py-2 rounded-lg text-center font-medium border ${getStatusBadge(driver.verification_status)}`}>
              {driver.verification_status.toUpperCase()}
            </div>

            {driver.rejection_reason && (
              <div className="mt-4 p-3 bg-red-50 rounded-lg">
                <p className="text-sm text-red-800">
                  <strong>Rejection Reason:</strong> {driver.rejection_reason}
                </p>
              </div>
            )}

            <div className="mt-6 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-500 flex items-center gap-2"><Star size={14} /> Rating</span>
                <span className="font-semibold text-gray-900">
                  {driver.rating !== null && driver.rating !== undefined 
                    ? Number(driver.rating).toFixed(1) 
                    : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500 flex items-center gap-2"><MapPin size={14} /> Total Trips</span>
                <span className="font-semibold text-gray-900">
                  {driver.total_trips !== null && driver.total_trips !== undefined 
                    ? driver.total_trips 
                    : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500 flex items-center gap-2"><CreditCard size={14} /> Earnings</span>
                <span className="font-semibold text-gray-900">
                  {driver.total_earnings !== null && driver.total_earnings !== undefined 
                    ? `₹${Number(driver.total_earnings).toFixed(0)}` 
                    : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500 flex items-center gap-2"><Calendar size={14} /> Member Since</span>
                <span className="font-semibold text-gray-900">{new Date(driver.created_at).toLocaleDateString()}</span>
              </div>
            </div>

      {/* Action Buttons */}
            <div className="mt-6 space-y-3">
              {driver.verification_status === 'pending' && (
                <button
                  onClick={approveDriver}
                  disabled={actionLoading}
                  className="w-full bg-green-600 text-white py-3 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50"
                >
                  {actionLoading ? 'Processing...' : '✓ Approve Driver'}
                </button>
              )}
              
              {/* Reject / Suspend Button */}
              {driver.verification_status !== 'rejected' && (
                  <button
                    onClick={() => {
                        setRejectionReason('');
                        setShowRejectModal(true);
                    }}
                    disabled={actionLoading}
                    className="w-full bg-red-100 text-red-600 py-3 rounded-lg font-medium hover:bg-red-200 disabled:opacity-50"
                  >
                    {driver.verification_status === 'approved' ? '⚠ Suspend Driver' : '✕ Reject Application'}
                  </button>
              )}
            </div>
          </div>
        </div>

        {/* Content Area with Tabs */}
        <div className="lg:col-span-2 space-y-6">
          {/* Tabs */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="flex border-b border-gray-100">
              <button
                onClick={() => setActiveTab('details')}
                className={`flex-1 px-6 py-4 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                  activeTab === 'details'
                    ? 'text-orange-600 border-b-2 border-orange-600 bg-orange-50/50'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                <FileText size={16} />
                Details & Documents
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`flex-1 px-6 py-4 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                  activeTab === 'history'
                    ? 'text-orange-600 border-b-2 border-orange-600 bg-orange-50/50'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                <History size={16} />
                Verification History
                {verificationHistory.length > 0 && (
                  <span className="bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full text-xs">
                    {verificationHistory.length}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Tab Content */}
          {activeTab === 'details' ? (
            <>
              {/* Vehicle Info */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <div className="flex justify-between items-center mb-4">
                     <h3 className="text-lg font-semibold text-gray-800">Vehicle Information</h3>
                     <button 
                        onClick={() => setShowEditModal(true)}
                        className="text-orange-600 text-sm font-medium hover:underline"
                     >
                        Edit Details
                     </button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-gray-500 text-sm">Vehicle Type</p>
                    <p className="font-medium text-gray-800">{driver.vehicle_type}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-sm">Registration Number</p>
                    <p className="font-medium text-gray-800">{driver.vehicle_number}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-sm">Model</p>
                    <p className="font-medium text-gray-800">{driver.vehicle_model}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-sm">Color</p>
                    <p className="font-medium text-gray-800">{driver.vehicle_color || 'N/A'}</p>
                  </div>
                </div>
              </div>

              {/* License Info */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">License Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-gray-500 text-sm">License Number</p>
                    <p className="font-medium text-gray-800">{driver.license_number}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-sm">Expiry Date</p>
                    <p className="font-medium text-gray-800">
                      {driver.license_expiry ? new Date(driver.license_expiry).toLocaleDateString() : 'N/A'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Documents */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Uploaded Documents</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {documents.map((doc) => (
                    <div key={doc.label} className="text-center">
                      <p className="text-gray-500 text-sm mb-2">{doc.label}</p>
                      {doc.url ? (
                        <button
                          onClick={() => setSelectedImage(doc.url)}
                          className="w-full h-32 bg-gray-100 rounded-lg overflow-hidden hover:opacity-80 transition-opacity"
                        >
                          <img
                            src={doc.url}
                            alt={doc.label}
                            className="w-full h-full object-cover"
                          />
                        </button>
                      ) : (
                        <div className="w-full h-32 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400">
                          No file
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            /* Verification History Tab */
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-6">Verification History</h3>
              
              {historyLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full" />
                </div>
              ) : verificationHistory.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <History size={40} className="mx-auto mb-3 text-gray-300" />
                  <p>No verification history yet</p>
                  <p className="text-sm text-gray-400 mt-1">History will appear here when verification actions are taken</p>
                </div>
              ) : (
                <div className="relative">
                  {/* Timeline line */}
                  <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />
                  
                  {/* Timeline entries */}
                  <div className="space-y-6">
                    {verificationHistory.map((entry, index) => {
                      const badge = getActionBadge(entry.action);
                      return (
                        <div key={entry.id} className="relative pl-10">
                          {/* Timeline dot */}
                          <div className={`absolute left-2 w-5 h-5 rounded-full border-2 border-white shadow ${badge.bg} flex items-center justify-center`}>
                            <span className="text-xs">{badge.icon}</span>
                          </div>
                          
                          {/* Entry card */}
                          <div className={`p-4 rounded-lg border ${badge.bg} border-opacity-50`}>
                            <div className="flex items-center justify-between mb-2">
                              <span className={`font-medium ${badge.text}`}>{badge.label}</span>
                              <span className="text-xs text-gray-500 flex items-center gap-1">
                                <Clock size={12} />
                                {new Date(entry.created_at).toLocaleString()}
                              </span>
                            </div>
                            
                            {/* Rejection reason */}
                            {entry.rejection_reason && (
                              <div className="mt-2 p-3 bg-white rounded-lg border border-red-200">
                                <p className="text-sm font-medium text-red-800 mb-1">Rejection Reason:</p>
                                <p className="text-sm text-red-700">{entry.rejection_reason}</p>
                              </div>
                            )}
                            
                            {/* Document snapshot */}
                            {entry.document_snapshot && (
                              <div className="mt-3">
                                <p className="text-xs text-gray-500 mb-2">Documents at time of {entry.action}:</p>
                                <div className="grid grid-cols-4 gap-2">
                                  {entry.document_snapshot.license_image_url && (
                                    <button
                                      onClick={() => setSelectedImage(entry.document_snapshot?.license_image_url || null)}
                                      className="h-16 bg-gray-100 rounded overflow-hidden hover:opacity-80"
                                    >
                                      <img src={entry.document_snapshot.license_image_url} alt="License" className="w-full h-full object-cover" />
                                    </button>
                                  )}
                                  {entry.document_snapshot.rc_image_url && (
                                    <button
                                      onClick={() => setSelectedImage(entry.document_snapshot?.rc_image_url || null)}
                                      className="h-16 bg-gray-100 rounded overflow-hidden hover:opacity-80"
                                    >
                                      <img src={entry.document_snapshot.rc_image_url} alt="RC" className="w-full h-full object-cover" />
                                    </button>
                                  )}
                                  {entry.document_snapshot.insurance_image_url && (
                                    <button
                                      onClick={() => setSelectedImage(entry.document_snapshot?.insurance_image_url || null)}
                                      className="h-16 bg-gray-100 rounded overflow-hidden hover:opacity-80"
                                    >
                                      <img src={entry.document_snapshot.insurance_image_url} alt="Insurance" className="w-full h-full object-cover" />
                                    </button>
                                  )}
                                  {entry.document_snapshot.vehicle_image_url && (
                                    <button
                                      onClick={() => setSelectedImage(entry.document_snapshot?.vehicle_image_url || null)}
                                      className="h-16 bg-gray-100 rounded overflow-hidden hover:opacity-80"
                                    >
                                      <img src={entry.document_snapshot.vehicle_image_url} alt="Vehicle" className="w-full h-full object-cover" />
                                    </button>
                                  )}
                                </div>
                                {/* Vehicle info at time of action */}
                                <div className="mt-2 text-xs text-gray-500">
                                  <span className="mr-3">🚗 {entry.document_snapshot.vehicle_type}</span>
                                  <span className="mr-3">📋 {entry.document_snapshot.vehicle_number}</span>
                                  <span>🪪 {entry.document_snapshot.license_number}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">{driver.verification_status === 'approved' ? 'Suspend Driver' : 'Reject Application'}</h3>
            <p className="text-gray-500 mb-4">Please provide a reason for {driver.verification_status === 'approved' ? 'suspension' : 'rejection'}:</p>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="e.g., Blurry document images, unsafe driving report, etc."
              className="w-full p-3 border border-gray-200 rounded-lg mb-4 h-32 resize-none"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowRejectModal(false)}
                className="flex-1 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={rejectDriver}
                disabled={actionLoading}
                className="flex-1 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {actionLoading ? 'Processing...' : (driver.verification_status === 'approved' ? 'Suspend' : 'Reject')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Details Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Edit Driver Details</h3>
            
            <div className="space-y-4">
                <div>
                   <label className="text-xs font-semibold text-gray-500 uppercase">Vehicle Type</label>
                   <select 
                     value={editData.vehicle_type}
                     onChange={(e) => setEditData({...editData, vehicle_type: e.target.value})}
                     className="w-full p-3 border border-gray-200 rounded-lg bg-white"
                   >
                     <option value="Mini">Mini</option>
                     <option value="Sedan">Sedan</option>
                     <option value="SUV">SUV</option>
                     <option value="Auto">Auto</option>
                     <option value="Bike">Bike</option>
                   </select>
                </div>
                <div>
                   <label className="text-xs font-semibold text-gray-500 uppercase">Vehicle Number</label>
                   <input 
                     type="text"
                     value={editData.vehicle_number}
                     onChange={(e) => setEditData({...editData, vehicle_number: e.target.value})}
                     className="w-full p-3 border border-gray-200 rounded-lg"
                   />
                </div>
                <div>
                   <label className="text-xs font-semibold text-gray-500 uppercase">Vehicle Model</label>
                   <input 
                     type="text"
                     value={editData.vehicle_model}
                     onChange={(e) => setEditData({...editData, vehicle_model: e.target.value})}
                     className="w-full p-3 border border-gray-200 rounded-lg"
                   />
                </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowEditModal(false)}
                className="flex-1 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveDetails}
                disabled={actionLoading}
                className="flex-1 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
              >
                {actionLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Viewer Modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 cursor-pointer"
          onClick={() => setSelectedImage(null)}
        >
          <img
            src={selectedImage}
            alt="Document"
            className="max-w-4xl max-h-[90vh] object-contain"
          />
          <button
            className="absolute top-4 right-4 text-white text-2xl hover:text-gray-300"
            onClick={() => setSelectedImage(null)}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
