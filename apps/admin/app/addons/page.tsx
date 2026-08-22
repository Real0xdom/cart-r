'use client';
import { useEffect, useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import Sidebar from '@/components/Sidebar';
import { Puzzle, Plus, Save, RefreshCw, X, Trash2, ChevronDown, Edit2 } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface AddonService {
  id: string; code: string; name: string; description: string | null;
  price: number; is_active: boolean; applicable_vehicle_types: string[];
  icon_emoji: string; display_order: number; metadata: any;
  created_at: string; updated_at: string;
}

interface VehicleOption {
  vehicle_type: string;
  display_name: string;
}

const emptyAddon = { code: '', name: '', description: '', price: 0, icon_emoji: '🔧', applicable_vehicle_types: [] as string[], display_order: 0 };

export default function AddonsPage() {
  const supabase = createClient();
  const [addons, setAddons] = useState<AddonService[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(emptyAddon);
  const [adding, setAdding] = useState(false);
  const [vehicleTypes, setVehicleTypes] = useState<VehicleOption[]>([]);
  const [vehicleTypesDropdownOpen, setVehicleTypesDropdownOpen] = useState(false);
  const vehicleDropdownRef = useRef<HTMLDivElement>(null);

  // Edit modal state
  const [editingAddon, setEditingAddon] = useState<AddonService | null>(null);
  const [editForm, setEditForm] = useState(emptyAddon);
  const [editVehicleDropdownOpen, setEditVehicleDropdownOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const editVehicleDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => { fetchAddons(); }, []);

  useEffect(() => {
    async function fetchVehicleTypes() {
      try {
        const { data, error } = await supabase
          .from('vehicle_specifications')
          .select('vehicle_type, display_name')
          .order('display_name');
        if (error) throw error;
        setVehicleTypes(data || []);
      } catch (e: any) {
        console.error('Failed to load vehicle types:', e);
        setVehicleTypes([]);
      }
    }
    if (showAdd || editingAddon) fetchVehicleTypes();
  }, [showAdd, editingAddon]);

  useEffect(() => {
    if (!vehicleTypesDropdownOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (vehicleDropdownRef.current && !vehicleDropdownRef.current.contains(e.target as Node)) {
        setVehicleTypesDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [vehicleTypesDropdownOpen]);

  useEffect(() => {
    if (!editVehicleDropdownOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (editVehicleDropdownRef.current && !editVehicleDropdownRef.current.contains(e.target as Node)) {
        setEditVehicleDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [editVehicleDropdownOpen]);

  async function fetchAddons() {
    setLoading(true);
    try {
      const res = await fetch('/api/addons');
      if (!res.ok) throw new Error((await res.json()).error || res.statusText);
      const data = await res.json();
      setAddons(Array.isArray(data) ? data : []);
    } catch (e: any) { toast.error('Failed: ' + (e.message || 'Could not load addons')); }
    finally { setLoading(false); }
  }

  const upd = (id: string, field: keyof AddonService, value: any) => setAddons(prev => prev.map(a => a.id === id ? { ...a, [field]: value } : a));

  const handleSave = async (id: string) => {
    const addon = addons.find(a => a.id === id);
    if (!addon) return;
    setSaving(id);
    try {
      const res = await fetch(`/api/addons/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: addon.name,
          description: addon.description,
          price: Number(addon.price),
          icon_emoji: addon.icon_emoji,
          display_order: Number(addon.display_order),
          is_active: addon.is_active,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || res.statusText);
      toast.success(`${addon.name} updated!`);
    } catch (e: any) { toast.error('Failed: ' + (e.message || 'Update failed')); }
    finally { setSaving(null); }
  };

  const handleAdd = async () => {
    if (!form.code || !form.name) { toast.error('Code and name required'); return; }
    setAdding(true);
    try {
      const res = await fetch('/api/addons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: form.code,
          name: form.name,
          description: form.description || null,
          price: Number(form.price),
          icon_emoji: form.icon_emoji,
          display_order: Number(form.display_order),
          applicable_vehicle_types: form.applicable_vehicle_types,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || res.statusText);
      toast.success('Addon added!');
      setShowAdd(false);
      setForm(emptyAddon);
      fetchAddons();
    } catch (e: any) { toast.error('Failed: ' + (e.message || 'Add failed')); }
    finally { setAdding(false); }
  };

  const openEdit = (addon: AddonService) => {
    setEditingAddon(addon);
    setEditForm({
      code: addon.code,
      name: addon.name,
      description: addon.description || '',
      price: addon.price,
      icon_emoji: addon.icon_emoji,
      applicable_vehicle_types: [...(addon.applicable_vehicle_types || [])],
      display_order: addon.display_order,
    });
    setEditVehicleDropdownOpen(false);
  };

  const handleEditSubmit = async () => {
    if (!editingAddon) return;
    if (!editForm.name) { toast.error('Name is required'); return; }
    setEditing(true);
    try {
      const res = await fetch(`/api/addons/${editingAddon.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editForm.name,
          description: editForm.description || null,
          price: Number(editForm.price),
          icon_emoji: editForm.icon_emoji,
          display_order: Number(editForm.display_order),
          applicable_vehicle_types: editForm.applicable_vehicle_types,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || res.statusText);
      const updated = await res.json();
      setAddons(prev => prev.map(a => a.id === editingAddon.id ? updated : a));
      toast.success(`${editForm.name} updated!`);
      setEditingAddon(null);
    } catch (e: any) { toast.error('Failed: ' + (e.message || 'Update failed')); }
    finally { setEditing(false); }
  };

  const toggleVehicleType = (vehicleType: string) => {
    setForm(prev => ({
      ...prev,
      applicable_vehicle_types: prev.applicable_vehicle_types.includes(vehicleType)
        ? prev.applicable_vehicle_types.filter(t => t !== vehicleType)
        : [...prev.applicable_vehicle_types, vehicleType],
    }));
  };

  const toggleEditVehicleType = (vehicleType: string) => {
    setEditForm(prev => ({
      ...prev,
      applicable_vehicle_types: prev.applicable_vehicle_types.includes(vehicleType)
        ? prev.applicable_vehicle_types.filter(t => t !== vehicleType)
        : [...prev.applicable_vehicle_types, vehicleType],
    }));
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"?`)) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/addons/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const errorBody = await res.json().catch(() => null);
        throw new Error(errorBody?.error || res.statusText || 'Delete failed');
      }
      toast.success(`${name} deleted`);
      setAddons(prev => prev.filter(a => a.id !== id));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
    }
    finally { setDeleting(null); }
  };

  const toggleActive = async (id: string, current: boolean) => {
    try {
      const res = await fetch(`/api/addons/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !current }),
      });
      if (!res.ok) throw new Error((await res.json()).error || res.statusText);
      setAddons(prev => prev.map(a => a.id === id ? { ...a, is_active: !current } : a));
      toast.success(current ? 'Deactivated' : 'Activated');
    } catch (e: any) { toast.error(e.message || 'Update failed'); }
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
                            <p className="font-bold text-gray-900">{a.name}</p>
                            <p className="text-xs text-gray-500">{a.description || <span className="italic text-gray-300">No description</span>}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4"><span className="px-2.5 py-1 bg-gray-100 text-gray-700 rounded-lg text-xs font-mono font-medium">{a.code}</span></td>
                      <td className="px-6 py-4">
                        <span className="font-semibold text-gray-900">₹{Number(a.price).toLocaleString()}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-600">{a.display_order}</span>
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
                          <button onClick={() => openEdit(a)} title="Edit addon"
                            className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors">
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(a.id, a.name)}
                            disabled={deleting === a.id}
                            className="p-2 text-red-400 hover:bg-red-50 hover:text-red-600 rounded-lg disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Trash2 size={16} />
                          </button>
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
              <div className="relative" ref={vehicleDropdownRef}>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Vehicle Types</label>
                <button
                  type="button"
                  onClick={() => setVehicleTypesDropdownOpen(prev => !prev)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-left flex items-center justify-between hover:border-orange-300 focus:border-orange-500 focus:outline-none transition-colors"
                >
                  <span className="text-sm text-gray-700">
                    {form.applicable_vehicle_types.length === 0
                      ? 'Select vehicles (leave empty for all)'
                      : `${form.applicable_vehicle_types.length} selected`}
                  </span>
                  <ChevronDown size={18} className={`text-gray-500 transition-transform ${vehicleTypesDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
                {vehicleTypesDropdownOpen && (
                  <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-56 overflow-y-auto py-2">
                    {vehicleTypes.length === 0 ? (
                      <p className="px-4 py-2 text-sm text-gray-500">No vehicle types found. Add them in Vehicle Types first.</p>
                    ) : (
                      vehicleTypes.map((v) => (
                        <label
                          key={v.vehicle_type}
                          className="flex items-center gap-3 px-4 py-2 hover:bg-orange-50 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={form.applicable_vehicle_types.includes(v.vehicle_type)}
                            onChange={() => toggleVehicleType(v.vehicle_type)}
                            className="rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                          />
                          <span className="text-sm font-medium text-gray-800 capitalize">{v.display_name || v.vehicle_type}</span>
                          <span className="text-xs text-gray-400 font-mono">{v.vehicle_type}</span>
                        </label>
                      ))
                    )}
                  </div>
                )}
                {form.applicable_vehicle_types.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {form.applicable_vehicle_types.map((t) => {
                      const label = vehicleTypes.find(v => v.vehicle_type === t)?.display_name || t;
                      return (
                        <span
                          key={t}
                          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-orange-100 text-orange-800 text-xs font-medium"
                        >
                          {label}
                          <button
                            type="button"
                            onClick={() => toggleVehicleType(t)}
                            className="hover:bg-orange-200 rounded-full p-0.5"
                            aria-label={`Remove ${label}`}
                          >
                            <X size={12} />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}
                <p className="text-xs text-gray-400 mt-1.5">Select which vehicle types can offer this addon. Leave empty for all.</p>
              </div>
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

      {/* Edit Modal */}
      {editingAddon && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[100]">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-lg p-8 mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Edit Addon Service</h2>
                <p className="text-xs text-gray-400 mt-0.5 font-mono">{editingAddon.code}</p>
              </div>
              <button onClick={() => setEditingAddon(null)} className="p-2 hover:bg-gray-100 rounded-xl"><X size={20} className="text-gray-500" /></button>
            </div>
            <div className="space-y-4">
              <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Name *</label>
                <input type="text" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="input-field text-sm" /></div>
              <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Description</label>
                <input type="text" value={editForm.description || ''} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} className="input-field text-sm" /></div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Icon</label>
                  <input type="text" value={editForm.icon_emoji} onChange={(e) => setEditForm({ ...editForm, icon_emoji: e.target.value })} className="input-field text-sm text-center text-2xl" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Price (₹)</label>
                  <input type="number" value={editForm.price} onChange={(e) => setEditForm({ ...editForm, price: Number(e.target.value) })} className="input-field text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Order</label>
                  <input type="number" value={editForm.display_order} onChange={(e) => setEditForm({ ...editForm, display_order: Number(e.target.value) })} className="input-field text-sm" />
                </div>
              </div>
              <div className="relative" ref={editVehicleDropdownRef}>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Vehicle Types</label>
                <button
                  type="button"
                  onClick={() => setEditVehicleDropdownOpen(prev => !prev)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-left flex items-center justify-between hover:border-orange-300 focus:border-orange-500 focus:outline-none transition-colors"
                >
                  <span className="text-sm text-gray-700">
                    {editForm.applicable_vehicle_types.length === 0
                      ? 'All vehicles (leave empty for all)'
                      : `${editForm.applicable_vehicle_types.length} selected`}
                  </span>
                  <ChevronDown size={18} className={`text-gray-500 transition-transform ${editVehicleDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
                {editVehicleDropdownOpen && (
                  <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-56 overflow-y-auto py-2">
                    {vehicleTypes.length === 0 ? (
                      <p className="px-4 py-2 text-sm text-gray-500">No vehicle types found. Add them in Vehicle Types first.</p>
                    ) : (
                      vehicleTypes.map((v) => (
                        <label
                          key={v.vehicle_type}
                          className="flex items-center gap-3 px-4 py-2 hover:bg-orange-50 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={editForm.applicable_vehicle_types.includes(v.vehicle_type)}
                            onChange={() => toggleEditVehicleType(v.vehicle_type)}
                            className="rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                          />
                          <span className="text-sm font-medium text-gray-800 capitalize">{v.display_name || v.vehicle_type}</span>
                          <span className="text-xs text-gray-400 font-mono">{v.vehicle_type}</span>
                        </label>
                      ))
                    )}
                  </div>
                )}
                {editForm.applicable_vehicle_types.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {editForm.applicable_vehicle_types.map((t) => {
                      const label = vehicleTypes.find(v => v.vehicle_type === t)?.display_name || t;
                      return (
                        <span
                          key={t}
                          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-orange-100 text-orange-800 text-xs font-medium"
                        >
                          {label}
                          <button
                            type="button"
                            onClick={() => toggleEditVehicleType(t)}
                            className="hover:bg-orange-200 rounded-full p-0.5"
                            aria-label={`Remove ${label}`}
                          >
                            <X size={12} />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}
                <p className="text-xs text-gray-400 mt-1.5">Leave empty to show this addon for all vehicle types.</p>
              </div>
            </div>
            <div className="flex gap-3 mt-8">
              <button onClick={() => setEditingAddon(null)} className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200">Cancel</button>
              <button onClick={handleEditSubmit} disabled={editing} className="flex-1 btn-primary flex items-center justify-center gap-2">
                {editing ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Save size={16} /> Save Changes</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
