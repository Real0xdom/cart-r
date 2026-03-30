'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Sidebar from '@/components/Sidebar';
import { IndianRupee, FileText, TrendingUp, RefreshCw, Search, Filter, X, MapPin, Circle, Truck, Package, Clock, Wallet, AlertTriangle, Users, Info } from 'lucide-react';
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
  platformEarnings: number; driverEarnings: number;
}

interface DebtDriver {
  driverId: string;
  name: string;
  phone: string;
  email: string;
  availableBalance: number;
  totalCommissionOwed: number;
  updatedAt: string | null;
}

interface WalletDebtSummary {
  driversWithDebt: number;
  negativeWalletDrivers: number;
  totalOutstandingCommissionDebt: number;
  recoveredCommissionFromTopups: number;
  debtRecoveryTopupCount: number;
  drivers: DebtDriver[];
}

interface MetricCard {
  label: string;
  value: string | number;
  color: string;
  icon: JSX.Element;
  tooltip: string;
  subtext: string;
  borderColor?: string;
  iconBg?: string;
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
function InfoTooltip({ text }: { text: string }) {
  return (
    <div className="group relative">
      <button
        type="button"
        className="flex h-5 w-5 items-center justify-center rounded-full text-gray-400 transition-colors hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500"
        aria-label={text}
      >
        <Info size={14} />
      </button>
      <div className="pointer-events-none absolute right-0 top-7 z-20 w-72 rounded-xl border border-gray-200 bg-white p-3 text-left text-xs leading-5 text-gray-600 opacity-0 shadow-xl transition-all duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
        {text}
      </div>
    </div>
  );
}

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
  const [stats, setStats] = useState<Stats>({ totalRevenue: 0, totalInvoices: 0, avgAmount: 0, platformEarnings: 0, driverEarnings: 0 });
  const [walletDebt, setWalletDebt] = useState<WalletDebtSummary>({
    driversWithDebt: 0,
    negativeWalletDrivers: 0,
    totalOutstandingCommissionDebt: 0,
    recoveredCommissionFromTopups: 0,
    debtRecoveryTopupCount: 0,
    drivers: [],
  });
  const [search, setSearch] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  useEffect(() => { fetchInvoices(); }, []);

  async function fetchInvoices() {
    setLoading(true);
    try {
      const [{ data: invoiceData, error: invoiceError }, walletDebtResponse] = await Promise.all([
        supabase.from('invoices')
          .select('*')
          .eq('payment_status', 'paid')
          .order('created_at', { ascending: false })
          .limit(500),
        fetch('/api/finance/wallet-debt', { cache: 'no-store' }),
      ]);

      if (invoiceError) throw invoiceError;
      if (!walletDebtResponse.ok) {
        const debtError = await walletDebtResponse.json().catch(() => ({}));
        throw new Error(debtError.error || 'Failed to load wallet debt summary');
      }

      const inv = invoiceData || [];
      const debtSummary = await walletDebtResponse.json();
      setInvoices(inv);
      setWalletDebt(debtSummary);

      setStats({
        totalRevenue: inv.reduce((s: number, i: Invoice) => s + Number(i.total_amount || 0), 0),
        totalInvoices: inv.length,
        avgAmount: inv.length > 0 ? Math.round(inv.reduce((s: number, i: Invoice) => s + Number(i.total_amount || 0), 0) / inv.length) : 0,
        platformEarnings: inv.reduce((s: number, i: Invoice) => s + Number(i.platform_fee || 0), 0),
        driverEarnings: inv.reduce((s: number, i: Invoice) => {
          const earnings = i.driver_payout ?? (Number(i.total_amount || 0) - Number(i.platform_fee || 0));
          return s + Number(earnings || 0);
        }, 0),
      });
    } catch (e: any) { toast.error('Failed: ' + e.message); }
    finally { setLoading(false); }
  }

  const filtered = invoices.filter((i: Invoice) => {
    const q = search.toLowerCase();
    const matchSearch = !q || i.customer_name?.toLowerCase().includes(q) || i.driver_name?.toLowerCase().includes(q)
      || i.invoice_number?.toLowerCase().includes(q);
    return matchSearch;
  });
  const filteredDebtDrivers = walletDebt.drivers.filter((driver) => {
    const q = search.toLowerCase();
    return !q
      || driver.name.toLowerCase().includes(q)
      || driver.phone.toLowerCase().includes(q)
      || driver.email.toLowerCase().includes(q);
  });

  const fmt = (n: number) => '₹' + Number(n).toLocaleString('en-IN');

