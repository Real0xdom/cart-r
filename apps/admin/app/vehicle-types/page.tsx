'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Sidebar from '@/components/Sidebar';
import { Car, Plus, Save, RefreshCw, X, Trash2 } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface VehicleSpec {
  id: string;
  vehicle_type: string;
  display_name: string;
  description: string | null;
  icon_emoji: string;
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
  is_active: boolean;
}

const emptyVehicle: Omit<VehicleSpec, 'id' | 'created_at' | 'updated_at'> = {
  vehicle_type: '',
  display_name: '',
  description: '',
  icon_emoji: '🚗',
  max_weight_kg: null,
  max_volume_cubic_meters: null,
  passenger_capacity: 0,
  suitable_for: [],
};

export default function VehicleTypesPage() {
  const [vehicles, setVehicles] = useState<VehicleSpec[]>([]);
  const [fareConfigs, setFareConfigs] = useState<Map<string, FareConfig>>(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newVehicle, setNewVehicle] = useState(emptyVehicle);
  const [addingNew, setAddingNew] = useState(false);
  const [suitableForInput, setSuitableForInput] = useState('');
  const [editingFareId, setEditingFareId] = useState<string | null>(null);
  const [editingFare, setEditingFare] = useState<FareConfig | null>(null);

  useEffect(() => {
    fetchVehicles();
    fetchFareConfigs();
  }, []);

  async function fetchFareConfigs() {
    try {
      const { data, error } = await supabase
        .from('fare_config')
        .select('*');

      if (error) throw error;
      
      const configMap = new Map();
      (data || []).forEach(fc => {
        configMap.set(fc.vehicle_type, fc);
      });
      setFareConfigs(configMap);
    } catch (error: any) {
      console.error('Failed to load fare configs:', error);
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

      const { error } = await supabase
        .from('vehicle_specifications')
        .insert({
          ...newVehicle,
          suitable_for: suitable,
        });

      if (error) throw error;
      toast.success('Vehicle type added! Fare config will be auto-created.');
      setShowAddModal(false);
      setNewVehicle(emptyVehicle);
      setSuitableForInput('');
      fetchVehicles();
      fetchFareConfigs();
    } catch (error: any) {
      toast.error('Failed to add: ' + error.message);
    } finally {
      setAddingNew(false);
    }
  };

  const handleSaveFareConfig = async (vehicleType: string) => {
    if (!editingFare) return;
    
    setSaving(vehicleType);
    try {
      const { error } = await supabase
        .from('fare_config')
        .upsert({
          ...editingFare,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;
      toast.success('Fare config updated!');
      setEditingFareId(null);
      setEditingFare(null);
      fetchFareConfigs();
    } catch (error: any) {
      toast.error('Failed to save fare config: ' + error.message);
    } finally {
      setSaving(null);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"? This cannot be undone.`)) return;

    try {
      // Get the vehicle to find its vehicle_type
      const vehicle = vehicles.find(v => v.id === id);
      if (!vehicle) throw new Error('Vehicle not found');

      console.log('[DELETE] Starting deletion of', vehicle.vehicle_type);

      // First, deactivate the fare_config so it won't show to customers
      console.log('[DELETE] Deactivating fare_config for', vehicle.vehicle_type);
      const { error: fareError, data: fareData } = await supabase
        .from('fare_config')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('vehicle_type', vehicle.vehicle_type);

      if (fareError) {
        console.error('[DELETE] Fare deactivation error:', fareError);
        throw fareError;
      }
      console.log('[DELETE] Fare deactivated successfully', fareData);

      // Then delete the vehicle_specification
      console.log('[DELETE] Deleting vehicle_specification:', id);
      const { error: vehicleError, data: vehicleData } = await supabase
        .from('vehicle_specifications')
        .delete()
        .eq('id', id)
        .select(); // Add select() to see what was deleted

      if (vehicleError) {
        console.error('[DELETE] Vehicle deletion error:', vehicleError);
        throw vehicleError;
      }
      console.log('[DELETE] Vehicle deleted successfully', vehicleData);

      toast.success(`${name} deleted successfully!`);
      setVehicles(prev => prev.filter(v => v.id !== id));
      await fetchVehicles(); // Re-fetch full list from database
      await fetchFareConfigs(); // Refresh fare configs
      console.log('[DELETE] Deletion complete');
    } catch (error: any) {
      console.error('[DELETE] Error:', error);
      toast.error('Failed to delete: ' + (error.message || JSON.stringify(error)));
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-brand-cream)] font-sans">
      <Sidebar />
      <div className="ml-72 p-8 max-w-[1600px]">
        {/* Header */}
        <div className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-1">Vehicle Types</h1>
            <p className="text-gray-500 text-sm">Manage supported vehicle types and specifications</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={fetchVehicles}
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
                <p className="text-2xl font-bold text-gray-900">
                  {vehicles.length}
                </p>
                <p className="text-xs text-gray-500">Active Types</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center text-lg">📦</div>
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {vehicles.filter(v => (v.max_weight_kg || 0) > 0).length}
                </p>
                <p className="text-xs text-gray-500">With Weight Limits</p>
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
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Fare Status</th>
                    <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {vehicles.map((v) => (
                    <tr key={v.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{v.icon_emoji}</span>
                          <div>
                            <input
                              type="text"
                              value={v.display_name}
                              onChange={(e) => handleUpdate(v.id, 'display_name', e.target.value)}
                              className="font-bold text-gray-900 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-orange-500 focus:outline-none transition-all px-1 py-0.5"
                            />
                            <input
                              type="text"
                              value={v.description || ''}
                              onChange={(e) => handleUpdate(v.id, 'description', e.target.value)}
                              placeholder="Add description..."
                              className="block text-xs text-gray-500 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-orange-500 focus:outline-none transition-all px-1 py-0.5 w-48"
                            />
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
                        {fareConfigs.get(v.vehicle_type) ? (
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">
                              ✓ Active
                            </span>
                            <span className="text-xs text-gray-600 font-mono">₹{fareConfigs.get(v.vehicle_type)?.base_fare}</span>
                          </div>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-50 text-yellow-700">
                            ⚠ No Fare
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {fareConfigs.get(v.vehicle_type) && (
                            <button
                              onClick={() => {
                                setEditingFare(fareConfigs.get(v.vehicle_type) || null);
                                setEditingFareId(v.vehicle_type);
                              }}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Edit fare config"
                            >
                              💰
                            </button>
                          )}
                          <button
                            onClick={() => handleSave(v.id)}
                            disabled={saving === v.id}
                            className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors disabled:opacity-50"
                            title="Save changes"
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

      {/* Add Vehicle Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[100]">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-lg p-8 mx-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Add Vehicle Type</h2>
              <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                <X size={20} className="text-gray-500" />
              </button>
            </div>

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

            <div className="flex gap-3 mt-8">
              <button
                onClick={() => setShowAddModal(false)}
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
                  <>
                    <Plus size={16} /> Add Vehicle
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Fare Config Modal */}
      {editingFareId && editingFare && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[100]">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-lg p-8 mx-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Edit Fare Config</h2>
              <button onClick={() => { setEditingFareId(null); setEditingFare(null); }} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Vehicle Type</label>
                <input
                  type="text"
                  value={editingFare.vehicle_type}
                  disabled
                  className="input-field text-sm bg-gray-50 text-gray-600 cursor-not-allowed"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Base Fare (₹)</label>
                  <input
                    type="number"
                    value={editingFare.base_fare}
                    onChange={(e) => setEditingFare({ ...editingFare, base_fare: Number(e.target.value) })}
                    className="input-field text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Per KM (₹)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={editingFare.per_km_rate}
                    onChange={(e) => setEditingFare({ ...editingFare, per_km_rate: Number(e.target.value) })}
                    className="input-field text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Per Minute (₹)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={editingFare.per_minute_rate}
                    onChange={(e) => setEditingFare({ ...editingFare, per_minute_rate: Number(e.target.value) })}
                    className="input-field text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Minimum Fare (₹)</label>
                  <input
                    type="number"
                    value={editingFare.minimum_fare}
                    onChange={(e) => setEditingFare({ ...editingFare, minimum_fare: Number(e.target.value) })}
                    className="input-field text-sm"
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

            <div className="flex gap-3 mt-8">
              <button
                onClick={() => { setEditingFareId(null); setEditingFare(null); }}
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
                  <>
                    <Save size={16} /> Save Fare
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
