'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Sidebar from '@/components/Sidebar';
import { IndianRupee, FileText, TrendingUp, RefreshCw, Search, Filter, X, MapPin, Circle, Truck, Package, Clock } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface Invoice {
  id: string;
  booking_id: string;
  invoice_number: string;
  invoice_date?: string;
  customer_name: string;
  customer_phone: string;
  driver_name: string;
  driver_phone: string;
  vehicle_type?: string;
  vehicle_number?: string;
  pickup_address?: string;
  dropoff_address?: string;
  pickup_time?: string;
  dropoff_time?: string;
  distance_km?: number;
  base_fare?: number;
  total_amount: number;
  payment_method: string;
  payment_status: string;
  created_at: string;
  platform_fee?: number;
  driver_payout?: number;
  gst_amount?: number;
  tip_amount?: number;
  addon_charges?: number;
  waiting_charges?: number;
  addons?: Array<{ name: string; price: number }>;
}

interface Stats {
  totalRevenue: number; totalInvoices: number; avgAmount: number;
  platformEarnings: number; driverPayouts: number; pendingAmount: number;
}

function formatCurrency(amount: number | null | undefined): string {
  const n = amount ?? 0;
  return `₹${Number(n).toFixed(2)}`;
}

function formatDate(dateString?: string): string {
  if (!dateString) return '—';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function formatInvoiceNumber(invoiceNumber: string): string {
  if (!invoiceNumber) return '—';
  if (invoiceNumber.startsWith('INV-')) return invoiceNumber;
  const year = new Date().getFullYear();
  return `INV-${year}-${invoiceNumber.padStart(6, '0')}`;
}

/* ── Invoice Detail Modal ─────────────────────────────────────────── */
function InvoiceModal({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <FileText className="text-orange-500" size={20} />
            <span className="text-lg font-bold text-gray-900">Invoice Details</span>
          </div>
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        {/* Invoice Content */}
        <div className="overflow-y-auto flex-1 p-6 space-y-5">

          {/* Invoice Header */}
          <div className="flex items-start justify-between bg-orange-50 rounded-2xl p-5">
            <div>
              <p className="text-2xl font-black text-orange-500">Cart-R</p>
              <p className="text-xs text-gray-500 mt-0.5">Goods Transportation Services</p>
            </div>
            <span className="bg-orange-500 text-white text-sm font-bold px-4 py-2 rounded-xl">INVOICE</span>
          </div>

          {/* Invoice Meta */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1">Invoice Number</p>
              <p className="text-sm font-bold text-gray-900">{formatInvoiceNumber(invoice.invoice_number)}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1">Invoice Date</p>
              <p className="text-sm font-bold text-gray-900">{formatDate(invoice.invoice_date || invoice.created_at)}</p>
            </div>
          </div>

          {/* Customer & Driver */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-blue-50 rounded-xl p-4">
              <p className="text-[10px] text-blue-400 uppercase font-bold tracking-wider mb-2">Customer Details</p>
              <p className="text-sm font-bold text-gray-900">{invoice.customer_name || '—'}</p>
              <p className="text-xs text-gray-500 mt-0.5">{invoice.customer_phone || ''}</p>
            </div>
            <div className="bg-purple-50 rounded-xl p-4">
              <p className="text-[10px] text-purple-400 uppercase font-bold tracking-wider mb-2">Driver Details</p>
              <p className="text-sm font-bold text-gray-900">{invoice.driver_name || '—'}</p>
              <p className="text-xs text-gray-500 mt-0.5">{invoice.driver_phone || ''}</p>
              {invoice.vehicle_number && <p className="text-xs text-gray-500">{invoice.vehicle_number}</p>}
            </div>
          </div>

          {/* Shipment Details */}
          {(invoice.pickup_address || invoice.dropoff_address) && (
            <div className="bg-gray-50 rounded-xl p-4 space-y-3">
              <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Shipment Details</p>

              {invoice.pickup_address && (
                <div className="flex items-start gap-3">
                  <Circle className="text-green-500 mt-0.5 shrink-0" size={12} fill="currentColor" />
                  <div className="min-w-0">
                    <p className="text-[10px] text-gray-400 uppercase font-bold">Pickup Location</p>
                    <p className="text-sm text-gray-900 mt-0.5">{invoice.pickup_address}</p>
                    {invoice.pickup_time && <p className="text-[10px] text-gray-400 mt-0.5">{formatDate(invoice.pickup_time)}</p>}
                  </div>
                </div>
              )}

              {invoice.pickup_address && invoice.dropoff_address && (
                <div className="ml-1.5 w-0.5 h-4 bg-gray-200 mx-[5px]" />
              )}

              {invoice.dropoff_address && (
                <div className="flex items-start gap-3">
                  <MapPin className="text-red-500 mt-0.5 shrink-0" size={12} fill="currentColor" />
                  <div className="min-w-0">
                    <p className="text-[10px] text-gray-400 uppercase font-bold">Drop Location</p>
                    <p className="text-sm text-gray-900 mt-0.5">{invoice.dropoff_address}</p>
                    {invoice.dropoff_time && <p className="text-[10px] text-gray-400 mt-0.5">{formatDate(invoice.dropoff_time)}</p>}
                  </div>
                </div>
              )}

              <div className="border-t border-gray-200 pt-3 grid grid-cols-2 gap-2">
                {invoice.vehicle_type && (
                  <div className="flex items-center gap-2">
                    <Truck size={12} className="text-gray-400" />
                    <span className="text-xs text-gray-600">{invoice.vehicle_type}</span>
                  </div>
                )}
                {(invoice.distance_km != null && invoice.distance_km > 0) && (
                  <div className="flex items-center gap-2">
                    <Package size={12} className="text-gray-400" />
                    <span className="text-xs text-gray-600">{Number(invoice.distance_km).toFixed(2)} km</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Charges Breakdown */}
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-3">Charges Breakdown</p>
            <div className="space-y-2">
              {(invoice.base_fare != null && invoice.base_fare > 0) && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Base Fare</span>
                  <span className="font-medium text-gray-900">{formatCurrency(invoice.base_fare)}</span>
                </div>
              )}
              {(invoice.tip_amount != null && invoice.tip_amount > 0) && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Tip</span>
                  <span className="font-medium text-gray-900">{formatCurrency(invoice.tip_amount)}</span>
                </div>
              )}
              {(invoice.addon_charges != null && invoice.addon_charges > 0) && (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Add-on Services</span>
                    <span className="font-medium text-gray-900">{formatCurrency(invoice.addon_charges)}</span>
                  </div>
                  {invoice.addons && invoice.addons.length > 0 && invoice.addons.map((addon, i) => (
                    <div key={i} className="flex justify-between text-xs pl-3">
                      <span className="text-gray-400">• {addon.name}</span>
                      <span className="text-gray-400">{formatCurrency(addon.price)}</span>
                    </div>
                  ))}
                </>
              )}
              {(invoice.waiting_charges != null && invoice.waiting_charges > 0) && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600"><Clock size={12} className="inline mr-1" />Waiting Charges</span>
                  <span className="font-medium text-gray-900">{formatCurrency(invoice.waiting_charges)}</span>
                </div>
              )}

              <div className="border-t-2 border-gray-900 pt-2 mt-2 flex justify-between">
                <span className="font-bold text-gray-900">Total Amount</span>
                <span className="text-lg font-black text-green-600">{formatCurrency(invoice.total_amount)}</span>
              </div>
            </div>
          </div>

          {/* Payment Info */}
          <div className="flex items-center justify-between bg-gray-50 rounded-xl p-4">
            <div>
              <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1">Payment Method</p>
              <p className="text-sm font-bold text-gray-900 uppercase">{invoice.payment_method}</p>
            </div>
            <span className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase ${
              invoice.payment_status === 'paid'
                ? 'bg-green-100 text-green-700'
                : invoice.payment_status === 'failed'
                ? 'bg-red-100 text-red-700'
                : invoice.payment_status === 'refunded'
                ? 'bg-purple-100 text-purple-700'
                : 'bg-yellow-100 text-yellow-700'
            }`}>{invoice.payment_status}</span>
          </div>

          {/* Footer */}
          <div className="text-center py-3 border-t border-gray-100">
            <p className="text-sm font-semibold text-gray-700">Thank you for using Cart-R!</p>
            <p className="text-xs text-gray-400 mt-0.5">For support, contact: support@cart-r.com</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Main Finance Page ────────────────────────────────────────────── */
export default function FinancePage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({ totalRevenue: 0, totalInvoices: 0, avgAmount: 0, platformEarnings: 0, driverPayouts: 0, pendingAmount: 0 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  useEffect(() => { fetchInvoices(); }, []);

  async function fetchInvoices() {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('invoices')
        .select('*')
        .order('created_at', { ascending: false }).limit(500);
      if (error) throw error;

      const inv = data || [];
      setInvoices(inv);

      const paid = inv.filter((i: Invoice) => i.payment_status === 'paid');
      const pending = inv.filter((i: Invoice) => i.payment_status !== 'paid');
      setStats({
        totalRevenue: paid.reduce((s: number, i: Invoice) => s + Number(i.total_amount || 0), 0),
        totalInvoices: inv.length,
        avgAmount: inv.length > 0 ? Math.round(inv.reduce((s: number, i: Invoice) => s + Number(i.total_amount || 0), 0) / inv.length) : 0,
        platformEarnings: paid.reduce((s: number, i: Invoice) => s + Number(i.platform_fee || 0), 0),
        driverPayouts: paid.reduce((s: number, i: Invoice) => s + Number(i.driver_payout || 0), 0),
        pendingAmount: pending.reduce((s: number, i: Invoice) => s + Number(i.total_amount || 0), 0),
      });
    } catch (e: any) { toast.error('Failed: ' + e.message); }
    finally { setLoading(false); }
  }

  const filtered = invoices.filter((i: Invoice) => {
    const q = search.toLowerCase();
    const matchSearch = !q || i.customer_name?.toLowerCase().includes(q) || i.driver_name?.toLowerCase().includes(q)
      || i.invoice_number?.toLowerCase().includes(q);
    const matchStatus = statusFilter === 'all' || i.payment_status === statusFilter;
    return matchSearch && matchStatus;
  });

  const getStatusColor = (s: string) => {
    switch (s) {
      case 'paid': return 'bg-green-100 text-green-700';
      case 'pending': return 'bg-yellow-100 text-yellow-700';
      case 'failed': return 'bg-red-100 text-red-700';
      case 'refunded': return 'bg-purple-100 text-purple-700';
      default: return 'bg-gray-100 text-gray-500';
    }
  };

  const fmt = (n: number) => '₹' + Number(n).toLocaleString('en-IN');

  return (
    <div className="min-h-screen bg-[var(--color-brand-cream)] font-sans">
      <Sidebar />
      <div className="ml-72 p-8 max-w-[1600px]">
        <div className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-1">Finance</h1>
            <p className="text-gray-500 text-sm">Track invoices, earnings, and financial overview</p>
          </div>
          <button onClick={fetchInvoices} className="px-4 py-2.5 bg-white text-gray-600 rounded-xl font-semibold shadow-sm border border-gray-200 hover:bg-gray-50 transition-all flex items-center gap-2">
            <RefreshCw size={16} /> Refresh
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          {[
            { label: 'Total Revenue', value: fmt(stats.totalRevenue), color: 'bg-green-50 text-green-600', icon: <IndianRupee size={18} /> },
            { label: 'Invoices', value: stats.totalInvoices, color: 'bg-blue-50 text-blue-600', icon: <FileText size={18} /> },
            { label: 'Avg Amount', value: fmt(stats.avgAmount), color: 'bg-orange-50 text-orange-600', icon: <TrendingUp size={18} /> },
            { label: 'Platform Earnings', value: fmt(stats.platformEarnings), color: 'bg-purple-50 text-purple-600', icon: <IndianRupee size={18} /> },
            { label: 'Driver Payouts', value: fmt(stats.driverPayouts), color: 'bg-cyan-50 text-cyan-600', icon: <IndianRupee size={18} /> },
            { label: 'Pending', value: fmt(stats.pendingAmount), color: 'bg-yellow-50 text-yellow-600', icon: <IndianRupee size={18} /> },
          ].map((s, i) => (
            <div key={i} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-8 h-8 rounded-full ${s.color} flex items-center justify-center`}>{s.icon}</div>
              </div>
              <p className="text-xl font-bold text-gray-900">{s.value}</p>
              <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, booking ID, payment ID..."
              className="w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
          </div>
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-gray-400" />
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500">
              <option value="all">All Status</option>
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
              <option value="refunded">Refunded</option>
            </select>
          </div>
          <span className="text-xs text-gray-400">{filtered.length} results</span>
        </div>

        {/* Invoices Table */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="py-12 flex justify-center"><div className="animate-spin w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full" /></div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-gray-500">No invoices found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50/50">
                  <tr>
                    <th className="px-5 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-5 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Customer</th>
                    <th className="px-5 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Driver</th>
                    <th className="px-5 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Amount</th>
                    <th className="px-5 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Platform Fee</th>
                    <th className="px-5 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Payout</th>
                    <th className="px-5 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">GST</th>
                    <th className="px-5 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Payment</th>
                    <th className="px-5 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-5 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Invoice</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map((inv) => (
                    <tr key={inv.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-5 py-4">
                        <p className="text-sm text-gray-900">{new Date(inv.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                        <p className="text-[10px] text-gray-400">{new Date(inv.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-sm font-medium text-gray-900">{inv.customer_name || '—'}</p>
                        <p className="text-[10px] text-gray-400">{inv.customer_phone || ''}</p>
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-sm font-medium text-gray-900">{inv.driver_name || '—'}</p>
                        <p className="text-[10px] text-gray-400">{inv.driver_phone || ''}</p>
                      </td>
                      <td className="px-5 py-4 text-sm font-bold text-gray-900">{fmt(inv.total_amount || 0)}</td>
                      <td className="px-5 py-4 text-sm text-purple-600 font-medium">{fmt(inv.platform_fee || 0)}</td>
                      <td className="px-5 py-4 text-sm text-cyan-600 font-medium">{fmt(inv.driver_payout || 0)}</td>
                      <td className="px-5 py-4 text-sm text-gray-500">{fmt(inv.gst_amount || 0)}</td>
                      <td className="px-5 py-4">
                        <span className="px-2 py-0.5 bg-gray-100 rounded text-[10px] font-bold text-gray-600 uppercase">{inv.payment_method}</span>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${getStatusColor(inv.payment_status)}`}>{inv.payment_status}</span>
                      </td>
                      <td className="px-5 py-4">
                        <button
                          onClick={() => setSelectedInvoice(inv)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 hover:bg-orange-100 text-orange-600 text-xs font-semibold rounded-lg transition-colors border border-orange-200"
                        >
                          <FileText size={12} />
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Invoice Modal */}
      {selectedInvoice && (
        <InvoiceModal invoice={selectedInvoice} onClose={() => setSelectedInvoice(null)} />
      )}
    </div>
  );
}
