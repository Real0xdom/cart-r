'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { sendNotificationToAudience } from '@/app/actions/notifications';
import Link from 'next/link';
import Image from 'next/image';
import toast from 'react-hot-toast';
import { User, Users, ArrowLeft, Star, MapPin, Calendar, CheckCircle, XCircle, Car, CreditCard, Phone, Mail, History, Clock, FileText, Wallet, ArrowDownCircle, ArrowUpCircle, ExternalLink, ShieldAlert } from 'lucide-react';

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
  driver_app_enabled: boolean;
  created_at: string;
  user: {
    name: string;
    email: string;
    phone: string;
    avatar_url: string | null;
  };
  referral_count?: number;
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

type DocumentKind = 'image' | 'pdf';

interface SelectedDocument {
  kind: DocumentKind;
  label: string;
  url: string;
}

const SAFE_STORAGE_SEGMENTS = [
  '/storage/v1/object/public/driver-documents/',
  '/storage/v1/object/sign/driver-documents/',
  '/storage/v1/object/authenticated/driver-documents/',
];

function getDocumentExtension(value?: string | null) {
  if (!value) return null;
  const sanitized = value.split('?')[0].split('#')[0];
  const match = sanitized.match(/\.([a-zA-Z0-9]+)$/);
  return match?.[1]?.toLowerCase() ?? null;
}

function getDocumentKind(value?: string | null): DocumentKind | null {
  const extension = getDocumentExtension(value);
  if (!extension) return null;
  if (extension === 'pdf') return 'pdf';
  if (['jpg', 'jpeg', 'png', 'webp'].includes(extension)) return 'image';
  return null;
}

function isSafeDriverDocumentUrl(value?: string | null) {
  const kind = getDocumentKind(value);
  if (!kind || !value) {
    return false;
  }

  try {
    const parsed = new URL(value);
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) {
      return false;
    }

    const supabaseOrigin = new URL(supabaseUrl).origin;
    if (parsed.origin !== supabaseOrigin) {
      return false;
    }

    return SAFE_STORAGE_SEGMENTS.some((segment) => parsed.pathname.includes(segment));
  } catch {
    return false;
  }
}

function getSelectedDocument(label: string, url?: string | null): SelectedDocument | null {
  const kind = getDocumentKind(url);
  if (!kind || !url || !isSafeDriverDocumentUrl(url)) {
    return null;
  }

  return { kind, label, url };
}

