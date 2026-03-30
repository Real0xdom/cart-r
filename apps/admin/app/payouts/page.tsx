'use client';
import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import { Wallet, CheckCircle, XCircle, Clock, RefreshCw, Search, Filter, ArrowUpRight, AlertCircle, Banknote } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface Withdrawal {
  id: string;
  driver_id: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected' | 'paid';
  notes: string | null;
  admin_notes: string | null;
  payout_reference: string | null;
  payout_status: string | null;
  payout_error: string | null;
  created_at: string;
  updated_at: string;
  processed_at: string | null;
  driver: {
    id: string;
    bank_details: any;
    beneficiary_id: string | null;
    beneficiary_status: string | null;
    user: {
      name: string;
      phone: string;
      email: string;
    };
  };
}

interface PayoutStats {
  pendingCount: number;
  pendingAmount: number;
  approvedCount: number;
  approvedAmount: number;
  paidCount: number;
  paidAmount: number;
  totalLiability: number;
}

export default function PayoutsPage() {
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [stats, setStats] = useState<PayoutStats>({ pendingCount: 0, pendingAmount: 0, approvedCount: 0, approvedAmount: 0, paidCount: 0, paidAmount: 0, totalLiability: 0 });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [showRejectModal, setShowRejectModal] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    fetchWithdrawals();
  }, [filter]);

  async function fetchWithdrawals() {
    setLoading(true);
    try {
      const response = await fetch(`/api/withdrawals?status=${filter}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch withdrawals');
      }

      setWithdrawals(data || []);

      // Calculate stats - use payout_status as source of truth
      const all = data || [];
      const pending = all.filter((w: Withdrawal) => w.status === 'pending');
      const approved = all.filter((w: Withdrawal) => w.status === 'approved');
      const paid = all.filter((w: Withdrawal) => w.payout_status === 'SUCCESS' || w.status === 'paid');
      
      setStats({
        pendingCount: pending.length,
        pendingAmount: pending.reduce((s: number, w: Withdrawal) => s + Number(w.amount), 0),
        approvedCount: approved.length,
        approvedAmount: approved.reduce((s: number, w: Withdrawal) => s + Number(w.amount), 0),
        paidCount: paid.length,
        paidAmount: paid.reduce((s: number, w: Withdrawal) => s + Number(w.amount), 0),
        totalLiability: pending.reduce((s: number, w: Withdrawal) => s + Number(w.amount), 0) + approved.reduce((s: number, w: Withdrawal) => s + Number(w.amount), 0),
      });
    } catch (error: any) {
      toast.error('Failed to load withdrawals: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(withdrawalId: string) {
    setActionLoading(withdrawalId);
    try {
      const response = await fetch('/api/withdrawals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve', withdrawalId }),
      });
      const data = await response.json();
      
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to approve withdrawal');
      }

      toast.success('Withdrawal approved!');

      // Try to process the payout via edge function
      try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        const fnResponse = await fetch(`${supabaseUrl}/functions/v1/process-withdrawal`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({ withdrawal_id: withdrawalId }),
        });
        const result = await fnResponse.json();
        if (result.success) {
          toast.success(result.mode === 'automatic' ? 'Bank transfer initiated!' : 'Marked for manual processing');
        }
      } catch (payoutErr) {
        console.warn('Auto-payout skipped:', payoutErr);
      }

      fetchWithdrawals();
    } catch (error: any) {
      toast.error('Failed to approve: ' + error.message);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleReject(withdrawalId: string) {
    if (!rejectReason.trim()) {
      toast.error('Please provide a reason for rejection');
      return;
    }
    setActionLoading(withdrawalId);
    try {
      const response = await fetch('/api/withdrawals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', withdrawalId, reason: rejectReason }),
      });
      const data = await response.json();
      
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to reject withdrawal');
      }

      toast.success('Withdrawal rejected and balance refunded');
      setShowRejectModal(null);
      setRejectReason('');
      fetchWithdrawals();
    } catch (error: any) {
      toast.error('Failed to reject: ' + error.message);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleMarkPaid(withdrawalId: string) {
    setActionLoading(withdrawalId);
    try {
      const response = await fetch('/api/withdrawals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_paid', withdrawalId }),
      });
      const data = await response.json();
      
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to mark withdrawal as paid');
      }

      toast.success('Marked as paid');
      fetchWithdrawals();
    } catch (error: any) {
      toast.error('Failed: ' + error.message);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleCheckStatus(withdrawalId: string) {
    setActionLoading(withdrawalId);
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      
      const response = await fetch(`${supabaseUrl}/functions/v1/check-transfer-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({ withdrawal_id: withdrawalId }),
      });
      
      const data = await response.json();
      
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to check status');
      }

      const result = data.results?.[0];
      if (result?.updated) {
        toast.success(`Status updated: ${result.old_status} → ${result.new_status}`);
      } else {
        toast.success(`Status: ${result?.status || 'No change'}`);
      }
      
      fetchWithdrawals();
    } catch (error: any) {
      toast.error('Failed to check status: ' + error.message);
    } finally {
      setActionLoading(null);
    }
  }

  const fmt = (n: number) => '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 0 });

  const getStatusBadge = (status: string) => {
    const map: Record<string, { bg: string; text: string; icon: any }> = {
      pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: <Clock size={14} /> },
      approved: { bg: 'bg-blue-100', text: 'text-blue-800', icon: <ArrowUpRight size={14} /> },
      paid: { bg: 'bg-green-100', text: 'text-green-800', icon: <CheckCircle size={14} /> },
      rejected: { bg: 'bg-red-100', text: 'text-red-800', icon: <XCircle size={14} /> },
      failed: { bg: 'bg-red-100', text: 'text-red-800', icon: <XCircle size={14} /> },
      reversed: { bg: 'bg-orange-100', text: 'text-orange-800', icon: <XCircle size={14} /> },
    };
    const s = map[status] || map.pending;
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${s.bg} ${s.text}`}>
        {s.icon} {status.toUpperCase()}
      </span>
    );
  };

  const getPayoutStatusBadge = (payoutStatus: string | null) => {
    if (!payoutStatus) return <span className="text-gray-300">—</span>;
    
    const map: Record<string, { bg: string; text: string }> = {
      RECEIVED: { bg: 'bg-blue-50', text: 'text-blue-700' },
      PENDING: { bg: 'bg-yellow-50', text: 'text-yellow-700' },
      SUCCESS: { bg: 'bg-green-50', text: 'text-green-700' },
      FAILED: { bg: 'bg-red-50', text: 'text-red-700' },
      ERROR: { bg: 'bg-red-50', text: 'text-red-700' },
      REVERSED: { bg: 'bg-orange-50', text: 'text-orange-700' },
    };
    const s = map[payoutStatus] || { bg: 'bg-gray-50', text: 'text-gray-700' };
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${s.bg} ${s.text}`}>
        {payoutStatus}
      </span>
    );
  };

  const maskAccount = (bank: any) => {
    if (!bank?.account_number) return 'N/A';
    const acc = String(bank.account_number);
    return '••••' + acc.slice(-4) + ' | ' + (bank.ifsc_code || '');
  };

  const filtered = withdrawals.filter(w => {
    if (!search) return true;
    const name = w.driver?.user?.name || '';
    const phone = w.driver?.user?.phone || '';
    return name.toLowerCase().includes(search.toLowerCase()) || phone.includes(search);
  });

  return (
    <div className="min-h-screen bg-[var(--color-brand-cream)] font-sans">
      <Sidebar />
      <div className="ml-72 p-8 max-w-[1600px]">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-1">Payouts Management</h1>
            <p className="text-gray-500 text-sm">Manage driver withdrawal requests and bank transfers</p>
          </div>
          <button onClick={fetchWithdrawals} className="px-4 py-2 bg-white text-gray-600 rounded-xl font-semibold shadow-sm border border-gray-200 hover:bg-gray-50 transition-all flex items-center gap-2">
            <RefreshCw size={16} /> Refresh
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-yellow-50 flex items-center justify-center"><Clock size={20} className="text-yellow-600" /></div>
              <span className="text-sm font-medium text-gray-500">Pending</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{fmt(stats.pendingAmount)}</p>
            <p className="text-xs text-gray-400 mt-1">{stats.pendingCount} request{stats.pendingCount !== 1 ? 's' : ''}</p>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center"><ArrowUpRight size={20} className="text-blue-600" /></div>
              <span className="text-sm font-medium text-gray-500">Approved</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{fmt(stats.approvedAmount)}</p>
            <p className="text-xs text-gray-400 mt-1">{stats.approvedCount} in process</p>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center"><CheckCircle size={20} className="text-green-600" /></div>
              <span className="text-sm font-medium text-gray-500">Successful Payouts</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{fmt(stats.paidAmount)}</p>
            <p className="text-xs text-gray-400 mt-1">{stats.paidCount} transfers</p>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-orange-200 shadow-sm bg-gradient-to-br from-orange-50 to-white">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center"><AlertCircle size={20} className="text-orange-600" /></div>
              <span className="text-sm font-medium text-orange-700">Total Liability</span>
            </div>
            <p className="text-2xl font-bold text-orange-800">{fmt(stats.totalLiability)}</p>
            <p className="text-xs text-orange-500 mt-1">Pending + Approved</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-6 flex items-center gap-4">
          <div className="flex items-center bg-gray-50 rounded-xl px-3 py-2 flex-1 max-w-md">
            <Search size={16} className="text-gray-400 mr-2" />
            <input type="text" placeholder="Search by driver name or phone..." value={search} onChange={(e) => setSearch(e.target.value)} className="bg-transparent w-full text-sm focus:outline-none" />
          </div>
          <div className="flex gap-2">
            {['all', 'pending', 'approved', 'paid', 'rejected'].map(f => (
              <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${filter === f ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="py-16 flex justify-center"><div className="animate-spin w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full" /></div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-gray-400">
              <Wallet size={48} className="mx-auto mb-3 opacity-50" />
              <p className="text-lg font-medium">No withdrawals found</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left py-3 px-4 text-xs font-bold text-gray-500 uppercase">Driver</th>
                  <th className="text-left py-3 px-4 text-xs font-bold text-gray-500 uppercase">Amount</th>
                  <th className="text-left py-3 px-4 text-xs font-bold text-gray-500 uppercase">Bank</th>
                  <th className="text-left py-3 px-4 text-xs font-bold text-gray-500 uppercase">Status</th>
                  <th className="text-left py-3 px-4 text-xs font-bold text-gray-500 uppercase">Date</th>
                  <th className="text-left py-3 px-4 text-xs font-bold text-gray-500 uppercase">Payout</th>
                  <th className="text-right py-3 px-4 text-xs font-bold text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((w) => (
                  <tr key={w.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-gray-900 text-sm">{w.driver?.user?.name || 'Unknown'}</div>
                      <div className="text-xs text-gray-400">{w.driver?.user?.phone || ''}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-bold text-gray-900 text-lg">{fmt(w.amount)}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-xs text-gray-500 font-mono">{maskAccount(w.driver?.bank_details)}</span>
                    </td>
                    <td className="py-3 px-4">
                      {w.payout_reference ? (
                        <div>
                          <div className="text-xs font-mono text-gray-500 mb-1">{w.payout_reference}</div>
                          {getPayoutStatusBadge(w.payout_status)}
                          {w.payout_error && (
                            <div className="text-xs text-red-500 mt-1" title={w.payout_error}>
                              Error: {w.payout_error.substring(0, 30)}...
                            </div>
                          )}
                        </div>
                      ) : getStatusBadge(w.status)}
                    </td>
                    <td className="py-3 px-4">
                      {w.payout_reference ? (
                        <div>
                          <div className="text-xs font-mono text-gray-500 mb-1">{w.payout_reference}</div>
                          {getPayoutStatusBadge(w.payout_status)}
                          {w.payout_error && (
                            <div className="text-xs text-red-500 mt-1" title={w.payout_error}>
                              Error: {w.payout_error.substring(0, 30)}...
                            </div>
                          )}
                        </div>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex gap-2 justify-end">
                        {w.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleApprove(w.id)}
                              disabled={actionLoading === w.id}
                              className="px-3 py-1.5 bg-green-600 text-white text-xs font-bold rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                            >
                              {actionLoading === w.id ? '...' : 'Approve'}
                            </button>
                            <button
                              onClick={() => { setShowRejectModal(w.id); setRejectReason(''); }}
                              disabled={actionLoading === w.id}
                              className="px-3 py-1.5 bg-red-100 text-red-600 text-xs font-bold rounded-lg hover:bg-red-200 disabled:opacity-50 transition-colors"
                            >
                              Reject
                            </button>
                          </>
                        )}
                        {w.status === 'approved' && (
                          <button
                            onClick={() => handleMarkPaid(w.id)}
                            disabled={actionLoading === w.id}
                            className="px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-1"
                          >
                            <Banknote size={14} /> Mark Paid
                          </button>
                        )}
                        {(w.payout_status === 'RECEIVED' || w.payout_status === 'PENDING' || w.payout_status === 'ERROR' || (w.payout_reference && !w.payout_status)) && (
                          <button
                            onClick={() => handleCheckStatus(w.id)}
                            disabled={actionLoading === w.id}
                            className="px-3 py-1.5 bg-purple-100 text-purple-700 text-xs font-bold rounded-lg hover:bg-purple-200 disabled:opacity-50 transition-colors flex items-center gap-1"
                          >
                            <RefreshCw size={14} /> Check Status
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Reject Withdrawal</h3>
            <p className="text-sm text-gray-500 mb-4">The amount will be refunded to the driver&apos;s available balance.</p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Reason for rejection..."
              className="w-full p-3 border border-gray-200 rounded-xl mb-4 h-28 resize-none text-sm focus:outline-none focus:border-orange-500"
            />
            <div className="flex gap-3">
              <button onClick={() => setShowRejectModal(null)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 font-medium text-sm">Cancel</button>
              <button
                onClick={() => handleReject(showRejectModal)}
                disabled={actionLoading === showRejectModal}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 disabled:opacity-50 font-medium text-sm"
              >
                {actionLoading === showRejectModal ? 'Processing...' : 'Reject & Refund'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
