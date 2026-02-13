'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Sidebar from '@/components/Sidebar';
import { Puzzle, Plus, Save, RefreshCw, X, Trash2 } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface AddonService {
  id: string; code: string; name: string; description: string | null;
  price: number; is_active: boolean; applicable_vehicle_types: string[];
  icon_emoji: string; display_order: number; metadata: any;
  created_at: string; updated_at: string;
}

const emptyAddon = { code: '', name: '', description: '', price: 0, icon_emoji: '🔧', applicable_vehicle_types: [] as string[], display_order: 0 };

export default function AddonsPage() {
  const [addons, setAddons] = useState<AddonService[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(emptyAddon);
  const [adding, setAdding] = useState(false);
  const [vehicleTypesInput, setVehicleTypesInput] = useState('');

  useEffect(() => { fetchAddons(); }, []);

  async function fetchAddons() {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('addon_services').select('*').order('display_order').order('name');
      if (error) throw error;
      setAddons(data || []);
    } catch (e: any) { toast.error('Failed: ' + e.message); }
    finally { setLoading(false); }
  }

  const upd = (id: string, field: keyof AddonService, value: any) => setAddons(prev => prev.map(a => a.id === id ? { ...a, [field]: value } : a));

  const handleSave = async (id: string) => {
    const addon = addons.find(a => a.id === id);
    if (!addon) return;
    setSaving(id);
    try {
      const { error } = await supabase.from('addon_services').update({
        name: addon.name, description: addon.description, price: Number(addon.price),
        icon_emoji: addon.icon_emoji, display_order: Number(addon.display_order),
        is_active: addon.is_active, updated_at: new Date().toISOString(),
      }).eq('id', id);
      if (error) throw error;
      toast.success(`${addon.name} updated!`);
    } catch (e: any) { toast.error('Failed: ' + e.message); }
    finally { setSaving(null); }
  };

  const handleAdd = async () => {
    if (!form.code || !form.name) { toast.error('Code and name required'); return; }
    setAdding(true);
    try {
      const types = vehicleTypesInput.split(',').map(s => s.trim()).filter(Boolean);
      const { error } = await supabase.from('addon_services').insert({ ...form, price: Number(form.price), display_order: Number(form.display_order), applicable_vehicle_types: types });
      if (error) throw error;
      toast.success('Addon added!');
      setShowAdd(false); setForm(emptyAddon); setVehicleTypesInput(''); fetchAddons();
    } catch (e: any) { toast.error('Failed: ' + e.message); }
    finally { setAdding(false); }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"?`)) return;
    try {
      const { error } = await supabase.from('addon_services').delete().eq('id', id);
      if (error) throw error;
      toast.success(`${name} deleted`);
      setAddons(prev => prev.filter(a => a.id !== id));
    } catch (e: any) { toast.error(e.message); }
  };

  const toggleActive = async (id: string, current: boolean) => {
    try {
      const { error } = await supabase.from('addon_services').update({ is_active: !current, updated_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
      setAddons(prev => prev.map(a => a.id === id ? { ...a, is_active: !current } : a));
      toast.success(current ? 'Deactivated' : 'Activated');
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="min-h-screen bg-[var(--color-brand-cream)] font-sans">
      <Sidebar />
      <div className="ml-72 p-8 max-w-[1600px]">
        <div className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-1">Addon Services</h1>
            <p className="text-gray-500 text-sm">Manage additional services offered to customers</p>
          </div>
          <div className="flex gap-3">
            <button onClick={fetchAddons} className="px-4 py-2.5 bg-white text-gray-600 rounded-xl font-semibold shadow-sm border border-gray-200 hover:bg-gray-50 transition-all flex items-center gap-2">
              <RefreshCw size={16} /> Refresh
            </button>
            <button onClick={() => setShowAdd(true)} className="px-5 py-2.5 bg-orange-500 text-white rounded-xl font-semibold shadow-md shadow-orange-500/20 hover:bg-orange-600 transition-all flex items-center gap-2">
              <Plus size={16} /> Add Addon
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center"><Puzzle size={20} className="text-purple-600" /></div>
            <div><p className="text-2xl font-bold text-gray-900">{addons.length}</p><p className="text-xs text-gray-500">Total Addons</p></div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center text-lg">✅</div>
            <div><p className="text-2xl font-bold text-gray-900">{addons.filter(a => a.is_active).length}</p><p className="text-xs text-gray-500">Active</p></div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center text-lg">💰</div>
            <div><p className="text-2xl font-bold text-gray-900">₹{addons.length > 0 ? Math.round(addons.reduce((a, s) => a + Number(s.price), 0) / addons.length) : 0}</p><p className="text-xs text-gray-500">Avg Price</p></div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="py-12 flex justify-center"><div className="animate-spin w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full" /></div>
          ) : addons.length === 0 ? (
            <div className="py-12 text-center text-gray-500">No addon services yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50/50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Addon</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Code</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Price (₹)</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Order</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Vehicle Types</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {addons.map((a) => (
                    <tr key={a.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{a.icon_emoji}</span>
                          <div>
                            <input type="text" value={a.name} onChange={(e) => upd(a.id, 'name', e.target.value)}
                              className="font-bold text-gray-900 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-orange-500 focus:outline-none px-1 py-0.5" />
                            <input type="text" value={a.description || ''} onChange={(e) => upd(a.id, 'description', e.target.value)}
                              placeholder="Description..." className="block text-xs text-gray-500 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-orange-500 focus:outline-none px-1 py-0.5 w-48" />
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4"><span className="px-2.5 py-1 bg-gray-100 text-gray-700 rounded-lg text-xs font-mono font-medium">{a.code}</span></td>
                      <td className="px-6 py-4">
                        <input type="number" value={a.price} onChange={(e) => upd(a.id, 'price', e.target.value)}
                          className="w-20 px-3 py-1.5 bg-gray-50 border border-transparent hover:border-gray-200 focus:border-orange-500 rounded-lg text-sm font-medium text-gray-900 focus:outline-none" />
                      </td>
                      <td className="px-6 py-4">
                        <input type="number" value={a.display_order} onChange={(e) => upd(a.id, 'display_order', e.target.value)}
                          className="w-14 px-2 py-1 bg-gray-50 border border-transparent hover:border-gray-200 focus:border-orange-500 rounded-lg text-sm font-medium text-gray-900 focus:outline-none" />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1 max-w-[180px]">
                          {(a.applicable_vehicle_types || []).map((t, i) => (
                            <span key={i} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-[10px] font-medium">{t}</span>
                          ))}
                          {(!a.applicable_vehicle_types || a.applicable_vehicle_types.length === 0) && <span className="text-xs text-gray-400">All</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <button onClick={() => toggleActive(a.id, a.is_active)}
                          className={`px-3 py-1 rounded-full text-xs font-bold ${a.is_active ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                          {a.is_active ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => handleSave(a.id)} disabled={saving === a.id}
                            className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg disabled:opacity-50">
                            {saving === a.id ? <div className="w-4 h-4 border-2 border-orange-600 border-t-transparent rounded-full animate-spin" /> : <Save size={16} />}
                          </button>
                          <button onClick={() => handleDelete(a.id, a.name)} className="p-2 text-red-400 hover:bg-red-50 hover:text-red-600 rounded-lg"><Trash2 size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Add Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[100]">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-lg p-8 mx-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Add Addon Service</h2>
              <button onClick={() => setShowAdd(false)} className="p-2 hover:bg-gray-100 rounded-xl"><X size={20} className="text-gray-500" /></button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Code *</label>
                  <input type="text" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="e.g. HELPER" className="input-field text-sm" /></div>
                <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Name *</label>
                  <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Loading Helper" className="input-field text-sm" /></div>
              </div>
              <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Description</label>
                <input type="text" value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input-field text-sm" /></div>
              <div className="grid grid-cols-3 gap-4">
                <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Icon</label>
                  <input type="text" value={form.icon_emoji} onChange={(e) => setForm({ ...form, icon_emoji: e.target.value })} className="input-field text-sm text-center text-2xl" /></div>
                <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Price (₹)</label>
                  <input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} className="input-field text-sm" /></div>
                <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Order</label>
                  <input type="number" value={form.display_order} onChange={(e) => setForm({ ...form, display_order: Number(e.target.value) })} className="input-field text-sm" /></div>
              </div>
              <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Vehicle Types (comma-separated, leave empty for all)</label>
                <input type="text" value={vehicleTypesInput} onChange={(e) => setVehicleTypesInput(e.target.value)} placeholder="e.g. mini_truck, pickup_truck" className="input-field text-sm" /></div>
            </div>
            <div className="flex gap-3 mt-8">
              <button onClick={() => setShowAdd(false)} className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200">Cancel</button>
              <button onClick={handleAdd} disabled={adding} className="flex-1 btn-primary flex items-center justify-center gap-2">
                {adding ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Plus size={16} /> Add Addon</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