function DocumentTile({
  label,
  url,
  onOpen,
  compact = false,
}: {
  compact?: boolean;
  label: string;
  onOpen: (document: SelectedDocument) => void;
  url?: string | null;
}) {
  const safeDocument = getSelectedDocument(label, url);
  const unsafeValue = Boolean(url) && !safeDocument;
  const containerClass = compact
    ? 'h-16 rounded overflow-hidden border border-gray-200'
    : 'w-full h-32 rounded-lg overflow-hidden border border-gray-200';

  if (!url) {
    return (
      <div className={`${containerClass} flex items-center justify-center bg-gray-100 text-xs text-gray-400`}>
        No file
      </div>
    );
  }

  if (!safeDocument) {
    return (
      <div className={`${containerClass} flex flex-col items-center justify-center bg-red-50 px-2 text-center`}>
        <ShieldAlert size={compact ? 16 : 18} className="mb-1 text-red-500" />
        <span className="text-xs font-medium text-red-600">
          {unsafeValue ? 'Blocked unsafe file' : 'Unsupported file'}
        </span>
      </div>
    );
  }

  if (safeDocument.kind === 'pdf') {
    return (
      <button
        className={`${containerClass} flex flex-col items-center justify-center bg-red-50 text-red-700 transition-opacity hover:opacity-80`}
        onClick={() => onOpen(safeDocument)}
      >
        <FileText size={compact ? 18 : 26} />
        <span className={`mt-1 ${compact ? 'text-[10px]' : 'text-xs'} font-medium`}>View PDF</span>
      </button>
    );
  }

  return (
    <button
      className={`${containerClass} bg-gray-100 transition-opacity hover:opacity-80`}
      onClick={() => onOpen(safeDocument)}
    >
      <img
        src={safeDocument.url}
        alt={label}
        className="h-full w-full object-cover"
      />
    </button>
  );
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
  const [selectedDocument, setSelectedDocument] = useState<SelectedDocument | null>(null);
  const [activeTab, setActiveTab] = useState<'details' | 'history' | 'wallet'>('details');
  const [verificationHistory, setVerificationHistory] = useState<VerificationHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [walletInfo, setWalletInfo] = useState<any>(null);
  const [walletTransactions, setWalletTransactions] = useState<any[]>([]);
  const [walletLoading, setWalletLoading] = useState(false);

  useEffect(() => {
    if (params.id) {
      fetchDriver(params.id as string);
      fetchVerificationHistory(params.id as string);
      fetchWalletInfo(params.id as string);
    }
  }, [params.id]);

  async function sendDriverAppNotification(userId: string, title: string, body: string, data: Record<string, any>) {
    return sendNotificationToAudience('single', title, body, userId, 'driver', data);
  }

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

  async function fetchWalletInfo(id: string) {
    setWalletLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_driver_wallet_info', { p_driver_id: id });
      if (!error && data) setWalletInfo(data);

      const { data: txns, error: txnError } = await supabase
        .from('driver_wallet_transactions')
        .select('*')
        .eq('driver_id', id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (!txnError) setWalletTransactions(txns || []);
    } catch (err) { console.error('Wallet fetch error:', err); }
    setWalletLoading(false);
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

      const notificationResult = await sendDriverAppNotification(
        driver.user_id,
        'Account Approved!',
        'Your driver account has been verified. You can now start accepting rides!',
        { type: 'verification_approved', target_app: 'driver' }
      );

      if (!notificationResult.success) {
        console.warn('Driver approval notification failed:', notificationResult.error);
      }

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

      const notificationResult = await sendDriverAppNotification(
        driver.user_id,
        'Verification Update',
        'Your driver verification was not approved. Please check the app for details.',
        { type: 'verification_rejected', reason: rejectionReason, target_app: 'driver' }
      );

      if (!notificationResult.success) {
        console.warn('Driver rejection notification failed:', notificationResult.error);
      }

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

  async function toggleDriverAppAccess(nextEnabled: boolean) {
    if (!driver) return;
    setActionLoading(true);

    try {
      const response = await fetch('/api/drivers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: driver.id,
          driver_app_enabled: nextEnabled,
        }),
      });

      if (!response.ok) {
        throw new Error(nextEnabled ? 'Failed to restore driver access' : 'Failed to suspend driver');
      }

      const notificationResult = await sendDriverAppNotification(
        driver.user_id,
        nextEnabled ? 'Driver Access Restored' : 'Driver Account Suspended',
        nextEnabled
          ? 'Your driver app access has been restored. You can sign in and continue driving.'
          : 'Your driver app access has been suspended. Please contact support for help.',
        {
          type: nextEnabled ? 'driver_access_restored' : 'driver_access_suspended',
          target_app: 'driver',
        }
      );

      if (!notificationResult.success) {
        console.warn('Driver access notification failed:', notificationResult.error);
      }

      toast.success(nextEnabled ? 'Driver access restored' : 'Driver suspended');
      fetchDriver(driver.id);
    } catch (error: any) {
      toast.error(error.message || 'Failed to update driver access');
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

            <div className={`mt-3 px-4 py-2 rounded-lg text-center font-medium border ${
              typeof driver.driver_app_enabled === 'boolean' && driver.driver_app_enabled === false
                ? 'bg-red-50 text-red-700 border-red-200'
                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
            }`}>
              Driver App {typeof driver.driver_app_enabled === 'boolean'
                ? (driver.driver_app_enabled === false ? 'SUSPENDED' : 'ENABLED')
                : 'MIGRATION REQUIRED'}
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
              <div className="flex justify-between items-center">
                <span className="text-gray-500 flex items-center gap-2"><Users size={14} /> Referrals</span>
                <span className="font-semibold text-gray-900">{driver.referral_count ?? 0}</span>
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
              
              {driver.verification_status === 'approved' && typeof driver.driver_app_enabled === 'boolean' && driver.driver_app_enabled !== false && (
                <button
                  onClick={() => toggleDriverAppAccess(false)}
                  disabled={actionLoading}
                  className="w-full bg-red-100 text-red-600 py-3 rounded-lg font-medium hover:bg-red-200 disabled:opacity-50"
                >
                  {actionLoading ? 'Processing...' : 'Suspend Driver App'}
                </button>
              )}

              {driver.verification_status === 'approved' && typeof driver.driver_app_enabled === 'boolean' && driver.driver_app_enabled === false && (
                <button
                  onClick={() => toggleDriverAppAccess(true)}
                  disabled={actionLoading}
                  className="w-full bg-green-100 text-green-700 py-3 rounded-lg font-medium hover:bg-green-200 disabled:opacity-50"
                >
                  {actionLoading ? 'Processing...' : 'Restore Driver Access'}
                </button>
              )}

              {/* Reject Application Button */}
              {driver.verification_status === 'pending' && (
                  <button
                    onClick={() => {
                        setRejectionReason('');
                        setShowRejectModal(true);
                    }}
                    disabled={actionLoading}
                    className="w-full bg-red-100 text-red-600 py-3 rounded-lg font-medium hover:bg-red-200 disabled:opacity-50"
                  >
                    Reject Application
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
              <button
                onClick={() => setActiveTab('wallet')}
                className={`flex-1 px-6 py-4 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                  activeTab === 'wallet'
                    ? 'text-orange-600 border-b-2 border-orange-600 bg-orange-50/50'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Wallet size={16} />
                Wallet
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
                      <DocumentTile label={doc.label} onOpen={setSelectedDocument} url={doc.url} />
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : activeTab === 'history' ? (
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
                                    <DocumentTile compact label="License" onOpen={setSelectedDocument} url={entry.document_snapshot.license_image_url} />
                                  )}
                                  {entry.document_snapshot.rc_image_url && (
                                    <DocumentTile compact label="RC" onOpen={setSelectedDocument} url={entry.document_snapshot.rc_image_url} />
                                  )}
                                  {entry.document_snapshot.insurance_image_url && (
                                    <DocumentTile compact label="Insurance" onOpen={setSelectedDocument} url={entry.document_snapshot.insurance_image_url} />
                                  )}
                                  {entry.document_snapshot.vehicle_image_url && (
                                    <DocumentTile compact label="Vehicle" onOpen={setSelectedDocument} url={entry.document_snapshot.vehicle_image_url} />
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
          ) : activeTab === 'wallet' ? (
            /* Wallet Tab */
            <div className="space-y-4">
              {walletLoading ? (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex justify-center"><div className="animate-spin w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full" /></div>
              ) : (
                <>
                  {/* Balance Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                      <p className="text-xs text-gray-500 font-medium">Available</p>
                      <p className="text-xl font-bold text-green-600">₹{Number(walletInfo?.available_balance || 0).toLocaleString()}</p>
                    </div>
                    <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                      <p className="text-xs text-gray-500 font-medium">Pending (Escrow)</p>
                      <p className="text-xl font-bold text-yellow-600">₹{Number(walletInfo?.pending_balance || 0).toLocaleString()}</p>
                    </div>
                    <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                      <p className="text-xs text-gray-500 font-medium">Total Earned</p>
                      <p className="text-xl font-bold text-gray-900">₹{Number(walletInfo?.total_earned || 0).toLocaleString()}</p>
                    </div>
                    <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                      <p className="text-xs text-gray-500 font-medium">Total Withdrawn</p>
                      <p className="text-xl font-bold text-gray-900">₹{Number(walletInfo?.total_withdrawn || 0).toLocaleString()}</p>
                    </div>
                  </div>
                  {walletInfo?.pending_withdrawals > 0 && (
                    <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-sm text-orange-700">
                      ⏳ Pending withdrawal requests: ₹{Number(walletInfo.pending_withdrawals).toLocaleString()}
                    </div>
                  )}
                  {/* Transaction History */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Transaction History</h3>
                    {walletTransactions.length === 0 ? (
                      <div className="text-center py-8 text-gray-400"><Wallet size={32} className="mx-auto mb-2 opacity-50" /><p>No transactions yet</p></div>
                    ) : (
                      <div className="space-y-2">
                        {walletTransactions.map((tx: any) => (
                          <div key={tx.id} className="flex items-center gap-3 py-3 border-b border-gray-50 last:border-0">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${tx.direction === 'credit' ? 'bg-green-100' : 'bg-red-100'}`}>
                              {tx.direction === 'credit' ? <ArrowDownCircle size={16} className="text-green-600" /> : <ArrowUpCircle size={16} className="text-red-600" />}
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-800">{tx.description || tx.type}</p>
                              <p className="text-xs text-gray-400">{new Date(tx.created_at).toLocaleString()}</p>
                            </div>
                            <div className={`text-sm font-bold ${tx.direction === 'credit' ? 'text-green-600' : 'text-red-600'}`}>
                              {tx.direction === 'credit' ? '+' : '-'}₹{Number(tx.amount).toLocaleString()}
                            </div>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${tx.status === 'completed' ? 'bg-green-100 text-green-700' : tx.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'}`}>{tx.status}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Reject Application</h3>
            <p className="text-gray-500 mb-4">Please provide a reason for rejection:</p>
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
                {actionLoading ? 'Processing...' : 'Reject'}
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
      {selectedDocument && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6"
          onClick={() => setSelectedDocument(null)}
        >
          <div
            className="relative h-[90vh] w-[min(92vw,1100px)] rounded-xl bg-white p-4"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between border-b border-gray-200 pb-3">
              <div>
                <p className="font-semibold text-gray-900">{selectedDocument.label}</p>
                <p className="text-xs uppercase text-gray-500">{selectedDocument.kind}</p>
              </div>
              <a
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                href={selectedDocument.url}
                rel="noopener noreferrer"
                target="_blank"
              >
                <ExternalLink size={16} />
                Open in new tab
              </a>
            </div>

            {selectedDocument.kind === 'pdf' ? (
              <iframe
                className="h-[calc(90vh-88px)] w-full rounded-lg border border-gray-200"
                sandbox="allow-downloads allow-same-origin"
                src={selectedDocument.url}
                title={selectedDocument.label}
              />
            ) : (
              <img
                src={selectedDocument.url}
                alt={selectedDocument.label}
                className="max-h-[calc(90vh-88px)] w-full object-contain"
              />
            )}
          </div>
          <button
            className="absolute right-4 top-4 text-2xl text-white hover:text-gray-300"
            onClick={() => setSelectedDocument(null)}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
