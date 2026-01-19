"use strict";
'use client';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = UsersPage;
const react_1 = require("react");
const Sidebar_1 = __importDefault(require("@/components/Sidebar"));
const lucide_react_1 = require("lucide-react");
function UsersPage() {
    const [users, setUsers] = (0, react_1.useState)([]);
    const [loading, setLoading] = (0, react_1.useState)(true);
    const [searchTerm, setSearchTerm] = (0, react_1.useState)('');
    (0, react_1.useEffect)(() => {
        fetchUsers();
    }, []);
    async function fetchUsers() {
        setLoading(true);
        try {
            // Use API route to fetch users (server-side with service role key bypasses RLS)
            const response = await fetch('/api/users');
            if (!response.ok) {
                console.error('API error:', response.status);
            }
            else {
                const data = await response.json();
                setUsers(data || []);
            }
        }
        catch (error) {
            console.error('Error:', error);
        }
        setLoading(false);
    }
    const filteredUsers = users.filter(u => {
        var _a, _b, _c;
        return searchTerm === '' ||
            ((_a = u.name) === null || _a === void 0 ? void 0 : _a.toLowerCase().includes(searchTerm.toLowerCase())) ||
            ((_b = u.email) === null || _b === void 0 ? void 0 : _b.toLowerCase().includes(searchTerm.toLowerCase())) ||
            ((_c = u.phone) === null || _c === void 0 ? void 0 : _c.includes(searchTerm));
    });
    return (<div className="min-h-screen bg-[var(--color-brand-cream)] font-sans">
      {/* Sidebar */}
      <Sidebar_1.default />

      {/* Main Content */}
      <div className="ml-72 p-8 max-w-[1600px]">
        <div className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-1">Users</h1>
            <p className="text-gray-500 text-sm">{users.length} registered users</p>
          </div>
          <button onClick={fetchUsers} className="px-5 py-2.5 bg-orange-500 text-white rounded-xl font-semibold shadow-md shadow-orange-500/20 hover:bg-orange-600 transition-all flex items-center gap-2">
            <lucide_react_1.RefreshCw size={16}/> Refresh
          </button>
        </div>

        {/* Search */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-8">
          <div className="relative">
            <lucide_react_1.Search size={18} className="absolute left-4 top-3.5 text-gray-400"/>
            <input type="text" placeholder="Search by name, email, or phone..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white transition-all"/>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
          {loading ? (<div className="p-12 text-center text-gray-500">
              <div className="animate-spin w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full mx-auto mb-4"/>
              Loading users...
            </div>) : filteredUsers.length === 0 ? (<div className="p-12 text-center text-gray-500 bg-gray-50/50">No users found</div>) : (<div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50/50">
                  <tr>
                    <th className="px-8 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">User</th>
                    <th className="px-8 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Contact</th>
                    <th className="px-8 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</th>
                    <th className="px-8 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredUsers.map((user) => (<tr key={user.id} className="hover:bg-gray-50/80 transition-colors group">
                      <td className="px-8 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-emerald-50 rounded-full flex items-center justify-center">
                            {user.avatar_url ? (<img src={user.avatar_url} alt="" className="w-10 h-10 rounded-full"/>) : (<lucide_react_1.User size={18} className="text-emerald-600"/>)}
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
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${user.role === 'admin'
                    ? 'bg-purple-100 text-purple-700'
                    : user.role === 'driver'
                        ? 'bg-orange-100 text-orange-700'
                        : 'bg-gray-100 text-gray-700'}`}>
                          {user.role || 'customer'}
                        </span>
                      </td>
                      <td className="px-8 py-4 text-xs font-medium text-gray-500">
                        {new Date(user.created_at).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                })}
                      </td>
                    </tr>))}
                </tbody>
              </table>
            </div>)}
        </div>
      </div>
    </div>);
}