  const financeCards: MetricCard[] = [
    {
      label: 'Total Revenue',
      value: fmt(stats.totalRevenue),
      color: 'bg-green-50 text-green-600',
      icon: <IndianRupee size={18} />,
      tooltip: 'Total money collected from all paid invoices. Calculated as the sum of total_amount for every invoice where payment_status is paid.',
      subtext: 'Money collected from paid invoices',
    },
    {
      label: 'Paid Invoices',
      value: stats.totalInvoices,
      color: 'bg-blue-50 text-blue-600',
      icon: <FileText size={18} />,
      tooltip: 'Count of invoices that have been successfully paid. Calculated as the number of invoice rows where payment_status is paid.',
      subtext: 'Count of invoices marked paid',
    },
    {
      label: 'Avg Amount',
      value: fmt(stats.avgAmount),
      color: 'bg-orange-50 text-orange-600',
      icon: <TrendingUp size={18} />,
      tooltip: 'Average invoice value for paid invoices. Calculated as total revenue divided by the number of paid invoices.',
      subtext: 'Average value per paid invoice',
    },
    {
      label: 'Platform Earnings',
      value: fmt(stats.platformEarnings),
      color: 'bg-purple-50 text-purple-600',
      icon: <IndianRupee size={18} />,
      tooltip: 'Platform commission earned from paid trips. Calculated as the sum of platform_fee across all paid invoices.',
      subtext: 'Commission retained by the platform',
    },
    {
      label: 'Driver Earnings',
      value: fmt(stats.driverEarnings),
      color: 'bg-cyan-50 text-cyan-600',
      icon: <IndianRupee size={18} />,
      tooltip: 'Net amount earned by drivers after platform fee deduction. Calculated as the sum of driver_payout across all paid invoices, or total_amount minus platform_fee when driver_payout is missing.',
      subtext: 'Net trip earnings after platform fee',
    },
  ];
  const debtCards: MetricCard[] = [
    {
      label: 'Outstanding Debt',
      value: fmt(walletDebt.totalOutstandingCommissionDebt),
      color: 'bg-red-50 text-red-600',
      borderColor: 'border-red-100',
      iconBg: 'bg-red-100',
      icon: <AlertTriangle size={18} className="text-red-600" />,
      tooltip: 'Total unpaid platform commission still owed by drivers. Calculated from the wallet debt summary API as the sum of all current commission dues.',
      subtext: 'Commission still owed to the platform',
    },
    {
      label: 'Drivers With Debt',
      value: walletDebt.driversWithDebt,
      color: 'bg-orange-50 text-orange-600',
      borderColor: 'border-orange-100',
      iconBg: 'bg-orange-100',
      icon: <Users size={18} className="text-orange-600" />,
      tooltip: 'Number of drivers who currently owe unpaid commission to the platform. Calculated as the count of drivers with a positive commission due balance.',
      subtext: 'Drivers still owing unpaid commission',
    },
    {
      label: 'Negative Wallets',
      value: walletDebt.negativeWalletDrivers,
      color: 'bg-amber-50 text-amber-700',
      borderColor: 'border-amber-100',
      iconBg: 'bg-amber-100',
      icon: <Wallet size={18} className="text-amber-700" />,
      tooltip: 'Number of drivers whose available wallet balance is below zero after commission deductions and settlements.',
      subtext: 'Wallets below zero after commission deduction',
    },
  ];

  return (
    <div className="min-h-screen bg-[var(--color-brand-cream)] font-sans">
      <Sidebar />
      <div className="ml-72 p-8 max-w-[1600px]">
        <div className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-1">Finance</h1>
            <p className="text-gray-500 text-sm">Track paid invoices, driver earnings, and completed transaction revenue</p>
          </div>
          <button onClick={fetchInvoices} className="px-4 py-2.5 bg-white text-gray-600 rounded-xl font-semibold shadow-sm border border-gray-200 hover:bg-gray-50 transition-all flex items-center gap-2">
            <RefreshCw size={16} /> Refresh
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          {financeCards.map((s, i) => (
            <div key={i} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <div className="mb-2 flex items-start justify-between gap-3">
                <div className={`w-8 h-8 rounded-full ${s.color} flex items-center justify-center`}>{s.icon}</div>
                <InfoTooltip text={s.tooltip} />
              </div>
              <p className="text-xl font-bold text-gray-900">{s.value}</p>
              <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">{s.label}</p>
              <p className="mt-1 text-xs text-gray-400">{s.subtext}</p>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 mb-8">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between mb-6">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Commission Debt Recovery</h2>
              <p className="text-sm text-gray-500">Drivers with negative commission balances and recovery from wallet recharges.</p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700">
              Recharge money first reduces unpaid platform commission
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
            {debtCards.map((card) => (
              <div key={card.label} className={`${card.color.split(' ')[0]} rounded-2xl border ${card.borderColor} p-5`}>
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl ${card.iconBg} flex items-center justify-center`}>
                      {card.icon}
                    </div>
                    <span className="text-sm font-medium text-gray-600">{card.label}</span>
                  </div>
                  <InfoTooltip text={card.tooltip} />
                </div>
                <p className="text-2xl font-bold text-gray-900">{card.value}</p>
                <p className="text-xs text-gray-500 mt-1">{card.subtext}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-gray-100 overflow-hidden">
            {filteredDebtDrivers.length === 0 ? (
              <div className="py-10 text-center text-gray-500">No drivers currently have unpaid commission debt.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50/70">
                    <tr>
                      <th className="px-5 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Driver</th>
                      <th className="px-5 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Current Wallet</th>
                      <th className="px-5 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Commission Due</th>
                      <th className="px-5 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Last Updated</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredDebtDrivers.map((driver) => (
                      <tr key={driver.driverId} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-5 py-4">
                          <p className="text-sm font-medium text-gray-900">{driver.name}</p>
                          <p className="text-[10px] text-gray-400">{driver.phone || driver.email || driver.driverId}</p>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`text-sm font-bold ${driver.availableBalance < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                            {fmt(driver.availableBalance)}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-sm font-bold text-orange-600">{fmt(driver.totalCommissionOwed)}</td>
                        <td className="px-5 py-4 text-sm text-gray-500">{formatDate(driver.updatedAt || undefined)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, booking ID, payment ID..."
              className="w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">
            <Filter size={16} />
            Paid only
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
                    <th className="px-5 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">GST</th>
                    <th className="px-5 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Payment</th>
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
                      <td className="px-5 py-4 text-sm text-gray-500">{fmt(inv.gst_amount || 0)}</td>
                      <td className="px-5 py-4">
                        <span className="px-2 py-0.5 bg-gray-100 rounded text-[10px] font-bold text-gray-600 uppercase">{inv.payment_method}</span>
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
