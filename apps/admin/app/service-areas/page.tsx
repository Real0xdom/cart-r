'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Sidebar from '@/components/Sidebar';
import { MapPin, Plus, Save, RefreshCw, X, Globe, AlertTriangle } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface ServiceArea {
  id: string; name: string; city: string; state: string; country: string;
  center_latitude: number; center_longitude: number; radius_km: number;
  is_active: boolean; priority: number; metadata: any;
  created_at: string; updated_at: string;
}

interface ExpansionInterest {
  id: string; user_id: string; latitude: number; longitude: number;
  address: string | null; requested_at: string;
  user?: { name: string; email: string } | null;
}

export default function ServiceAreasPage() {
  const [areas, setAreas] = useState<ServiceArea[]>([]);
  const [expansions, setExpansions] = useState<ExpansionInterest[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [tab, setTab] = useState<'areas' | 'requests'>('areas');
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', city: '', state: '', country: 'India', center_latitude: 0, center_longitude: 0, radius_km: 10, priority: 1 });

  useEffect(() => { fetchAreas(); fetchExpansions(); }, []);

  async function fetchAreas() {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('service_areas').select('*').order('priority', { ascending: false }).order('name');
      if (error) throw error;
      setAreas(data || []);
    } catch (e: any) { toast.error('Failed: ' + e.message); }
    finally { setLoading(false); }
  }

  async function fetchExpansions() {
    try {
      const { data, error } = await supabase.from('expansion_interests')
        .select('*, user:users!expansion_interests_user_id_fkey(name, email)')
        .order('requested_at', { ascending: false }).limit(100);
      if (error) throw error;
      setExpansions(data || []);
    } catch (e: any) { console.error(e.message); }
  }

  const upd = (id: string, field: keyof ServiceArea, value: any) => setAreas(prev => prev.map(a => a.id === id ? { ...a, [field]: value } : a));

  const handleSave = async (id: string) => {
    const area = areas.find(a => a.id === id);
    if (!area) return;
    setSaving(id);
    try {
      const { error } = await supabase.from('service_areas').update({
        name: area.name, city: area.city, state: area.state,
        center_latitude: Number(area.center_latitude), center_longitude: Number(area.center_longitude),
        radius_km: Number(area.radius_km), is_active: area.is_active, priority: Number(area.priority),
        updated_at: new Date().toISOString(),
      }).eq('id', id);
      if (error) throw error;
      toast.success(`${area.name} updated!`);
    } catch (e: any) { toast.error('Failed: ' + e.message); }
    finally { setSaving(null); }
  };

  const handleAdd = async () => {
    if (!form.name || !form.city || !form.state) { toast.error('Name, city, state required'); return; }
    setAdding(true);
    try {
      const { error } = await supabase.from('service_areas').insert({
        ...form, center_latitude: Number(form.center_latitude), center_longitude: Number(form.center_longitude),
        radius_km: Number(form.radius_km), priority: Number(form.priority),
        geometry: `POINT(${form.center_longitude} ${form.center_latitude})`,
      });
      if (error) throw error;
      toast.success('Area added!');
      setShowAdd(false);
      setForm({ name: '', city: '', state: '', country: 'India', center_latitude: 0, center_longitude: 0, radius_km: 10, priority: 1 });
      fetchAreas();
    } catch (e: any) { toast.error('Failed: ' + e.message); }
    finally { setAdding(false); }
  };

  const toggle = async (id: string, active: boolean) => {
    try {
      const { error } = await supabase.from('service_areas').update({ is_active: !active, updated_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
      toast.success(active ? 'Deactivated' : 'Activated');
      setAreas(prev => prev.map(a => a.id === id ? { ...a, is_active: !active } : a));
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="min-h-screen bg-[var(--color-brand-cream)] font-sans">
      <Sidebar />
      <div className="ml-72 p-8 max-w-[1600px]">
        <div className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-1">Service Areas</h1>
            <p className="text-gray-500 text-sm">Manage supported service regions and expansion requests</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => { fetchAreas(); fetchExpansions(); }} className="px-4 py-2.5 bg-white text-gray-600 rounded-xl font-semibold shadow-sm border border-gray-200 hover:bg-gray-50 transition-all flex items-center gap-2">
              <RefreshCw size={16} /> Refresh
            </button>
            <button onClick={() => setShowAdd(true)} className="px-5 py-2.5 bg-orange-500 text-white rounded-xl font-semibold shadow-md shadow-orange-500/20 hover:bg-orange-600 transition-all flex items-center gap-2">
              <Plus size={16} /> Add Area
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center"><Globe size={20} className="text-blue-600" /></div>
            <div><p className="text-2xl font-bold text-gray-900">{areas.length}</p><p className="text-xs text-gray-500">Total Areas</p></div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center"><MapPin size={20} className="text-green-600" /></div>
            <div><p className="text-2xl font-bold text-gray-900">{areas.filter(a => a.is_active).length}</p><p className="text-xs text-gray-500">Active</p></div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-yellow-50 flex items-center justify-center"><AlertTriangle size={20} className="text-yellow-600" /></div>
            <div><p className="text-2xl font-bold text-gray-900">{expansions.length}</p><p className="text-xs text-gray-500">Expansion Requests</p></div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-white rounded-xl p-1 shadow-sm border border-gray-100 mb-8 w-fit">
          <button onClick={() => setTab('areas')} className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all ${tab === 'areas' ? 'bg-orange-500 text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'}`}>
            Service Areas ({areas.length})
          </button>
          <button onClick={() => setTab('requests')} className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all ${tab === 'requests' ? 'bg-orange-500 text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'}`}>
            Expansion Requests ({expansions.length})
          </button>
        </div>

        {tab === 'areas' && (
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
            {loading ? (
              <div className="py-12 flex justify-center"><div className="animate-spin w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full" /></div>
            ) : areas.length === 0 ? (
              <div className="py-12 text-center text-gray-500">No service areas configured.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50/50">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Name</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Location</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Center</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Radius</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Priority</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {areas.map((a) => (
                      <tr key={a.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <input type="text" value={a.name} onChange={(e) => upd(a.id, 'name', e.target.value)}
                            className="font-bold text-gray-900 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-orange-500 focus:outline-none px-1 py-0.5" />
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">{a.city}, {a.state}</td>
                        <td className="px-6 py-4">
                          <span className="text-xs font-mono text-gray-500">{Number(a.center_latitude).toFixed(4)}, {Number(a.center_longitude).toFixed(4)}</span>
                        </td>
                        <td className="px-6 py-4">
                          <input type="number" value={a.radius_km} onChange={(e) => upd(a.id, 'radius_km', e.target.value)}
                            className="w-16 px-2 py-1 bg-gray-50 border border-transparent hover:border-gray-200 focus:border-orange-500 rounded-lg text-sm font-medium text-gray-900 focus:outline-none" />
                        </td>
                        <td className="px-6 py-4">
                          <input type="number" value={a.priority} onChange={(e) => upd(a.id, 'priority', e.target.value)}
                            className="w-14 px-2 py-1 bg-gray-50 border border-transparent hover:border-gray-200 focus:border-orange-500 rounded-lg text-sm font-medium text-gray-900 focus:outline-none" />
                        </td>
                        <td className="px-6 py-4">
                          <button onClick={() => toggle(a.id, a.is_active)}
                            className={`px-3 py-1 rounded-full text-xs font-bold ${a.is_active ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                            {a.is_active ? 'Active' : 'Inactive'}
                          </button>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button onClick={() => handleSave(a.id)} disabled={saving === a.id}
                            className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg disabled:opacity-50">
                            {saving === a.id ? <div className="w-4 h-4 border-2 border-orange-600 border-t-transparent rounded-full animate-spin" /> : <Save size={16} />}
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

        {tab === 'requests' && (
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
            {expansions.length === 0 ? (
              <div className="py-12 text-center text-gray-500">No expansion requests yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50/50">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase">User</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase">Address</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase">Coordinates</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {expansions.map((e) => (
                      <tr key={e.id} className="hover:bg-gray-50/50">
                        <td className="px-6 py-4">
                          <p className="text-sm font-medium text-gray-900">{e.user?.name || 'Unknown'}</p>
                          <p className="text-xs text-gray-400">{e.user?.email || ''}</p>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600 max-w-[300px] truncate">{e.address || 'No address'}</td>
                        <td className="px-6 py-4"><span className="px-2 py-1 bg-gray-100 rounded text-xs font-mono text-gray-600">{e.latitude.toFixed(4)}, {e.longitude.toFixed(4)}</span></td>
                        <td className="px-6 py-4 text-xs text-gray-500">{new Date(e.requested_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[100]">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-lg p-8 mx-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Add Service Area</h2>
              <button onClick={() => setShowAdd(false)} className="p-2 hover:bg-gray-100 rounded-xl"><X size={20} className="text-gray-500" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Area Name *</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Bhilai Main" className="input-field text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">City *</label>
                  <input type="text" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="input-field text-sm" /></div>
                <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">State *</label>
                  <input type="text" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} className="input-field text-sm" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Latitude</label>
                  <input type="number" step="0.0001" value={form.center_latitude || ''} onChange={(e) => setForm({ ...form, center_latitude: Number(e.target.value) })} className="input-field text-sm" /></div>
                <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Longitude</label>
                  <input type="number" step="0.0001" value={form.center_longitude || ''} onChange={(e) => setForm({ ...form, center_longitude: Number(e.target.value) })} className="input-field text-sm" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Radius (km)</label>
                  <input type="number" value={form.radius_km} onChange={(e) => setForm({ ...form, radius_km: Number(e.target.value) })} className="input-field text-sm" /></div>
                <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Priority</label>
                  <input type="number" value={form.priority} onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })} className="input-field text-sm" /></div>
              </div>
            </div>
            <div className="flex gap-3 mt-8">
              <button onClick={() => setShowAdd(false)} className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200">Cancel</button>
              <button onClick={handleAdd} disabled={adding} className="flex-1 btn-primary flex items-center justify-center gap-2">
                {adding ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Plus size={16} /> Add Area</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
