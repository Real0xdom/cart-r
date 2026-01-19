"use strict";
'use client';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = DriverDetailPage;
const react_1 = require("react");
const navigation_1 = require("next/navigation");
const supabase_1 = require("@/lib/supabase");
const link_1 = __importDefault(require("next/link"));
const image_1 = __importDefault(require("next/image"));
const react_hot_toast_1 = __importDefault(require("react-hot-toast"));
const lucide_react_1 = require("lucide-react");
function DriverDetailPage() {
    var _a, _b, _c, _d;
    const params = (0, navigation_1.useParams)();
    const router = (0, navigation_1.useRouter)();
    const [driver, setDriver] = (0, react_1.useState)(null);
    const [loading, setLoading] = (0, react_1.useState)(true);
    const [actionLoading, setActionLoading] = (0, react_1.useState)(false);
    const [rejectionReason, setRejectionReason] = (0, react_1.useState)('');
    const [showRejectModal, setShowRejectModal] = (0, react_1.useState)(false);
    const [selectedImage, setSelectedImage] = (0, react_1.useState)(null);
    const [activeTab, setActiveTab] = (0, react_1.useState)('details');
    const [verificationHistory, setVerificationHistory] = (0, react_1.useState)([]);
    const [historyLoading, setHistoryLoading] = (0, react_1.useState)(false);
    (0, react_1.useEffect)(() => {
        if (params.id) {
            fetchDriver(params.id);
            fetchVerificationHistory(params.id);
        }
    }, [params.id]);
    async function fetchDriver(id) {
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
        }
        catch (err) {
            console.error('Error:', err);
        }
        setLoading(false);
    }
    async function fetchVerificationHistory(id) {
        setHistoryLoading(true);
        try {
            const response = await fetch(`/api/drivers/${id}/history`);
            if (response.ok) {
                const historyData = await response.json();
                setVerificationHistory(historyData);
            }
        }
        catch (err) {
            console.error('Error fetching history:', err);
        }
        setHistoryLoading(false);
    }
    async function approveDriver() {
        if (!driver)
            return;
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
            await supabase_1.supabase.from('notifications').insert({
                user_id: driver.user_id,
                title: 'Account Approved! 🎉',
                body: 'Your driver account has been verified. You can now start accepting rides!',
                data: { type: 'verification_approved' },
            });
            react_hot_toast_1.default.success('Driver approved successfully!');
            fetchDriver(driver.id);
            fetchVerificationHistory(driver.id);
        }
        catch (error) {
            react_hot_toast_1.default.error('Failed to approve driver: ' + error.message);
        }
        setActionLoading(false);
    }
    async function rejectDriver() {
        if (!driver || !rejectionReason.trim()) {
            react_hot_toast_1.default.error('Please provide a rejection reason');
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
            await supabase_1.supabase.from('notifications').insert({
                user_id: driver.user_id,
                title: 'Verification Update',
                body: 'Your driver verification was not approved. Please check the app for details.',
                data: { type: 'verification_rejected', reason: rejectionReason },
            });
            react_hot_toast_1.default.success('Driver rejected');
            setShowRejectModal(false);
            setRejectionReason('');
            fetchDriver(driver.id);
            fetchVerificationHistory(driver.id);
        }
        catch (error) {
            react_hot_toast_1.default.error('Failed to reject driver: ' + error.message);
        }
        setActionLoading(false);
    }
    const getStatusBadge = (status) => {
        const styles = {
            pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
            approved: 'bg-green-100 text-green-800 border-green-200',
            rejected: 'bg-red-100 text-red-800 border-red-200',
        };
        return styles[status] || 'bg-gray-100 text-gray-800';
    };
    const getActionBadge = (action) => {
        const config = {
            submitted: { bg: 'bg-blue-100', text: 'text-blue-800', icon: '📝', label: 'Application Submitted' },
            approved: { bg: 'bg-green-100', text: 'text-green-800', icon: '✅', label: 'Approved' },
            rejected: { bg: 'bg-red-100', text: 'text-red-800', icon: '❌', label: 'Rejected' },
            resubmitted: { bg: 'bg-orange-100', text: 'text-orange-800', icon: '🔄', label: 'Resubmitted' },
        };
        return config[action] || { bg: 'bg-gray-100', text: 'text-gray-800', icon: '📋', label: action };
    };
    if (loading) {
        return (<div className="min-h-screen bg-[var(--color-brand-cream)] p-8 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full"/>
      </div>);
    }
    if (!driver) {
        return (<div className="min-h-screen bg-[var(--color-brand-cream)] p-8 flex items-center justify-center">
        <div className="text-gray-500">Driver not found</div>
      </div>);
    }
    const documents = [
        { label: 'Driving License', url: driver.license_image_url },
        { label: 'Vehicle RC', url: driver.rc_image_url },
        { label: 'Insurance', url: driver.insurance_image_url },
        { label: 'Vehicle Photo', url: driver.vehicle_image_url },
    ];
    return (<div className="min-h-screen bg-[var(--color-brand-cream)] p-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <link_1.default href="/drivers" className="flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors">
          <lucide_react_1.ArrowLeft size={18}/> Back to Drivers
        </link_1.default>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Driver Info Card */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="text-center mb-6">
              <div className="w-24 h-24 bg-gradient-to-br from-orange-100 to-orange-50 rounded-full mx-auto mb-4 flex items-center justify-center overflow-hidden border-4 border-white shadow-lg">
                {((_a = driver.user) === null || _a === void 0 ? void 0 : _a.avatar_url) ? (<image_1.default src={driver.user.avatar_url} alt={driver.user.name} width={96} height={96} className="rounded-full object-cover"/>) : (<lucide_react_1.User size={40} className="text-orange-500"/>)}
              </div>
              <h2 className="text-xl font-bold text-gray-900">{((_b = driver.user) === null || _b === void 0 ? void 0 : _b.name) || 'Unknown Driver'}</h2>
              <div className="flex items-center justify-center gap-2 text-gray-500 mt-1">
                <lucide_react_1.Phone size={14}/>
                <span>{((_c = driver.user) === null || _c === void 0 ? void 0 : _c.phone) || 'No phone'}</span>
              </div>
              <div className="flex items-center justify-center gap-2 text-gray-400 text-sm mt-1">
                <lucide_react_1.Mail size={14}/>
                <span>{((_d = driver.user) === null || _d === void 0 ? void 0 : _d.email) || 'No email'}</span>
              </div>
            </div>

            <div className={`px-4 py-2 rounded-lg text-center font-medium border ${getStatusBadge(driver.verification_status)}`}>
              {driver.verification_status.toUpperCase()}
            </div>

            {driver.rejection_reason && (<div className="mt-4 p-3 bg-red-50 rounded-lg">
                <p className="text-sm text-red-800">
                  <strong>Rejection Reason:</strong> {driver.rejection_reason}
                </p>
              </div>)}

            <div className="mt-6 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-500 flex items-center gap-2"><lucide_react_1.Star size={14}/> Rating</span>
                <span className="font-semibold text-gray-900">
                  {driver.rating !== null && driver.rating !== undefined
            ? Number(driver.rating).toFixed(1)
            : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500 flex items-center gap-2"><lucide_react_1.MapPin size={14}/> Total Trips</span>
                <span className="font-semibold text-gray-900">
                  {driver.total_trips !== null && driver.total_trips !== undefined
            ? driver.total_trips
            : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500 flex items-center gap-2"><lucide_react_1.CreditCard size={14}/> Earnings</span>
                <span className="font-semibold text-gray-900">
                  {driver.total_earnings !== null && driver.total_earnings !== undefined
            ? `₹${Number(driver.total_earnings).toFixed(0)}`
            : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500 flex items-center gap-2"><lucide_react_1.Calendar size={14}/> Member Since</span>
                <span className="font-semibold text-gray-900">{new Date(driver.created_at).toLocaleDateString()}</span>
              </div>
            </div>

            {/* Action Buttons */}
            {driver.verification_status === 'pending' && (<div className="mt-6 space-y-3">
                <button onClick={approveDriver} disabled={actionLoading} className="w-full bg-green-600 text-white py-3 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50">
                  {actionLoading ? 'Processing...' : '✓ Approve Driver'}
                </button>
                <button onClick={() => setShowRejectModal(true)} disabled={actionLoading} className="w-full bg-red-100 text-red-600 py-3 rounded-lg font-medium hover:bg-red-200 disabled:opacity-50">
                  ✕ Reject Application
                </button>
              </div>)}
          </div>
        </div>

        {/* Content Area with Tabs */}
        <div className="lg:col-span-2 space-y-6">
          {/* Tabs */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="flex border-b border-gray-100">
              <button onClick={() => setActiveTab('details')} className={`flex-1 px-6 py-4 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${activeTab === 'details'
            ? 'text-orange-600 border-b-2 border-orange-600 bg-orange-50/50'
            : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}>
                <lucide_react_1.FileText size={16}/>
                Details & Documents
              </button>
              <button onClick={() => setActiveTab('history')} className={`flex-1 px-6 py-4 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${activeTab === 'history'
            ? 'text-orange-600 border-b-2 border-orange-600 bg-orange-50/50'
            : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}>
                <lucide_react_1.History size={16}/>
                Verification History
                {verificationHistory.length > 0 && (<span className="bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full text-xs">
                    {verificationHistory.length}
                  </span>)}
              </button>
            </div>
          </div>

          {/* Tab Content */}
          {activeTab === 'details' ? (<>
              {/* Vehicle Info */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Vehicle Information</h3>
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
                  {documents.map((doc) => (<div key={doc.label} className="text-center">
                      <p className="text-gray-500 text-sm mb-2">{doc.label}</p>
                      {doc.url ? (<button onClick={() => setSelectedImage(doc.url)} className="w-full h-32 bg-gray-100 rounded-lg overflow-hidden hover:opacity-80 transition-opacity">
                          <img src={doc.url} alt={doc.label} className="w-full h-full object-cover"/>
                        </button>) : (<div className="w-full h-32 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400">
                          No file
                        </div>)}
                    </div>))}
                </div>
              </div>
            </>) : (
        /* Verification History Tab */
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-6">Verification History</h3>
              
              {historyLoading ? (<div className="flex justify-center py-8">
                  <div className="animate-spin w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full"/>
                </div>) : verificationHistory.length === 0 ? (<div className="text-center py-8 text-gray-500">
                  <lucide_react_1.History size={40} className="mx-auto mb-3 text-gray-300"/>
                  <p>No verification history yet</p>
                  <p className="text-sm text-gray-400 mt-1">History will appear here when verification actions are taken</p>
                </div>) : (<div className="relative">
                  {/* Timeline line */}
                  <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200"/>
                  
                  {/* Timeline entries */}
                  <div className="space-y-6">
                    {verificationHistory.map((entry, index) => {
                    const badge = getActionBadge(entry.action);
                    return (<div key={entry.id} className="relative pl-10">
                          {/* Timeline dot */}
                          <div className={`absolute left-2 w-5 h-5 rounded-full border-2 border-white shadow ${badge.bg} flex items-center justify-center`}>
                            <span className="text-xs">{badge.icon}</span>
                          </div>
                          
                          {/* Entry card */}
                          <div className={`p-4 rounded-lg border ${badge.bg} border-opacity-50`}>
                            <div className="flex items-center justify-between mb-2">
                              <span className={`font-medium ${badge.text}`}>{badge.label}</span>
                              <span className="text-xs text-gray-500 flex items-center gap-1">
                                <lucide_react_1.Clock size={12}/>
                                {new Date(entry.created_at).toLocaleString()}
                              </span>
                            </div>
                            
                            {/* Rejection reason */}
                            {entry.rejection_reason && (<div className="mt-2 p-3 bg-white rounded-lg border border-red-200">
                                <p className="text-sm font-medium text-red-800 mb-1">Rejection Reason:</p>
                                <p className="text-sm text-red-700">{entry.rejection_reason}</p>
                              </div>)}
                            
                            {/* Document snapshot */}
                            {entry.document_snapshot && (<div className="mt-3">
                                <p className="text-xs text-gray-500 mb-2">Documents at time of {entry.action}:</p>
                                <div className="grid grid-cols-4 gap-2">
                                  {entry.document_snapshot.license_image_url && (<button onClick={() => { var _a; return setSelectedImage(((_a = entry.document_snapshot) === null || _a === void 0 ? void 0 : _a.license_image_url) || null); }} className="h-16 bg-gray-100 rounded overflow-hidden hover:opacity-80">
                                      <img src={entry.document_snapshot.license_image_url} alt="License" className="w-full h-full object-cover"/>
                                    </button>)}
                                  {entry.document_snapshot.rc_image_url && (<button onClick={() => { var _a; return setSelectedImage(((_a = entry.document_snapshot) === null || _a === void 0 ? void 0 : _a.rc_image_url) || null); }} className="h-16 bg-gray-100 rounded overflow-hidden hover:opacity-80">
                                      <img src={entry.document_snapshot.rc_image_url} alt="RC" className="w-full h-full object-cover"/>
                                    </button>)}
                                  {entry.document_snapshot.insurance_image_url && (<button onClick={() => { var _a; return setSelectedImage(((_a = entry.document_snapshot) === null || _a === void 0 ? void 0 : _a.insurance_image_url) || null); }} className="h-16 bg-gray-100 rounded overflow-hidden hover:opacity-80">
                                      <img src={entry.document_snapshot.insurance_image_url} alt="Insurance" className="w-full h-full object-cover"/>
                                    </button>)}
                                  {entry.document_snapshot.vehicle_image_url && (<button onClick={() => { var _a; return setSelectedImage(((_a = entry.document_snapshot) === null || _a === void 0 ? void 0 : _a.vehicle_image_url) || null); }} className="h-16 bg-gray-100 rounded overflow-hidden hover:opacity-80">
                                      <img src={entry.document_snapshot.vehicle_image_url} alt="Vehicle" className="w-full h-full object-cover"/>
                                    </button>)}
                                </div>
                                {/* Vehicle info at time of action */}
                                <div className="mt-2 text-xs text-gray-500">
                                  <span className="mr-3">🚗 {entry.document_snapshot.vehicle_type}</span>
                                  <span className="mr-3">📋 {entry.document_snapshot.vehicle_number}</span>
                                  <span>🪪 {entry.document_snapshot.license_number}</span>
                                </div>
                              </div>)}
                          </div>
                        </div>);
                })}
                  </div>
                </div>)}
            </div>)}
        </div>
      </div>

      {/* Reject Modal */}
      {showRejectModal && (<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Reject Application</h3>
            <p className="text-gray-500 mb-4">Please provide a reason for rejection:</p>
            <textarea value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} placeholder="e.g., Blurry document images, expired license, etc." className="w-full p-3 border border-gray-200 rounded-lg mb-4 h-32 resize-none"/>
            <div className="flex gap-3">
              <button onClick={() => setShowRejectModal(false)} className="flex-1 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={rejectDriver} disabled={actionLoading} className="flex-1 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50">
                {actionLoading ? 'Rejecting...' : 'Reject'}
              </button>
            </div>
          </div>
        </div>)}

      {/* Image Viewer Modal */}
      {selectedImage && (<div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 cursor-pointer" onClick={() => setSelectedImage(null)}>
          <img src={selectedImage} alt="Document" className="max-w-4xl max-h-[90vh] object-contain"/>
          <button className="absolute top-4 right-4 text-white text-2xl hover:text-gray-300" onClick={() => setSelectedImage(null)}>
            ✕
          </button>
        </div>)}
    </div>);
}
