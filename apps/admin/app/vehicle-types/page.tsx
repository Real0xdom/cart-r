'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Sidebar from '@/components/Sidebar';
import { Car, Plus, Save, RefreshCw, X, Trash2, IndianRupee, Clock, Edit } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface VehicleSpec {
  id: string;
  vehicle_type: string;
  display_name: string;
  description: string | null;
  icon_emoji: string;
  icon_url: string | null;
  max_weight_kg: number | null;
  max_volume_cubic_meters: number | null;
  passenger_capacity: number;
  suitable_for: string[];
  created_at: string;
  updated_at: string;
}

interface FareConfig {
  id: string;
  vehicle_type: string;
  base_fare: number;
  per_km_rate: number;
  per_minute_rate: number;
  minimum_fare: number;
  driver_search_radius_km?: number;
  is_active: boolean;
}

interface WaitingConfig {
  id: string;
  vehicle_type: string;
  free_waiting_minutes: number;
  charge_per_hour: number;
  charge_per_minute: number;
  max_waiting_charge: number;
  is_active: boolean;
}

const emptyVehicle: Omit<VehicleSpec, 'id' | 'created_at' | 'updated_at'> = {
  vehicle_type: '',
  display_name: '',
  description: '',
  icon_emoji: '🚗',
  icon_url: '',
  max_weight_kg: null,
  max_volume_cubic_meters: null,
  passenger_capacity: 0,
  suitable_for: [],
};

const defaultNewFare = {
  base_fare: 50,
  per_km_rate: 5,
  per_minute_rate: 1.5,
  minimum_fare: 60,
  driver_search_radius_km: 10,
  is_active: true,
};

const defaultNewWaiting = {
  free_waiting_minutes: 15,
  charge_per_hour: 100,
  max_waiting_charge: 400,
  is_active: true,
};

type FareModalTab = 'fare' | 'waiting';

