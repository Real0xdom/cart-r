'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Sidebar from '@/components/Sidebar';
import { Settings, Save, RefreshCw, DollarSign, Percent, Wallet, ShieldCheck } from 'lucide-react';
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
  const [tab, setTab] = useState<'fares' | 'commission'>('fares');

  // Fare config state
  const [configs, setConfigs] = useState<FareConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  // Platform settings state
  const [commissionRate, setCommissionRate] = useState(15);
  const [minWithdrawal, setMinWithdrawal] = useState(100);
  const [maxWithdrawal, setMaxWithdrawal] = useState(50000);
  const [autoApprove, setAutoApprove] = useState(false);
  const [kycRequired, setKycRequired] = useState(true);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsSaving, setSettingsSaving] = useState(false);

  useEffect(() => {
    fetchConfigs();
    fetchPlatformSettings();
  }, []);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // FARE CONFIGS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  async function fetchConfigs() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('fare_config')
        .select('*')
        .order('vehicle_type');
      if (error) throw error;
      setConfigs(data || []);
    } catch (error: any) {
      toast.error('Failed to load fare settings: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  const handleUpdate = (id: string, field: keyof FareConfig, value: any) => {
    setConfigs(prev => prev.map(config =>
      config.id === id ? { ...config, [field]: value } : config
    ));
  };

  const handleSave = async (id: string) => {
    const configToSave = configs.find(c => c.id === id);
    if (!configToSave) return;

    setSaving(id);
    try {
      const { error } = await supabase
        .from('fare_config')
        .update({
          base_fare: Number(configToSave.base_fare),
          per_km_rate: Number(configToSave.per_km_rate),
          per_minute_rate: Number(configToSave.per_minute_rate),
          minimum_fare: Number(configToSave.minimum_fare),
          cancellation_fee: Number(configToSave.cancellation_fee),
          is_active: configToSave.is_active,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;
      toast.success(`${configToSave.vehicle_type} settings updated!`);
    } catch (error: any) {
      toast.error('Failed to save: ' + error.message);
    } finally {
      setSaving(null);
    }
  };

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // PLATFORM SETTINGS (Commission, Payouts, KYC)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  async function fetchPlatformSettings() {
    setSettingsLoading(true);
    try {
      const { data, error } = await supabase
        .from('platform_settings')
        .select('*')
        .in('key', ['commission', 'payout', 'kyc']);

      if (error) throw error;

      (data || []).forEach((setting: PlatformSetting) => {
        if (setting.key === 'commission') {
          setCommissionRate(setting.value?.default_rate ?? 15);
        } else if (setting.key === 'payout') {
          setMinWithdrawal(setting.value?.min_withdrawal ?? 100);
          setMaxWithdrawal(setting.value?.max_withdrawal ?? 50000);
          setAutoApprove(setting.value?.auto_approve ?? false);
        } else if (setting.key === 'kyc') {
          setKycRequired(setting.value?.required_for_payout ?? true);
        }
      });
    } catch (error: any) {
      // Table might not exist yet if migration hasn't been run
      console.warn('Platform settings not available:', error.message);
    } finally {
      setSettingsLoading(false);
    }
  }

  async function savePlatformSettings() {
    setSettingsSaving(true);
    try {
      // Update commission
      await supabase
        .from('platform_settings')
        .update({ value: { default_rate: commissionRate, by_vehicle_type: {} } })
        .eq('key', 'commission');

      // Update payout
      await supabase
        .from('platform_settings')
        .update({ value: { min_withdrawal: minWithdrawal, max_withdrawal: maxWithdrawal, auto_approve: autoApprove, batch_processing: false } })
        .eq('key', 'payout');

      // Update KYC
      await supabase
        .from('platform_settings')
        .update({ value: { required_for_payout: kycRequired, verified_status: 'verified' } })
        .eq('key', 'kyc');

      toast.success('Platform settings saved!');
    } catch (error: any) {
      toast.error('Failed to save: ' + error.message);
    } finally {
      setSettingsSaving(false);
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // RENDER
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  return (
    <div className="min-h-screen bg-[var(--color-brand-cream)] font-sans">
      <Sidebar />
      <div className="ml-72 p-8 max-w-[1600px]">
        <div className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-1">Platform Settings</h1>
            <p className="text-gray-500 text-sm">Manage fares, commission, and payout configuration</p>
          </div>
          <button
            onClick={() => { fetchConfigs(); fetchPlatformSettings(); }}
            className="px-4 py-2 bg-white text-gray-600 rounded-xl font-semibold shadow-sm border border-gray-200 hover:bg-gray-50 transition-all flex items-center gap-2"
          >
            <RefreshCw size={16} /> Refresh
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-8 w-fit">
          <button
            onClick={() => setTab('fares')}
            className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
              tab === 'fares' ? 'bg-white shadow-sm text-orange-600' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <DollarSign size={16} /> Fare Configuration
          </button>
          <button
            onClick={() => setTab('commission')}
            className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
              tab === 'commission' ? 'bg-white shadow-sm text-orange-600' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Percent size={16} /> Commission & Payouts
          </button>
        </div>

        {/* ======================== TAB 1: FARES ======================== */}
        {tab === 'fares' && (
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                <DollarSign size={20} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Fare Configuration</h2>
                <p className="text-sm text-gray-500">Set base fares and rates for each vehicle type</p>
              </div>
            </div>

            {loading ? (
              <div className="py-12 flex justify-center">
                <div className="animate-spin w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full" />
              </div>
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
                      <th className="text-left py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Cancel Fee (₹)</th>
                      <th className="text-left py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="text-right py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {configs.map((config) => (
                      <tr key={config.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="py-4 px-4">
                          <div className="font-bold text-gray-900 capitalize flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-gray-300"></span>
                            {config.vehicle_type}
                          </div>
                        </td>
                        {['base_fare', 'per_km_rate', 'per_minute_rate', 'minimum_fare', 'cancellation_fee'].map((field) => (
                          <td key={field} className="py-2 px-4">
                            <input
                              type="number"
                              value={(config as any)[field]}
                              onChange={(e) => handleUpdate(config.id, field as keyof FareConfig, e.target.value)}
                              className="w-24 px-3 py-2 bg-gray-50 border border-transparent hover:border-gray-200 focus:border-orange-500 focus:bg-white rounded-lg transition-all font-medium text-gray-900 focus:outline-none"
                            />
                          </td>
                        ))}
                        <td className="py-4 px-4">
                          <button
                            onClick={() => handleUpdate(config.id, 'is_active', !config.is_active)}
                            className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${
                              config.is_active
                                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                            }`}
                          >
                            {config.is_active ? 'Active' : 'Inactive'}
                          </button>
                        </td>
                        <td className="py-4 px-4 text-right">
                          <button
                            onClick={() => handleSave(config.id)}
                            disabled={saving === config.id}
                            className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors disabled:opacity-50"
                            title="Save changes"
                          >
                            {saving === config.id ? (
                              <div className="w-5 h-5 border-2 border-orange-600 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <Save size={20} />
                            )}
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

        {/* ======================== TAB 2: COMMISSION & PAYOUTS ======================== */}
        {tab === 'commission' && (
          <div className="space-y-6">
            {settingsLoading ? (
              <div className="py-12 flex justify-center">
                <div className="animate-spin w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full" />
              </div>
            ) : (
              <>
                {/* Commission Card */}
                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center text-orange-600">
                      <Percent size={20} />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">Commission Settings</h2>
                      <p className="text-sm text-gray-500">Platform commission deducted from each booking</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                        Default Commission Rate (%)
                      </label>
                      <div className="flex items-center gap-4">
                        <input
                          type="number"
                          value={commissionRate}
                          onChange={(e) => setCommissionRate(Number(e.target.value))}
                          min={0}
                          max={100}
                          step={0.5}
                          className="w-32 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-lg font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white"
                        />
                        <span className="text-gray-400 text-sm">% of total fare</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-2">
                        If fare is ₹1,000 and commission is {commissionRate}%, platform keeps ₹{(1000 * commissionRate / 100).toFixed(0)} and driver earns ₹{(1000 - 1000 * commissionRate / 100).toFixed(0)}
                      </p>
                    </div>

                    <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl p-6 border border-orange-100">
                      <p className="text-xs font-bold text-orange-700 uppercase tracking-wider mb-2">How it works</p>
                      <ul className="text-sm text-gray-600 space-y-1">
                        <li>• Customer pays ₹1,000 for a booking</li>
                        <li>• Platform takes {commissionRate}% = ₹{(1000 * commissionRate / 100).toFixed(0)}</li>
                        <li>• Driver earns ₹{(1000 - 1000 * commissionRate / 100).toFixed(0)}</li>
                        <li>• Calculated automatically on booking completion</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Payout Card */}
                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center text-green-600">
                      <Wallet size={20} />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">Payout Settings</h2>
                      <p className="text-sm text-gray-500">Configure driver withdrawal limits and approval</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                        Min Withdrawal (₹)
                      </label>
                      <input
                        type="number"
                        value={minWithdrawal}
                        onChange={(e) => setMinWithdrawal(Number(e.target.value))}
                        min={1}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white"
                      />
                      <p className="text-xs text-gray-400 mt-1">Driver cannot withdraw less than this</p>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                        Max Withdrawal (₹)
                      </label>
                      <input
                        type="number"
                        value={maxWithdrawal}
                        onChange={(e) => setMaxWithdrawal(Number(e.target.value))}
                        min={100}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white"
                      />
                      <p className="text-xs text-gray-400 mt-1">Per-withdrawal limit</p>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                        Auto-approve Withdrawals
                      </label>
                      <button
                        onClick={() => setAutoApprove(!autoApprove)}
                        className={`w-full px-4 py-3 rounded-xl font-bold text-sm transition-colors ${
                          autoApprove
                            ? 'bg-green-100 text-green-700 border border-green-200'
                            : 'bg-gray-100 text-gray-500 border border-gray-200'
                        }`}
                      >
                        {autoApprove ? '✅ Enabled' : '❌ Disabled (Manual approval)'}
                      </button>
                      <p className="text-xs text-gray-400 mt-1">
                        {autoApprove ? 'Withdrawals auto-approved immediately' : 'Admin must approve each withdrawal'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* KYC Card */}
                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center text-purple-600">
                      <ShieldCheck size={20} />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">KYC Requirements</h2>
                      <p className="text-sm text-gray-500">Verification requirements for driver payouts</p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                      Require KYC for Withdrawal
                    </label>
                    <button
                      onClick={() => setKycRequired(!kycRequired)}
                      className={`px-4 py-3 rounded-xl font-bold text-sm transition-colors ${
                        kycRequired
                          ? 'bg-purple-100 text-purple-700 border border-purple-200'
                          : 'bg-gray-100 text-gray-500 border border-gray-200'
                      }`}
                    >
                      {kycRequired ? '✅ Required — Driver must be verified' : '❌ Not Required'}
                    </button>
                    <p className="text-xs text-gray-400 mt-1">
                      When enabled, only drivers with &quot;verified&quot; status can request withdrawals
                    </p>
                  </div>
                </div>

                {/* Save Button */}
                <div className="flex justify-end">
                  <button
                    onClick={savePlatformSettings}
                    disabled={settingsSaving}
                    className="px-8 py-3 bg-orange-500 text-white rounded-xl font-bold shadow-sm hover:bg-orange-600 transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {settingsSaving ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Save size={18} />
                    )}
                    Save All Settings
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
