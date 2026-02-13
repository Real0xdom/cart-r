'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Sidebar from '@/components/Sidebar';
import { IndianRupee, Save, RefreshCw, Clock } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface FareConfig {
  id: string; vehicle_type: string; base_fare: number; per_km_rate: number;
  per_minute_rate: number; minimum_fare: number; cancellation_fee: number; is_active: boolean;
}

interface WaitingConfig {
  id: string; vehicle_type: string; free_waiting_minutes: number;
  charge_per_hour: number; charge_per_minute: number; max_waiting_charge: number; is_active: boolean;
}

export default function PricingPage() {
  const [tab, setTab] = useState<'fares' | 'waiting'>('fares');
  const [fares, setFares] = useState<FareConfig[]>([]);
  const [waiting, setWaiting] = useState<WaitingConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    try {
      const [f, w] = await Promise.all([
        supabase.from('fare_config').select('*').order('vehicle_type'),
        supabase.from('waiting_charges_config').select('*').order('vehicle_type'),
      ]);
      if (f.error) throw f.error;
      if (w.error) throw w.error;
      setFares(f.data || []);
      setWaiting(w.data || []);
    } catch (e: any) { toast.error('Failed: ' + e.message); }
    finally { setLoading(false); }
  }

  const updFare = (id: string, field: keyof FareConfig, value: any) => setFares(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
  const updWait = (id: string, field: keyof WaitingConfig, value: any) => setWaiting(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));

  const saveFare = async (id: string) => {
    const c = fares.find(f => f.id === id);
    if (!c) return;
    setSaving(id);
    try {
      const { error } = await supabase.from('fare_config').update({
        base_fare: Number(c.base_fare), per_km_rate: Number(c.per_km_rate),
        per_minute_rate: Number(c.per_minute_rate), minimum_fare: Number(c.minimum_fare),
        cancellation_fee: Number(c.cancellation_fee), is_active: c.is_active,
        updated_at: new Date().toISOString(),
      }).eq('id', id);
      if (error) throw error;
      toast.success(`${c.vehicle_type} fare saved!`);
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(null); }
  };

  const saveWait = async (id: string) => {
    const c = waiting.find(w => w.id === id);
    if (!c) return;
    setSaving(id);
    try {
      const { error } = await supabase.from('waiting_charges_config').update({
        free_waiting_minutes: Number(c.free_waiting_minutes), charge_per_hour: Number(c.charge_per_hour),
        charge_per_minute: Number(c.charge_per_minute), max_waiting_charge: Number(c.max_waiting_charge),
        is_active: c.is_active, updated_at: new Date().toISOString(),
      }).eq('id', id);
      if (error) throw error;
      toast.success(`${c.vehicle_type} waiting charges saved!`);
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(null); }
  };

  const InputCell = ({ value, onChange }: { value: any; onChange: (v: string) => void }) => (
    <input type="number" value={value} onChange={(e) => onChange(e.target.value)}
      className="w-24 px-3 py-2 bg-gray-50 border border-transparent hover:border-gray-200 focus:border-orange-500 focus:bg-white rounded-lg transition-all font-medium text-gray-900 focus:outline-none text-sm" />
  );

  return (
    <div className="min-h-screen bg-[var(--color-brand-cream)] font-sans">
      <Sidebar />
      <div className="ml-72 p-8 max-w-[1600px]">
        <div className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-1">Pricing</h1>
            <p className="text-gray-500 text-sm">Manage fare rates and waiting charges per vehicle</p>
          </div>
          <button onClick={fetchAll} className="px-4 py-2.5 bg-white text-gray-600 rounded-xl font-semibold shadow-sm border border-gray-200 hover:bg-gray-50 transition-all flex items-center gap-2">
            <RefreshCw size={16} /> Refresh
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-white rounded-xl p-1 shadow-sm border border-gray-100 mb-8 w-fit">
          <button onClick={() => setTab('fares')} className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${tab === 'fares' ? 'bg-orange-500 text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'}`}>
            <IndianRupee size={16} /> Fare Rates ({fares.length})
          </button>
          <button onClick={() => setTab('waiting')} className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${tab === 'waiting' ? 'bg-orange-500 text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'}`}>
            <Clock size={16} /> Waiting Charges ({waiting.length})
          </button>
        </div>

        {/* Fare Rates Tab */}
        {tab === 'fares' && (
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600"><IndianRupee size={20} /></div>
              <div><h2 className="text-xl font-bold text-gray-900">Fare Configuration</h2><p className="text-sm text-gray-500">Set base fares and per-unit rates for each vehicle type</p></div>
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
                      <th className="text-left py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Cancel Fee (₹)</th>
                      <th className="text-left py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="text-right py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Save</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {fares.map((c) => (
                      <tr key={c.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="py-4 px-4"><div className="font-bold text-gray-900 capitalize flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-gray-300" />{c.vehicle_type}</div></td>
                        <td className="py-2 px-4"><InputCell value={c.base_fare} onChange={(v) => updFare(c.id, 'base_fare', v)} /></td>
                        <td className="py-2 px-4"><InputCell value={c.per_km_rate} onChange={(v) => updFare(c.id, 'per_km_rate', v)} /></td>
                        <td className="py-2 px-4"><InputCell value={c.per_minute_rate} onChange={(v) => updFare(c.id, 'per_minute_rate', v)} /></td>
                        <td className="py-2 px-4"><InputCell value={c.minimum_fare} onChange={(v) => updFare(c.id, 'minimum_fare', v)} /></td>
                        <td className="py-2 px-4"><InputCell value={c.cancellation_fee} onChange={(v) => updFare(c.id, 'cancellation_fee', v)} /></td>
                        <td className="py-4 px-4">
                          <button onClick={() => updFare(c.id, 'is_active', !c.is_active)}
                            className={`px-3 py-1 rounded-full text-xs font-bold ${c.is_active ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                            {c.is_active ? 'Active' : 'Inactive'}
                          </button>
                        </td>
                        <td className="py-4 px-4 text-right">
                          <button onClick={() => saveFare(c.id)} disabled={saving === c.id} className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg disabled:opacity-50">
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

        {/* Waiting Charges Tab */}
        {tab === 'waiting' && (
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center text-purple-600"><Clock size={20} /></div>
              <div><h2 className="text-xl font-bold text-gray-900">Waiting Charges</h2><p className="text-sm text-gray-500">Set free waiting time and per-minute charges for each vehicle</p></div>
            </div>
            {loading ? (
              <div className="py-12 flex justify-center"><div className="animate-spin w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full" /></div>
            ) : waiting.length === 0 ? (
              <div className="py-12 text-center text-gray-500">No waiting charges configured yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Vehicle Type</th>
                      <th className="text-left py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Free Minutes</th>
                      <th className="text-left py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">₹/Hour</th>
                      <th className="text-left py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">₹/Minute</th>
                      <th className="text-left py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Max Charge (₹)</th>
                      <th className="text-left py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="text-right py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Save</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {waiting.map((c) => (
                      <tr key={c.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="py-4 px-4"><div className="font-bold text-gray-900 capitalize flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-purple-300" />{c.vehicle_type}</div></td>
                        <td className="py-2   px-4"><InputCell value={c.free_waiting_minutes} onChange={(v) => updWait(c.id, 'free_waiting_minutes', v)} /></td>
                        <td className="py-2 px-4"><InputCell value={c.charge_per_hour} onChange={(v) => updWait(c.id, 'charge_per_hour', v)} /></td>
                        <td className="py-2 px-4"><InputCell value={c.charge_per_minute} onChange={(v) => updWait(c.id, 'charge_per_minute', v)} /></td>
                        <td className="py-2 px-4"><InputCell value={c.max_waiting_charge} onChange={(v) => updWait(c.id, 'max_waiting_charge', v)} /></td>
                        <td className="py-4 px-4">
                          <button onClick={() => updWait(c.id, 'is_active', !c.is_active)}
                            className={`px-3 py-1 rounded-full text-xs font-bold ${c.is_active ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                            {c.is_active ? 'Active' : 'Inactive'}
                          </button>
                        </td>
                        <td className="py-4 px-4 text-right">
                          <button onClick={() => saveWait(c.id)} disabled={saving === c.id} className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg disabled:opacity-50">
                            {saving === c.id ? <div className="w-5 h-5 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" /> : <Save size={20} />}
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
      </div>
    </div>
  );
}