export default function VehicleTypesPage() {
  const [vehicles, setVehicles] = useState<VehicleSpec[]>([]);
  const [fareConfigs, setFareConfigs] = useState<Map<string, FareConfig>>(new Map());
  const [waitingConfigs, setWaitingConfigs] = useState<Map<string, WaitingConfig>>(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  // Add vehicle modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newVehicle, setNewVehicle] = useState(emptyVehicle);
  const [newFare, setNewFare] = useState(defaultNewFare);
  const [newWaiting, setNewWaiting] = useState(defaultNewWaiting);
  const [addingNew, setAddingNew] = useState(false);
  const [suitableForInput, setSuitableForInput] = useState('');
  const [addModalTab, setAddModalTab] = useState<FareModalTab>('fare');

  // Edit fare config modal
  const [editingFareId, setEditingFareId] = useState<string | null>(null);
  const [editingFare, setEditingFare] = useState<FareConfig | null>(null);
  const [editingWaiting, setEditingWaiting] = useState<WaitingConfig | null>(null);
  const [fareModalTab, setFareModalTab] = useState<FareModalTab>('fare');

  useEffect(() => {
    fetchVehicles();
    fetchConfigs();
  }, []);

  async function fetchConfigs() {
    try {
      const [f, w] = await Promise.all([
        supabase.from('fare_config').select('*'),
        supabase.from('waiting_charges_config').select('*'),
      ]);
      if (f.error) throw f.error;
      if (w.error) throw w.error;

      const fareMap = new Map<string, FareConfig>();
      (f.data || []).forEach(fc => fareMap.set(fc.vehicle_type, fc));
      setFareConfigs(fareMap);

      const waitMap = new Map<string, WaitingConfig>();
      (w.data || []).forEach(wc => waitMap.set(wc.vehicle_type, wc));
      setWaitingConfigs(waitMap);
    } catch (error: any) {
      console.error('Failed to load configs:', error);
    }
  }

  async function fetchVehicles() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('vehicle_specifications')
        .select('*')
        .order('display_name');

      if (error) throw error;
      setVehicles(data || []);
    } catch (error: any) {
      toast.error('Failed to load vehicle types: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  const handleUpdate = (id: string, field: keyof VehicleSpec, value: any) => {
    setVehicles(prev => prev.map(v => v.id === id ? { ...v, [field]: value } : v));
  };

  const handleSave = async (id: string) => {
    const vehicle = vehicles.find(v => v.id === id);
    if (!vehicle) return;

    setSaving(id);
    try {
      const { error } = await supabase
        .from('vehicle_specifications')
        .update({
          display_name: vehicle.display_name,
          description: vehicle.description,
          icon_emoji: vehicle.icon_emoji,
          icon_url: vehicle.icon_url,
          max_weight_kg: vehicle.max_weight_kg ? Number(vehicle.max_weight_kg) : null,
          max_volume_cubic_meters: vehicle.max_volume_cubic_meters ? Number(vehicle.max_volume_cubic_meters) : null,
          passenger_capacity: Number(vehicle.passenger_capacity),
          suitable_for: vehicle.suitable_for,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
      toast.success(`${vehicle.display_name} updated!`);
    } catch (error: any) {
      toast.error('Failed to save: ' + error.message);
    } finally {
      setSaving(null);
    }
  };

  const handleAdd = async () => {
    if (!newVehicle.vehicle_type || !newVehicle.display_name) {
      toast.error('Vehicle type and display name are required');
      return;
    }

    setAddingNew(true);
    try {
      const suitable = suitableForInput
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);

      // 1. Insert vehicle spec (DB trigger auto-creates fare_config with defaults)
      const { error: vErr } = await supabase
        .from('vehicle_specifications')
        .insert({ ...newVehicle, suitable_for: suitable });
      if (vErr) throw vErr;

      // 2. Upsert fare_config with admin-entered values (overrides trigger defaults)
      const { error: fErr } = await supabase
        .from('fare_config')
        .upsert({
          vehicle_type: newVehicle.vehicle_type,
          base_fare: Number(newFare.base_fare),
          per_km_rate: Number(newFare.per_km_rate),
          per_minute_rate: Number(newFare.per_minute_rate),
          minimum_fare: Number(newFare.minimum_fare),
          driver_search_radius_km: Number(newFare.driver_search_radius_km),
          is_active: newFare.is_active,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'vehicle_type' });
      if (fErr) throw fErr;

      // 3. Insert waiting_charges_config (no DB trigger for this one)
      const { error: wErr } = await supabase
        .from('waiting_charges_config')
        .upsert({
          vehicle_type: newVehicle.vehicle_type,
          free_waiting_minutes: Number(newWaiting.free_waiting_minutes),
          charge_per_hour: Number(newWaiting.charge_per_hour),
          max_waiting_charge: Number(newWaiting.max_waiting_charge),
          is_active: newWaiting.is_active,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'vehicle_type' });
      if (wErr) throw wErr;

      toast.success('Vehicle type added with fare & waiting config!');
      setShowAddModal(false);
      setNewVehicle(emptyVehicle);
      setNewFare(defaultNewFare);
      setNewWaiting(defaultNewWaiting);
      setSuitableForInput('');
      setAddModalTab('fare');
      fetchVehicles();
      fetchConfigs();
    } catch (error: any) {
      toast.error('Failed to add: ' + error.message);
    } finally {
      setAddingNew(false);
    }
  };

  const openFareModal = (vehicleType: string) => {
    const fare = fareConfigs.get(vehicleType) || null;
    const waiting = waitingConfigs.get(vehicleType) || null;
    setEditingFare(fare);
    setEditingWaiting(waiting);
    setEditingFareId(vehicleType);
    setFareModalTab('fare');
  };

  const handleSaveFareConfig = async (vehicleType: string) => {
    if (!editingFare) return;

    setSaving(vehicleType);
    try {
      // Save fare config
      const { error: fErr } = await supabase
        .from('fare_config')
        .upsert({
          id: editingFare.id,
          vehicle_type: editingFare.vehicle_type,
          base_fare: Number(editingFare.base_fare),
          per_km_rate: Number(editingFare.per_km_rate),
          per_minute_rate: Number(editingFare.per_minute_rate),
          minimum_fare: Number(editingFare.minimum_fare),
          driver_search_radius_km: Number(editingFare.driver_search_radius_km ?? 10),
          is_active: editingFare.is_active,
          updated_at: new Date().toISOString(),
        });
      if (fErr) throw fErr;

      // Save waiting config if it exists
      if (editingWaiting) {
        const { error: wErr } = await supabase
          .from('waiting_charges_config')
          .upsert({
            ...editingWaiting,
            free_waiting_minutes: Number(editingWaiting.free_waiting_minutes),
            charge_per_hour: Number(editingWaiting.charge_per_hour),
            max_waiting_charge: Number(editingWaiting.max_waiting_charge),
            updated_at: new Date().toISOString(),
          }, { onConflict: 'vehicle_type' });
        if (wErr) throw wErr;
      }

      toast.success('Pricing config updated!');
      setEditingFareId(null);
      setEditingFare(null);
      setEditingWaiting(null);
      fetchConfigs();
    } catch (error: any) {
      toast.error('Failed to save: ' + error.message);
    } finally {
      setSaving(null);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"? This cannot be undone.`)) return;

    try {
      const vehicle = vehicles.find(v => v.id === id);
      if (!vehicle) throw new Error('Vehicle not found');

      await supabase
        .from('fare_config')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('vehicle_type', vehicle.vehicle_type);

      const { error: vehicleError } = await supabase
        .from('vehicle_specifications')
        .delete()
        .eq('id', id)
        .select();

      if (vehicleError) throw vehicleError;

      toast.success(`${name} deleted successfully!`);
      await fetchVehicles();
      await fetchConfigs();
    } catch (error: any) {
      toast.error('Failed to delete: ' + (error.message || JSON.stringify(error)));
    }
  };

  // Shared tab button style
  const tabBtn = (active: boolean) =>
    `px-5 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
      active ? 'bg-orange-500 text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'
    }`;

  // Shared input style
  const inputCls = 'w-full px-3 py-2 bg-gray-50 border border-transparent hover:border-gray-200 focus:border-orange-500 focus:bg-white rounded-lg transition-all font-medium text-gray-900 focus:outline-none text-sm';

  return (
    <div className="min-h-screen bg-[var(--color-brand-cream)] font-sans">
      <Sidebar />
      <div className="ml-72 p-8 max-w-[1600px]">
        {/* Header */}
        <div className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-1">Vehicle Types</h1>
            <p className="text-gray-500 text-sm">Manage vehicle types, specifications and pricing</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => { fetchVehicles(); fetchConfigs(); }}
              className="px-4 py-2.5 bg-white text-gray-600 rounded-xl font-semibold shadow-sm border border-gray-200 hover:bg-gray-50 transition-all flex items-center gap-2"
            >
              <RefreshCw size={16} /> Refresh
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-5 py-2.5 bg-orange-500 text-white rounded-xl font-semibold shadow-md shadow-orange-500/20 hover:bg-orange-600 transition-all flex items-center gap-2"
            >
              <Plus size={16} /> Add Vehicle Type
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                <Car size={20} className="text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{vehicles.length}</p>
                <p className="text-xs text-gray-500">Total Vehicle Types</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center text-lg">✅</div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{fareConfigs.size}</p>
                <p className="text-xs text-gray-500">With Fare Config</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center text-lg">⏱️</div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{waitingConfigs.size}</p>
                <p className="text-xs text-gray-500">With Waiting Config</p>
              </div>
            </div>
          </div>
        </div>

        {/* Vehicle Types Table */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-lg font-bold text-gray-900">All Vehicle Types</h2>
          </div>

          {loading ? (
            <div className="py-12 flex justify-center">
              <div className="animate-spin w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full" />
            </div>
          ) : vehicles.length === 0 ? (
            <div className="py-12 text-center text-gray-500">
              No vehicle types configured. Click &quot;Add Vehicle Type&quot; to get started.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50/50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Vehicle</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Type Key</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Max Weight (kg)</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Passengers</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Suitable For</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Fare / Waiting</th>
                    <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {vehicles.map((v) => (
                    <tr key={v.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center overflow-hidden border border-gray-100">
                            {v.icon_url ? (
                              <img src={v.icon_url} alt={v.display_name} className="w-full h-full object-contain p-1" />
                            ) : (
                              <span className="text-2xl">{v.icon_emoji}</span>
                            )}
                          </div>
                          <div>
                            <input
                              type="text"
                              value={v.display_name}
                              onChange={(e) => handleUpdate(v.id, 'display_name', e.target.value)}
                              className="font-bold text-gray-900 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-orange-500 focus:outline-none transition-all px-1 py-0.5"
                            />
                            <div className="flex items-center gap-2 mt-0.5">
                              <input
                                type="text"
                                value={v.icon_url || ''}
                                onChange={(e) => handleUpdate(v.id, 'icon_url', e.target.value)}
                                placeholder="Icon URL (optional)"
                                className="text-[10px] text-blue-500 bg-transparent border-b border-transparent hover:border-blue-200 focus:border-blue-500 focus:outline-none transition-all px-1 py-0.5 w-32"
                              />
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2.5 py-1 bg-gray-100 text-gray-700 rounded-lg text-xs font-mono font-medium">
                          {v.vehicle_type}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <input
                          type="number"
                          value={v.max_weight_kg || ''}
                          onChange={(e) => handleUpdate(v.id, 'max_weight_kg', e.target.value || null)}
                          placeholder="—"
                          className="w-20 px-3 py-1.5 bg-gray-50 border border-transparent hover:border-gray-200 focus:border-orange-500 focus:bg-white rounded-lg transition-all font-medium text-gray-900 focus:outline-none text-sm"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <input
                          type="number"
                          value={v.passenger_capacity}
                          onChange={(e) => handleUpdate(v.id, 'passenger_capacity', e.target.value)}
                          className="w-16 px-3 py-1.5 bg-gray-50 border border-transparent hover:border-gray-200 focus:border-orange-500 focus:bg-white rounded-lg transition-all font-medium text-gray-900 focus:outline-none text-sm"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {(v.suitable_for || []).map((s, i) => (
                            <span key={i} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-[10px] font-medium">
                              {s}
                            </span>
                          ))}
                          {(!v.suitable_for || v.suitable_for.length === 0) && (
                            <span className="text-xs text-gray-400">None set</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          {fareConfigs.get(v.vehicle_type) ? (
                            <div className="flex items-center gap-1.5">
                              <IndianRupee size={12} className="text-green-600" />
                              <span className="text-xs text-gray-600 font-mono">₹{fareConfigs.get(v.vehicle_type)?.base_fare} base</span>
                            </div>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-yellow-50 text-yellow-700">⚠ No Fare</span>
                          )}
                          {waitingConfigs.get(v.vehicle_type) ? (
                            <div className="flex items-center gap-1.5">
                              <Clock size={12} className="text-purple-600" />
                              <span className="text-xs text-gray-600 font-mono">{waitingConfigs.get(v.vehicle_type)?.free_waiting_minutes}min free</span>
                            </div>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-50 text-gray-500">No Waiting</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openFareModal(v.vehicle_type)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit pricing config"
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            onClick={() => handleSave(v.id)}
                            disabled={saving === v.id}
                            className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors disabled:opacity-50"
                            title="Save vehicle changes"
                          >
                            {saving === v.id ? (
                              <div className="w-4 h-4 border-2 border-orange-600 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <Save size={16} />
                            )}
                          </button>
                          <button
                            onClick={() => handleDelete(v.id, v.display_name)}
                            className="p-2 text-red-400 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors"
                            title="Delete"
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

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* Add Vehicle Modal                                                       */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[100]">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-8 pt-7 pb-0">
              <h2 className="text-xl font-bold text-gray-900">Add Vehicle Type</h2>
              <button onClick={() => { setShowAddModal(false); setAddModalTab('fare'); }} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            <div className="px-8 py-5 overflow-y-auto flex-1 space-y-6">
              {/* Vehicle Details Section */}
              <div>
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Vehicle Details</h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Vehicle Type Key *</label>
                      <input
                        type="text"
                        value={newVehicle.vehicle_type}
                        onChange={(e) => setNewVehicle({ ...newVehicle, vehicle_type: e.target.value })}
                        placeholder="e.g. mini_truck"
                        className="input-field text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Display Name *</label>
                      <input
                        type="text"
                        value={newVehicle.display_name}
                        onChange={(e) => setNewVehicle({ ...newVehicle, display_name: e.target.value })}
                        placeholder="e.g. Mini Truck"
                        className="input-field text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Description</label>
                    <input
                      type="text"
                      value={newVehicle.description || ''}
                      onChange={(e) => setNewVehicle({ ...newVehicle, description: e.target.value })}
                      placeholder="Short description..."
                      className="input-field text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Icon Emoji</label>
                      <input
                        type="text"
                        value={newVehicle.icon_emoji}
                        onChange={(e) => setNewVehicle({ ...newVehicle, icon_emoji: e.target.value })}
                        className="input-field text-sm text-center text-2xl"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Icon URL</label>
                      <input
                        type="text"
                        value={newVehicle.icon_url || ''}
                        onChange={(e) => setNewVehicle({ ...newVehicle, icon_url: e.target.value })}
                        placeholder="Image URL"
                        className="input-field text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Max Weight (kg)</label>
                      <input
                        type="number"
                        value={newVehicle.max_weight_kg || ''}
                        onChange={(e) => setNewVehicle({ ...newVehicle, max_weight_kg: e.target.value ? Number(e.target.value) : null })}
                        placeholder="e.g. 500"
                        className="input-field text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Passengers</label>
                      <input
                        type="number"
                        value={newVehicle.passenger_capacity}
                        onChange={(e) => setNewVehicle({ ...newVehicle, passenger_capacity: Number(e.target.value) })}
                        className="input-field text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Suitable For (comma-separated)</label>
                    <input
                      type="text"
                      value={suitableForInput}
                      onChange={(e) => setSuitableForInput(e.target.value)}
                      placeholder="e.g. Small packages, Documents, Food delivery"
                      className="input-field text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Pricing Section with Tabs */}
              <div>
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Pricing Configuration</h3>
                <div className="bg-gray-50 rounded-2xl p-1 mb-4 flex gap-1 w-fit">
                  <button onClick={() => setAddModalTab('fare')} className={tabBtn(addModalTab === 'fare')}>
                    <IndianRupee size={14} /> Fare Config
                  </button>
                  <button onClick={() => setAddModalTab('waiting')} className={tabBtn(addModalTab === 'waiting')}>
                    <Clock size={14} /> Waiting Charges
                  </button>
                </div>

                {addModalTab === 'fare' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Base Fare (₹)</label>
                        <input type="number" value={newFare.base_fare} onChange={(e) => setNewFare({ ...newFare, base_fare: Number(e.target.value) })} className={inputCls} />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Per KM (₹)</label>
                        <input type="number" step="0.1" value={newFare.per_km_rate} onChange={(e) => setNewFare({ ...newFare, per_km_rate: Number(e.target.value) })} className={inputCls} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Per Minute (₹)</label>
                        <input type="number" step="0.1" value={newFare.per_minute_rate} onChange={(e) => setNewFare({ ...newFare, per_minute_rate: Number(e.target.value) })} className={inputCls} />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Minimum Fare (₹)</label>
                        <input type="number" value={newFare.minimum_fare} onChange={(e) => setNewFare({ ...newFare, minimum_fare: Number(e.target.value) })} className={inputCls} />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Driver Search Radius (km)</label>
                        <input type="number" value={newFare.driver_search_radius_km} onChange={(e) => setNewFare({ ...newFare, driver_search_radius_km: Number(e.target.value) })} className={inputCls} />
                      </div>
                    </div>
                    <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl p-3">
                      <input type="checkbox" checked={newFare.is_active} onChange={(e) => setNewFare({ ...newFare, is_active: e.target.checked })} className="w-4 h-4 text-blue-600 rounded" />
                      <label className="text-sm text-gray-700 font-medium">Active (shown to customers)</label>
                    </div>
                  </div>
                )}

                {addModalTab === 'waiting' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Free Waiting Minutes</label>
                        <input type="number" value={newWaiting.free_waiting_minutes} onChange={(e) => setNewWaiting({ ...newWaiting, free_waiting_minutes: Number(e.target.value) })} className={inputCls} />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Charge Per Hour (₹)</label>
                        <input type="number" value={newWaiting.charge_per_hour} onChange={(e) => setNewWaiting({ ...newWaiting, charge_per_hour: Number(e.target.value) })} className={inputCls} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Charge Per Minute (₹)</label>
                        <input
                          type="number"
                          value={(newWaiting.charge_per_hour / 60).toFixed(2)}
                          disabled
                          className={inputCls + ' opacity-60 cursor-not-allowed'}
                        />
                        <p className="text-[10px] text-gray-400 mt-1">Auto-computed from ₹/Hour</p>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Max Waiting Charge (₹)</label>
                        <input type="number" value={newWaiting.max_waiting_charge} onChange={(e) => setNewWaiting({ ...newWaiting, max_waiting_charge: Number(e.target.value) })} className={inputCls} />
                      </div>
                    </div>
                    <div className="flex items-center gap-3 bg-purple-50 border border-purple-200 rounded-xl p-3">
                      <input type="checkbox" checked={newWaiting.is_active} onChange={(e) => setNewWaiting({ ...newWaiting, is_active: e.target.checked })} className="w-4 h-4 text-purple-600 rounded" />
                      <label className="text-sm text-gray-700 font-medium">Enable waiting charges</label>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-3 px-8 py-5 border-t border-gray-100">
              <button
                onClick={() => { setShowAddModal(false); setAddModalTab('fare'); }}
                className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAdd}
                disabled={addingNew}
                className="flex-1 btn-primary flex items-center justify-center gap-2"
              >
                {addingNew ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <><Plus size={16} /> Add Vehicle</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* Edit Fare / Waiting Config Modal                                        */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      {editingFareId && editingFare && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[100]">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-lg mx-4 flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-8 pt-7 pb-0">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Pricing Config</h2>
                <p className="text-xs text-gray-500 mt-0.5 font-mono">{editingFareId}</p>
              </div>
              <button onClick={() => { setEditingFareId(null); setEditingFare(null); setEditingWaiting(null); }} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            {/* Tabs */}
            <div className="px-8 pt-5">
              <div className="bg-gray-100 rounded-xl p-1 flex gap-1 w-fit">
                <button onClick={() => setFareModalTab('fare')} className={tabBtn(fareModalTab === 'fare')}>
                  <IndianRupee size={14} /> Fare Rates
                </button>
                <button onClick={() => setFareModalTab('waiting')} className={tabBtn(fareModalTab === 'waiting')}>
                  <Clock size={14} /> Waiting Charges
                </button>
              </div>
            </div>

            <div className="px-8 py-5 overflow-y-auto flex-1">
              {/* Fare Rates Tab */}
              {fareModalTab === 'fare' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Base Fare (₹)</label>
                      <input type="number" value={editingFare.base_fare} onChange={(e) => setEditingFare({ ...editingFare, base_fare: Number(e.target.value) })} className={inputCls} />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Per KM (₹)</label>
                      <input type="number" step="0.1" value={editingFare.per_km_rate} onChange={(e) => setEditingFare({ ...editingFare, per_km_rate: Number(e.target.value) })} className={inputCls} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Per Minute (₹)</label>
                      <input type="number" step="0.1" value={editingFare.per_minute_rate} onChange={(e) => setEditingFare({ ...editingFare, per_minute_rate: Number(e.target.value) })} className={inputCls} />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Minimum Fare (₹)</label>
                      <input type="number" value={editingFare.minimum_fare} onChange={(e) => setEditingFare({ ...editingFare, minimum_fare: Number(e.target.value) })} className={inputCls} />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Driver Search Radius (km)</label>
                      <input
                        type="number"
                        value={editingFare.driver_search_radius_km ?? 10}
                        onChange={(e) => setEditingFare({ ...editingFare, driver_search_radius_km: Number(e.target.value) })}
                        className={inputCls}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl p-3">
                    <input
                      type="checkbox"
                      checked={editingFare.is_active}
                      onChange={(e) => setEditingFare({ ...editingFare, is_active: e.target.checked })}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <label className="text-sm text-gray-700 font-medium">Active (shown to customers)</label>
                  </div>
                </div>
              )}

              {/* Waiting Charges Tab */}
              {fareModalTab === 'waiting' && (
                <div className="space-y-4">
                  {!editingWaiting ? (
                    <div className="py-8 text-center">
                      <p className="text-gray-500 mb-4">No waiting charges config for this vehicle yet.</p>
                      <button
                        onClick={() => setEditingWaiting({
                          id: '',
                          vehicle_type: editingFareId!,
                          free_waiting_minutes: 15,
                          charge_per_hour: 100,
                          charge_per_minute: 100 / 60,
                          max_waiting_charge: 400,
                          is_active: true,
                        })}
                        className="px-4 py-2 bg-purple-500 text-white rounded-xl text-sm font-semibold hover:bg-purple-600 transition-colors"
                      >
                        Create Waiting Config
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Free Waiting Minutes</label>
                          <input
                            type="number"
                            value={editingWaiting.free_waiting_minutes}
                            onChange={(e) => setEditingWaiting({ ...editingWaiting, free_waiting_minutes: Number(e.target.value) })}
                            className={inputCls}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Charge Per Hour (₹)</label>
                          <input
                            type="number"
                            value={editingWaiting.charge_per_hour}
                            onChange={(e) => setEditingWaiting({ ...editingWaiting, charge_per_hour: Number(e.target.value) })}
                            className={inputCls}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Charge Per Minute (₹)</label>
                          <input
                            type="number"
                            value={(editingWaiting.charge_per_hour / 60).toFixed(2)}
                            disabled
                            className={inputCls + ' opacity-60 cursor-not-allowed'}
                          />
                          <p className="text-[10px] text-gray-400 mt-1">Auto-computed from ₹/Hour</p>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Max Waiting Charge (₹)</label>
                          <input
                            type="number"
                            value={editingWaiting.max_waiting_charge}
                            onChange={(e) => setEditingWaiting({ ...editingWaiting, max_waiting_charge: Number(e.target.value) })}
                            className={inputCls}
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-3 bg-purple-50 border border-purple-200 rounded-xl p-3">
                        <input
                          type="checkbox"
                          checked={editingWaiting.is_active}
                          onChange={(e) => setEditingWaiting({ ...editingWaiting, is_active: e.target.checked })}
                          className="w-4 h-4 text-purple-600 rounded"
                        />
                        <label className="text-sm text-gray-700 font-medium">Enable waiting charges</label>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex gap-3 px-8 py-5 border-t border-gray-100">
              <button
                onClick={() => { setEditingFareId(null); setEditingFare(null); setEditingWaiting(null); }}
                className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSaveFareConfig(editingFareId)}
                disabled={saving === editingFareId}
                className="flex-1 btn-primary flex items-center justify-center gap-2"
              >
                {saving === editingFareId ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <><Save size={16} /> Save Pricing</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
