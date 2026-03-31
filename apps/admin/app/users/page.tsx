'use client';
import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import { Search, RefreshCw, User, CheckCircle, Ban } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatar_url: string | null;
  role: string;
  created_at: string;
  is_active: boolean;
  customer_app_enabled: boolean;
  has_driver_access?: boolean;
  driver_app_enabled?: boolean | null;
  driver_verification_status?: string | null;
  booking_count?: number;
  referral_count?: number;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
     const timer = setTimeout(() => {
        fetchUsers();
     }, 500);
     return () => clearTimeout(timer);
  }, [searchTerm]);

  async function fetchUsers() {
    setLoading(true);
    try {
      // Use API route to fetch users with search query
      const response = await fetch(`/api/users?search=${searchTerm}`);
      
      if (!response.ok) {
        console.error('API error:', response.status);
      } else {
        const data = await response.json();
        setUsers(data || []);
      }
    } catch (error) {
      console.error('Error:', error);
    }
    setLoading(false);
  }

  async function toggleCustomerAccess(user: User) {
    if (user.role === 'admin') {
      toast.error('Cannot block admin users');
      return;
    }
    
    if (!confirm(`Are you sure you want to ${user.customer_app_enabled ? 'disable' : 'enable'} customer access for this user?`)) return;

    try {
      const response = await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: user.id,
          customer_app_enabled: !user.customer_app_enabled,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || 'Failed to update customer access');
      }

      toast.success(`Customer access ${user.customer_app_enabled ? 'disabled' : 'enabled'} successfully`);
      
      // Optimistic update
      setUsers(users.map(u => 
        u.id === user.id ? { ...u, customer_app_enabled: !user.customer_app_enabled } : u
      ));
    } catch (error: any) {
      toast.error('Failed to update customer access: ' + error.message);
    }
  }

  // Uses server-side filtered data directly
  const filteredUsers = users;

  return (
    <div className="min-h-screen bg-[var(--color-brand-cream)] font-sans">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className="ml-72 p-8 max-w-[1600px]">
        <div className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-1">Users</h1>
            <p className="text-gray-500 text-sm">{users.length} registered users found</p>
          </div>
          <button 
            onClick={fetchUsers}
            className="px-5 py-2.5 bg-orange-500 text-white rounded-xl font-semibold shadow-md shadow-orange-500/20 hover:bg-orange-600 transition-all flex items-center gap-2"
          >
            <RefreshCw size={16} /> Refresh
          </button>
        </div>

        {/* Search */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-8">
          <div className="relative">
            <Search size={18} className="absolute left-4 top-3.5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, email, or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white transition-all"
            />
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-500">
              <div className="animate-spin w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full mx-auto mb-4"/>
              Loading users...
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-12 text-center text-gray-500 bg-gray-50/50">No users found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50/50">
                  <tr>
                    <th className="px-8 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">User</th>
                    <th className="px-8 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Contact</th>
                    <th className="px-8 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</th>
                    <th className="px-8 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Apps</th>
                    <th className="px-8 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Customer Access</th>
                    <th className="px-8 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Driver Access</th>
                    <th className="px-8 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Referrals</th>
                    <th className="px-8 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Joined</th>
                    <th className="px-8 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50/80 transition-colors group">
                      <td className="px-8 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-emerald-50 rounded-full flex items-center justify-center">
                            {user.avatar_url ? (
                              <img src={user.avatar_url} alt="" className="w-10 h-10 rounded-full" />
                            ) : (
                              <User size={18} className="text-emerald-600" />
                            )}
                          </div>
                          <div>
                            <div className="font-bold text-gray-900">
                              {user.name || 'Unknown'}
                            </div>
                            <div className="text-xs text-gray-500">
                              ID: {user.id.slice(0, 8)}...
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-4">
                        <div className="text-sm text-gray-900 font-medium">{user.email || 'N/A'}</div>
                        <div className="text-xs text-gray-500">{user.phone || 'N/A'}</div>
                      </td>
                      <td className="px-8 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                          user.role === 'admin' 
                            ? 'bg-purple-100 text-purple-700' 
                            : user.role === 'driver'
                            ? 'bg-orange-100 text-orange-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          {user.role || 'customer'}
                        </span>
                      </td>
                      <td className="px-8 py-4">
                        <div className="flex flex-wrap gap-2">
                          <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                            user.customer_app_enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'
                          }`}>
                            Customer
                          </span>
                          {user.has_driver_access && (
                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                              user.driver_app_enabled === false ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
                            }`}>
                              Driver
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-8 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                          user.customer_app_enabled ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {user.customer_app_enabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </td>
                      <td className="px-8 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                          !user.has_driver_access
                            ? 'bg-gray-100 text-gray-500'
                            : user.driver_app_enabled === false
                              ? 'bg-red-100 text-red-700'
                              : 'bg-green-100 text-green-700'
                        }`}>
                          {!user.has_driver_access
                            ? 'No driver account'
                            : user.driver_app_enabled === false
                              ? 'Suspended'
                              : user.driver_verification_status === 'approved'
                                ? 'Enabled'
                                : `Pending ${user.driver_verification_status || ''}`.trim()}
                        </span>
                      </td>
                      <td className="px-8 py-4">
                        <span className="text-sm font-medium text-gray-900">{user.referral_count ?? 0}</span>
                      </td>
                      <td className="px-8 py-4 text-xs font-medium text-gray-500">
                        {new Date(user.created_at).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="px-8 py-4 text-right">
                        {user.role !== 'admin' && (
                          <button
                            onClick={() => toggleCustomerAccess(user)}
                            className={`p-2 rounded-lg transition-colors ${
                              user.customer_app_enabled
                                ? 'text-red-500 hover:bg-red-50' 
                                : 'text-green-500 hover:bg-green-50'
                            }`}
                            title={user.customer_app_enabled ? 'Disable Customer App' : 'Enable Customer App'}
                          >
                            {user.customer_app_enabled ? <Ban size={18} /> : <CheckCircle size={18} />}
                          </button>
                        )}
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
