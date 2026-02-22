'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { supabase } from '@/lib/supabase';
import Sidebar from '@/components/Sidebar';
import { MapPin, Plus, Save, RefreshCw, X, Globe, AlertTriangle, Edit2, Trash2, CheckCircle, XCircle, Search } from 'lucide-react';
import { toast } from 'react-hot-toast';

// Dynamically import map to avoid SSR issues
const MapPicker = dynamic(() => import('@/components/MapPicker'), { ssr: false, loading: () => (
  <div className="w-full h-full bg-gray-100 rounded-2xl animate-pulse flex items-center justify-center text-gray-400 text-sm">
    Loading map...
  </div>
) });

const AreaPreviewMap = dynamic(() => import('@/components/AreaPreviewMap'), { ssr: false, loading: () => (
  <div className="w-full h-full bg-gray-100 rounded-xl animate-pulse" />
) });

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

const defaultForm = {
  name: '', city: '', state: '', country: 'India',
  center_latitude: 0, center_longitude: 0, radius_km: 10, priority: 1
};

export default function ServiceAreasPage() {
  const [areas, setAreas] = useState<ServiceArea[]>([]);
  const [expansions, setExpansions] = useState<ExpansionInterest[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editArea, setEditArea] = useState<ServiceArea | null>(null);
  const [tab, setTab] = useState<'areas' | 'requests'>('areas');
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);

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

  // Geocode a search query to get lat/lng
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&limit=1`);
      const data = await res.json();
      if (data && data.length > 0) {
        const { lat, lon, display_name } = data[0];
        const parts = display_name.split(',');
        setForm(f => ({
          ...f,
          center_latitude: parseFloat(lat),
          center_longitude: parseFloat(lon),
          city: f.city || parts[0]?.trim() || '',
          state: f.state || parts[parts.length - 2]?.trim() || '',
        }));
        toast.success('Location found! Adjust the radius on the map.');
      } else {
        toast.error('Location not found. Try a different search.');
      }
    } catch (e) {
      toast.error('Search failed. Please try again.');
    } finally {
      setSearching(false);
    }
  };

  const handleMapClick = (lat: number, lng: number) => {
    setForm(f => ({ ...f, center_latitude: lat, center_longitude: lng }));
  };

  const handleEditMapClick = (lat: number, lng: number) => {
    if (editArea) setEditArea(e => e ? { ...e, center_latitude: lat, center_longitude: lng } : null);
  };

  const handleSave = async (area: ServiceArea) => {
    setSaving(area.id);
    try {
      // Build geometry as a circle (buffer) from center + radius
      const geometryWkt = `POINT(${area.center_longitude} ${area.center_latitude})`;
      const { error } = await supabase.from('service_areas').update({
        name: area.name, city: area.city, state: area.state, country: area.country,
        center_latitude: Number(area.center_latitude),
        center_longitude: Number(area.center_longitude),
        radius_km: Number(area.radius_km),
        is_active: area.is_active,
        priority: Number(area.priority),
        updated_at: new Date().toISOString(),
      }).eq('id', area.id);
      if (error) throw error;

      // Geometry is auto-updated by the DB trigger on center/radius change
      // (trigger: trg_update_service_area_geometry)

      toast.success(`${area.name} updated!`);
      setEditArea(null);
      fetchAreas();
    } catch (e: any) { toast.error('Failed: ' + e.message); }
    finally { setSaving(null); }
  };

  const handleAdd = async () => {
    if (!form.name || !form.city || !form.state) { toast.error('Name, city, state required'); return; }
    if (!form.center_latitude || !form.center_longitude) { toast.error('Please click on the map to set the center location'); return; }
    setAdding(true);
    try {
      const { error } = await supabase.from('service_areas').insert({
        ...form,
        center_latitude: Number(form.center_latitude),
        center_longitude: Number(form.center_longitude),
        radius_km: Number(form.radius_km),
        priority: Number(form.priority),
        // Geometry will be auto-set by the trigger, but provide a fallback point
        geometry: `SRID=4326;POINT(${form.center_longitude} ${form.center_latitude})`,
      });
      if (error) throw error;
      toast.success('Service area added!');
      setShowAdd(false);
      setForm(defaultForm);
      setSearchQuery('');
      fetchAreas();
    } catch (e: any) { toast.error('Failed: ' + e.message); }
    finally { setAdding(false); }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      const { error } = await supabase.from('service_areas').delete().eq('id', id);
      if (error) throw error;
      toast.success(`${name} deleted`);
      setAreas(prev => prev.filter(a => a.id !== id));
    } catch (e: any) { toast.error(e.message); }
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
        {/* Header */}
        <div className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-1">Service Areas</h1>
            <p className="text-gray-500 text-sm">Draw service regions on the map — customers are served based on GPS radius, not city names</p>
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

        {/* Areas Grid */}
        {tab === 'areas' && (
          <div>
            {loading ? (
              <div className="py-12 flex justify-center"><div className="animate-spin w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full" /></div>
            ) : areas.length === 0 ? (
              <div className="py-12 text-center text-gray-500 bg-white rounded-3xl border border-gray-100">
                <MapPin size={40} className="mx-auto mb-3 text-gray-300" />
                <p className="font-medium">No service areas configured.</p>
                <p className="text-sm mt-1">Click "Add Area" to draw your first service region on the map.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {areas.map((a) => (
                  <div key={a.id} className={`bg-white rounded-3xl shadow-sm border overflow-hidden transition-all ${a.is_active ? 'border-gray-100' : 'border-gray-200 opacity-70'}`}>
                    {/* Map preview */}
                    <div className="h-48 relative">
                      <AreaPreviewMap
                        centerLat={Number(a.center_latitude)}
                        centerLng={Number(a.center_longitude)}
                        radiusKm={Number(a.radius_km)}
                      />
                      {/* Status badge */}
                      <div className="absolute top-3 right-3 z-10">
                        <button onClick={() => toggle(a.id, a.is_active)}
                          className={`px-3 py-1 rounded-full text-xs font-bold shadow-sm flex items-center gap-1 ${a.is_active ? 'bg-green-500 text-white hover:bg-green-600' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}>
                          {a.is_active ? <><CheckCircle size={12} /> Active</> : <><XCircle size={12} /> Inactive</>}
                        </button>
                      </div>
                    </div>

                    {/* Info */}
                    <div className="p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-bold text-gray-900 text-lg">{a.name}</h3>
                          <p className="text-sm text-gray-500">{a.city}, {a.state}, {a.country}</p>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => setEditArea({ ...a })}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                            <Edit2 size={16} />
                          </button>
                          <button onClick={() => handleDelete(a.id, a.name)}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>

                      <div className="flex gap-4 text-sm">
                        <div className="flex items-center gap-1.5 bg-orange-50 text-orange-700 px-3 py-1.5 rounded-lg">
                          <MapPin size={14} />
                          <span className="font-semibold">{Number(a.radius_km)} km radius</span>
                        </div>
                        <div className="flex items-center gap-1.5 bg-gray-50 text-gray-600 px-3 py-1.5 rounded-lg font-mono text-xs">
                          {Number(a.center_latitude).toFixed(4)}, {Number(a.center_longitude).toFixed(4)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Expansion Requests */}
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

      {/* ===== ADD MODAL ===== */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Add Service Area</h2>
                <p className="text-sm text-gray-500 mt-0.5">Search for a location or click on the map to set the center, then adjust the radius</p>
              </div>
              <button onClick={() => { setShowAdd(false); setForm(defaultForm); setSearchQuery(''); }} className="p-2 hover:bg-gray-100 rounded-xl">
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Search bar */}
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSearch()}
                    placeholder="Search city or area (e.g. Bhilai, Chhattisgarh)..."
                    className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                  />
                </div>
                <button onClick={handleSearch} disabled={searching}
                  className="px-4 py-2.5 bg-orange-500 text-white rounded-xl font-semibold text-sm hover:bg-orange-600 disabled:opacity-50 flex items-center gap-2">
                  {searching ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Search size={16} />}
                  Search
                </button>
              </div>

              {/* Map */}
              <div className="h-72 rounded-2xl overflow-hidden border border-gray-200 relative">
                <MapPicker
                  centerLat={form.center_latitude}
                  centerLng={form.center_longitude}
                  radiusKm={form.radius_km}
                  onCenterChange={handleMapClick}
                />
                <div className="absolute bottom-3 left-3 z-10 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-1.5 text-xs text-gray-600 shadow-sm border border-gray-100">
                  {form.center_latitude && form.center_longitude
                    ? `📍 ${Number(form.center_latitude).toFixed(4)}, ${Number(form.center_longitude).toFixed(4)}`
                    : '👆 Click on the map to set center'}
                </div>
              </div>

              {/* Radius slider */}
              <div>
                <label className="flex justify-between text-xs font-bold text-gray-500 uppercase mb-2">
                  <span>Service Radius</span>
                  <span className="text-orange-500 font-bold text-sm normal-case">{form.radius_km} km</span>
                </label>
                <input
                  type="range" min={1} max={100} step={1}
                  value={form.radius_km}
                  onChange={e => setForm(f => ({ ...f, radius_km: Number(e.target.value) }))}
                  className="w-full h-2 bg-gray-200 rounded-full appearance-none cursor-pointer accent-orange-500"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>1 km</span><span>50 km</span><span>100 km</span>
                </div>
              </div>

              {/* Form fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Area Name *</label>
                  <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Bhilai Main Area"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">City *</label>
                  <input type="text" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">State *</label>
                  <input type="text" value={form.state} onChange={e => setForm({ ...form, state: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Country</label>
                  <input type="text" value={form.country} onChange={e => setForm({ ...form, country: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Priority (higher = checked first)</label>
                  <input type="number" min={1} value={form.priority} onChange={e => setForm({ ...form, priority: Number(e.target.value) })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100" />
                </div>
              </div>
            </div>

            <div className="flex gap-3 p-6 border-t border-gray-100">
              <button onClick={() => { setShowAdd(false); setForm(defaultForm); setSearchQuery(''); }}
                className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200">Cancel</button>
              <button onClick={handleAdd} disabled={adding}
                className="flex-1 px-4 py-3 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600 disabled:opacity-50 flex items-center justify-center gap-2">
                {adding ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Plus size={16} /> Add Service Area</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== EDIT MODAL ===== */}
      {editArea && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Edit: {editArea.name}</h2>
                <p className="text-sm text-gray-500 mt-0.5">Click on the map to reposition the center, drag the slider to change radius</p>
              </div>
              <button onClick={() => setEditArea(null)} className="p-2 hover:bg-gray-100 rounded-xl">
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Map */}
              <div className="h-72 rounded-2xl overflow-hidden border border-gray-200 relative">
                <MapPicker
                  centerLat={Number(editArea.center_latitude)}
                  centerLng={Number(editArea.center_longitude)}
                  radiusKm={Number(editArea.radius_km)}
                  onCenterChange={handleEditMapClick}
                />
                <div className="absolute bottom-3 left-3 z-10 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-1.5 text-xs text-gray-600 shadow-sm border border-gray-100">
                  📍 {Number(editArea.center_latitude).toFixed(4)}, {Number(editArea.center_longitude).toFixed(4)}
                </div>
              </div>

              {/* Radius slider */}
              <div>
                <label className="flex justify-between text-xs font-bold text-gray-500 uppercase mb-2">
                  <span>Service Radius</span>
                  <span className="text-orange-500 font-bold text-sm normal-case">{editArea.radius_km} km</span>
                </label>
                <input
                  type="range" min={1} max={100} step={1}
                  value={editArea.radius_km}
                  onChange={e => setEditArea(ea => ea ? { ...ea, radius_km: Number(e.target.value) } : null)}
                  className="w-full h-2 bg-gray-200 rounded-full appearance-none cursor-pointer accent-orange-500"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>1 km</span><span>50 km</span><span>100 km</span>
                </div>
              </div>

              {/* Form fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Area Name *</label>
                  <input type="text" value={editArea.name} onChange={e => setEditArea(ea => ea ? { ...ea, name: e.target.value } : null)}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">City</label>
                  <input type="text" value={editArea.city} onChange={e => setEditArea(ea => ea ? { ...ea, city: e.target.value } : null)}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">State</label>
                  <input type="text" value={editArea.state} onChange={e => setEditArea(ea => ea ? { ...ea, state: e.target.value } : null)}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Priority</label>
                  <input type="number" min={1} value={editArea.priority} onChange={e => setEditArea(ea => ea ? { ...ea, priority: Number(e.target.value) } : null)}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100" />
                </div>
              </div>
            </div>

            <div className="flex gap-3 p-6 border-t border-gray-100">
              <button onClick={() => setEditArea(null)}
                className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200">Cancel</button>
              <button onClick={() => handleSave(editArea)} disabled={saving === editArea.id}
                className="flex-1 px-4 py-3 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600 disabled:opacity-50 flex items-center justify-center gap-2">
                {saving === editArea.id ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Save size={16} /> Save Changes</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
