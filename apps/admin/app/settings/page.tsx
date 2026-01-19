'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Sidebar from '@/components/Sidebar';
import { Settings, Save, RefreshCw, AlertCircle, Check, DollarSign } from 'lucide-react';
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

export default function SettingsPage() {
  const [configs, setConfigs] = useState<FareConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    fetchConfigs();
  }, []);

  async function fetchConfigs() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('fare_config')
        .select('*')
        .order('vehicle_type');
      
      if (error) throw error;
      setConfigs(data || []);
      setHasChanges(false);
    } catch (error: any) {
      toast.error('Failed to load settings: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  const handleUpdate = (id: string, field: keyof FareConfig, value: any) => {
    setConfigs(prev => prev.map(config => {
      if (config.id === id) {
        return { ...config, [field]: value };
      }
      return config;
    }));
    setHasChanges(true);
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
      setHasChanges(false);
    } catch (error: any) {
      toast.error('Failed to save: ' + error.message);
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-brand-cream)] font-sans">
      <Sidebar />
      <div className="ml-72 p-8 max-w-[1600px]">
        <div className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-1">Platform Settings</h1>
            <p className="text-gray-500 text-sm">Manage fare rates and global configuration</p>
          </div>
          <div className="flex gap-3">
             <button 
              onClick={fetchConfigs}
              className="px-4 py-2 bg-white text-gray-600 rounded-xl font-semibold shadow-sm border border-gray-200 hover:bg-gray-50 transition-all flex items-center gap-2"
            >
              <RefreshCw size={16} /> Refresh
            </button>
          </div>
        </div>

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
                      <td className="py-2 px-4">
                        <input 
                          type="number" 
                          value={config.base_fare}
                          onChange={(e) => handleUpdate(config.id, 'base_fare', e.target.value)}
                          className="w-24 px-3 py-2 bg-gray-50 border border-transparent hover:border-gray-200 focus:border-orange-500 focus:bg-white rounded-lg transition-all font-medium text-gray-900 focus:outline-none"
                        />
                      </td>
                      <td className="py-2 px-4">
                        <input 
                          type="number" 
                          value={config.per_km_rate}
                          onChange={(e) => handleUpdate(config.id, 'per_km_rate', e.target.value)}
                          className="w-24 px-3 py-2 bg-gray-50 border border-transparent hover:border-gray-200 focus:border-orange-500 focus:bg-white rounded-lg transition-all font-medium text-gray-900 focus:outline-none"
                        />
                      </td>
                      <td className="py-2 px-4">
                         <input 
                          type="number" 
                          value={config.per_minute_rate}
                          onChange={(e) => handleUpdate(config.id, 'per_minute_rate', e.target.value)}
                          className="w-24 px-3 py-2 bg-gray-50 border border-transparent hover:border-gray-200 focus:border-orange-500 focus:bg-white rounded-lg transition-all font-medium text-gray-900 focus:outline-none"
                        />
                      </td>
                       <td className="py-2 px-4">
                         <input 
                          type="number" 
                          value={config.minimum_fare}
                          onChange={(e) => handleUpdate(config.id, 'minimum_fare', e.target.value)}
                          className="w-24 px-3 py-2 bg-gray-50 border border-transparent hover:border-gray-200 focus:border-orange-500 focus:bg-white rounded-lg transition-all font-medium text-gray-900 focus:outline-none"
                        />
                      </td>
                      <td className="py-2 px-4">
                         <input 
                          type="number" 
                          value={config.cancellation_fee}
                          onChange={(e) => handleUpdate(config.id, 'cancellation_fee', e.target.value)}
                          className="w-24 px-3 py-2 bg-gray-50 border border-transparent hover:border-gray-200 focus:border-orange-500 focus:bg-white rounded-lg transition-all font-medium text-gray-900 focus:outline-none"
                        />
                      </td>
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
      </div>
    </div>
  );
}
