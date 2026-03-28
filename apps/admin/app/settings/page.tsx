'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Sidebar from '@/components/Sidebar';
import { Settings, Save, RefreshCw, DollarSign, Percent, Banknote, ShieldCheck } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface FareConfig {
  id: string;
  vehicle_type: string;
  base_fare: number;
  per_km_rate: number;
  per_minute_rate: number;
  minimum_fare: number;
  cancellation_fee: number;
  is_active: boolean;
}

interface PlatformSetting {
  id: string;
  key: string;
  value: any;
  description: string;
}

export default function SettingsPage() {
  const [configs, setConfigs] = useState<FareConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'fare' | 'commission' | 'payout' | 'kyc'>('fare');

  // Platform settings state
  const [commissionRate, setCommissionRate] = useState(15);
  const [vehicleCommission, setVehicleCommission] = useState<Record<string, number>>({});
  const [minWithdrawal, setMinWithdrawal] = useState(100);
  const [maxWithdrawal, setMaxWithdrawal] = useState(50000);
  const [autoApprove, setAutoApprove] = useState(false);
  const [batchProcessing, setBatchProcessing] = useState(false);
  const [kycRequired, setKycRequired] = useState(true);
  const [settingsLoading, setSettingsLoading] = useState(true);

  useEffect(() => {
    fetchConfigs();
    fetchPlatformSettings();
  }, []);

  async function fetchConfigs() {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('fare_config').select('*').order('vehicle_type');
      if (error) throw error;
      setConfigs(data || []);
    } catch (error: any) {
      toast.error('Failed to load settings: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  async function fetchPlatformSettings() {
    setSettingsLoading(true);
    try {
      const { data, error } = await supabase.from('platform_settings').select('*');
      if (error) throw error;
      (data || []).forEach((s: PlatformSetting) => {
        if (s.key === 'commission') {
          setCommissionRate(s.value?.default_rate ?? 15);
          setVehicleCommission(s.value?.by_vehicle_type ?? {});
        }
        if (s.key === 'payout') {
          setMinWithdrawal(s.value?.min_withdrawal ?? 100);
          setMaxWithdrawal(s.value?.max_withdrawal ?? 50000);
          setAutoApprove(s.value?.auto_approve ?? false);
          setBatchProcessing(s.value?.batch_processing ?? false);
        }
        if (s.key === 'kyc') {
          setKycRequired(s.value?.required_for_payout ?? true);
        }
      });
    } catch (error: any) {
      toast.error('Failed to load platform settings: ' + error.message);
    } finally {
      setSettingsLoading(false);
    }
  }

  const handleUpdate = (id: string, field: keyof FareConfig, value: any) => {
    setConfigs(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const handleSaveFare = async (id: string) => {
    const c = configs.find(c => c.id === id);
    if (!c) return;
    setSaving(id);
    try {
      const { error } = await supabase.from('fare_config').update({
        base_fare: Number(c.base_fare), per_km_rate: Number(c.per_km_rate), per_minute_rate: Number(c.per_minute_rate),
        minimum_fare: Number(c.minimum_fare), cancellation_fee: Number(c.cancellation_fee), is_active: c.is_active,
        updated_at: new Date().toISOString()
      }).eq('id', id);
      if (error) throw error;
      toast.success(`${c.vehicle_type} settings updated!`);
    } catch (error: any) {
      toast.error('Failed to save: ' + error.message);
    } finally {
      setSaving(null);
    }
  };

  const handleSaveCommission = async () => {
    setSaving('commission');
    try {
      const { error } = await supabase.from('platform_settings').update({
        value: { default_rate: Number(commissionRate), by_vehicle_type: vehicleCommission },
        updated_at: new Date().toISOString()
      }).eq('key', 'commission');
      if (error) throw error;
      toast.success('Commission settings saved!');
    } catch (error: any) {
      toast.error('Save failed: ' + error.message);
    } finally {
      setSaving(null);
    }
  };

  const handleSavePayout = async () => {
    setSaving('payout');
    try {
      const { error } = await supabase.from('platform_settings').update({
        value: { min_withdrawal: Number(minWithdrawal), max_withdrawal: Number(maxWithdrawal), auto_approve: autoApprove, batch_processing: batchProcessing },
        updated_at: new Date().toISOString()
      }).eq('key', 'payout');
      if (error) throw error;
      toast.success('Payout settings saved!');
    } catch (error: any) {
      toast.error('Save failed: ' + error.message);
    } finally {
      setSaving(null);
    }
  };

  const handleSaveKyc = async () => {
    setSaving('kyc');
    try {
      const { error } = await supabase.from('platform_settings').update({
        value: { required_for_payout: kycRequired, verified_status: 'verified' },
        updated_at: new Date().toISOString()
      }).eq('key', 'kyc');
      if (error) throw error;
      toast.success('KYC settings saved!');
    } catch (error: any) {
      toast.error('Save failed: ' + error.message);
    } finally {
      setSaving(null);
    }
  };

  const tabs = [
    { key: 'fare', label: 'Fare Config', icon: DollarSign },
    { key: 'commission', label: 'Commission', icon: Percent },
    { key: 'payout', label: 'Payouts', icon: Banknote },
    { key: 'kyc', label: 'KYC', icon: ShieldCheck },
  ] as const;

  return (
    <div className="min-h-screen bg-[var(--color-brand-cream)] font-sans">
      <Sidebar />
      <div className="ml-72 p-8 max-w-[1600px]">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-1">Platform Settings</h1>
            <p className="text-gray-500 text-sm">Manage fares, commission, payouts, and KYC</p>
          </div>
          <button onClick={() => { fetchConfigs(); fetchPlatformSettings(); }} className="px-4 py-2 bg-white text-gray-600 rounded-xl font-semibold shadow-sm border border-gray-200 hover:bg-gray-50 transition-all flex items-center gap-2">
            <RefreshCw size={16} /> Refresh
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${activeTab === t.key ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
              <t.icon size={16} /> {t.label}
            </button>
          ))}
        </div>

        {/* Fare Config Tab */}
        {activeTab === 'fare' && (
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600"><DollarSign size={20} /></div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Fare Configuration</h2>
                <p className="text-sm text-gray-500">Set base fares and rates for each vehicle type</p>
              </div>
            </div>
            {loading ? (
              <div className="py-12 flex justify-center"><div className="animate-spin w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full" /></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Vehicle Type</th>
                      <th className="text-left py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Base Fare (₹)</th>
                      <th className="text-left py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Per KM (₹)</th>
                      <th className="text-left py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Per Min (₹)</th>
                      <th className="text-left py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Min Fare (₹)</th>
                      <th className="text-left py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="text-right py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {configs.map(c => (
                      <tr key={c.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="py-4 px-4"><div className="font-bold text-gray-900 capitalize flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-gray-300" />{c.vehicle_type}</div></td>
                        {(['base_fare', 'per_km_rate', 'per_minute_rate', 'minimum_fare'] as const).map(field => (
                          <td key={field} className="py-2 px-4">
                            <input type="number" value={c[field]} onChange={e => handleUpdate(c.id, field, e.target.value)}
                              className="w-24 px-3 py-2 bg-gray-50 border border-transparent hover:border-gray-200 focus:border-orange-500 focus:bg-white rounded-lg transition-all font-medium text-gray-900 focus:outline-none" />
                          </td>
                        ))}
                        <td className="py-4 px-4">
                          <button onClick={() => handleUpdate(c.id, 'is_active', !c.is_active)}
                            className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${c.is_active ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                            {c.is_active ? 'Active' : 'Inactive'}
                          </button>
                        </td>
                        <td className="py-4 px-4 text-right">
                          <button onClick={() => handleSaveFare(c.id)} disabled={saving === c.id}
                            className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors disabled:opacity-50" title="Save">
                            {saving === c.id ? <div className="w-5 h-5 border-2 border-orange-600 border-t-transparent rounded-full animate-spin" /> : <Save size={20} />}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Commission Tab */}
        {activeTab === 'commission' && (
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center text-purple-600"><Percent size={20} /></div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Commission Settings</h2>
                <p className="text-sm text-gray-500">Platform commission deducted from each trip fare</p>
              </div>
            </div>
            {settingsLoading ? (
              <div className="py-12 flex justify-center"><div className="animate-spin w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full" /></div>
            ) : (
              <div className="space-y-6">
                <div className="bg-gray-50 rounded-2xl p-6">
                  <label className="block text-sm font-bold text-gray-700 mb-2">Default Commission Rate (%)</label>
                  <div className="flex items-center gap-4">
                    <input type="number" value={commissionRate} onChange={e => setCommissionRate(Number(e.target.value))} min={0} max={50} step={0.5}
                      className="w-32 px-4 py-3 bg-white border border-gray-200 rounded-xl text-xl font-bold text-gray-900 focus:outline-none focus:border-orange-500" />
                    <span className="text-gray-500 text-sm">of total fare goes to platform</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-2">Driver receives {(100 - commissionRate).toFixed(1)}% of total fare</p>
                </div>
                <div className="bg-blue-50 rounded-2xl p-6">
                  <label className="block text-sm font-bold text-blue-700 mb-2">💡 Example Calculation</label>
                  <p className="text-sm text-blue-600">Fare ₹1,000 → Platform gets ₹{(1000 * commissionRate / 100).toFixed(0)} | Driver gets ₹{(1000 * (100 - commissionRate) / 100).toFixed(0)}</p>
                </div>
                <button onClick={handleSaveCommission} disabled={saving === 'commission'}
                  className="px-6 py-3 bg-orange-600 text-white rounded-xl font-semibold hover:bg-orange-700 disabled:opacity-50 transition-colors flex items-center gap-2">
                  {saving === 'commission' ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save size={18} />}
                  Save Commission Settings
                </button>
              </div>
            )}
          </div>
        )}

        {/* Payout Tab */}
        {activeTab === 'payout' && (
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center text-green-600"><Banknote size={20} /></div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Payout Settings</h2>
                <p className="text-sm text-gray-500">Configure driver withdrawal rules</p>
              </div>
            </div>
            {settingsLoading ? (
              <div className="py-12 flex justify-center"><div className="animate-spin w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full" /></div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-gray-50 rounded-2xl p-6">
                    <label className="block text-sm font-bold text-gray-700 mb-2">Minimum Withdrawal (₹)</label>
                    <input type="number" value={minWithdrawal} onChange={e => setMinWithdrawal(Number(e.target.value))}
                      className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-lg font-bold text-gray-900 focus:outline-none focus:border-orange-500" />
                    <p className="text-xs text-gray-400 mt-2">Driver must have at least this much to withdraw</p>
                  </div>
                  <div className="bg-gray-50 rounded-2xl p-6">
                    <label className="block text-sm font-bold text-gray-700 mb-2">Maximum Withdrawal (₹)</label>
                    <input type="number" value={maxWithdrawal} onChange={e => setMaxWithdrawal(Number(e.target.value))}
                      className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-lg font-bold text-gray-900 focus:outline-none focus:border-orange-500" />
                    <p className="text-xs text-gray-400 mt-2">Maximum per withdrawal request</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-gray-50 rounded-2xl p-6 flex items-center justify-between">
                    <div>
                      <label className="block text-sm font-bold text-gray-700">Auto-Approve Withdrawals</label>
                      <p className="text-xs text-gray-400 mt-1">Skip manual approval step</p>
                    </div>
                    <button onClick={() => setAutoApprove(!autoApprove)}
                      className={`w-14 h-7 rounded-full transition-colors ${autoApprove ? 'bg-green-500' : 'bg-gray-300'} relative`}>
                      <span className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${autoApprove ? 'left-7' : 'left-0.5'}`} />
                    </button>
                  </div>
                  <div className="bg-gray-50 rounded-2xl p-6 flex items-center justify-between">
                    <div>
                      <label className="block text-sm font-bold text-gray-700">Batch Processing</label>
                      <p className="text-xs text-gray-400 mt-1">Process payouts in batches</p>
                    </div>
                    <button onClick={() => setBatchProcessing(!batchProcessing)}
                      className={`w-14 h-7 rounded-full transition-colors ${batchProcessing ? 'bg-green-500' : 'bg-gray-300'} relative`}>
                      <span className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${batchProcessing ? 'left-7' : 'left-0.5'}`} />
                    </button>
                  </div>
                </div>
                <button onClick={handleSavePayout} disabled={saving === 'payout'}
                  className="px-6 py-3 bg-orange-600 text-white rounded-xl font-semibold hover:bg-orange-700 disabled:opacity-50 transition-colors flex items-center gap-2">
                  {saving === 'payout' ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save size={18} />}
                  Save Payout Settings
                </button>
              </div>
            )}
          </div>
        )}

        {/* KYC Tab */}
        {activeTab === 'kyc' && (
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center text-amber-600"><ShieldCheck size={20} /></div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">KYC Requirements</h2>
                <p className="text-sm text-gray-500">Verification requirements for driver payouts</p>
              </div>
            </div>
            {settingsLoading ? (
              <div className="py-12 flex justify-center"><div className="animate-spin w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full" /></div>
            ) : (
              <div className="space-y-6">
                <div className="bg-gray-50 rounded-2xl p-6 flex items-center justify-between">
                  <div>
                    <label className="block text-sm font-bold text-gray-700">Require KYC for Withdrawals</label>
                    <p className="text-xs text-gray-400 mt-1">Driver must be verified (approved) before they can withdraw earnings</p>
                  </div>
                  <button onClick={() => setKycRequired(!kycRequired)}
                    className={`w-14 h-7 rounded-full transition-colors ${kycRequired ? 'bg-green-500' : 'bg-gray-300'} relative`}>
                    <span className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${kycRequired ? 'left-7' : 'left-0.5'}`} />
                  </button>
                </div>
                {kycRequired && (
                  <div className="bg-amber-50 rounded-2xl p-6 border border-amber-200">
                    <p className="text-sm text-amber-800 font-medium">⚠️ KYC is enabled</p>
                    <p className="text-xs text-amber-600 mt-1">Drivers must have their verification_status = &apos;verified&apos; (approved in admin) to submit withdrawal requests. Unverified drivers will see an error.</p>
                  </div>
                )}
                <button onClick={handleSaveKyc} disabled={saving === 'kyc'}
                  className="px-6 py-3 bg-orange-600 text-white rounded-xl font-semibold hover:bg-orange-700 disabled:opacity-50 transition-colors flex items-center gap-2">
                  {saving === 'kyc' ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save size={18} />}
                  Save KYC Settings
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

