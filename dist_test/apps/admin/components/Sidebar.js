"use strict";
'use client';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = Sidebar;
const link_1 = __importDefault(require("next/link"));
const navigation_1 = require("next/navigation");
const react_1 = require("react");
const lucide_react_1 = require("lucide-react");
const navItems = [
    { href: '/', label: 'Dashboard', icon: lucide_react_1.LayoutDashboard },
    { href: '/bookings', label: 'Bookings', icon: lucide_react_1.Package },
    { href: '/drivers', label: 'Drivers', icon: lucide_react_1.Truck },
    { href: '/users', label: 'Users', icon: lucide_react_1.Users },
    { href: '/notifications', label: 'Notifications', icon: lucide_react_1.Bell },
    { href: '/analytics', label: 'Analytics', icon: lucide_react_1.BarChart3 },
];
function Sidebar({ currentPath }) {
    const pathname = (0, navigation_1.usePathname)();
    const router = (0, navigation_1.useRouter)();
    const activePath = currentPath || pathname;
    const [adminInfo, setAdminInfo] = (0, react_1.useState)(null);
    // Fetch admin info from session on mount
    (0, react_1.useEffect)(() => {
        async function fetchAdminInfo() {
            try {
                const response = await fetch('/api/auth/me');
                if (response.ok) {
                    const data = await response.json();
                    setAdminInfo(data);
                }
            }
            catch (error) {
                console.error('Error fetching admin info:', error);
            }
        }
        fetchAdminInfo();
    }, []);
    const handleLogout = async () => {
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
            router.push('/login');
            router.refresh();
        }
        catch (error) {
            console.error('Logout error:', error);
        }
    };
    // Get initials from email
    const getInitials = (email) => {
        if (!email)
            return 'AD';
        const parts = email.split('@')[0].split(/[._-]/);
        if (parts.length >= 2) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return email.slice(0, 2).toUpperCase();
    };
    return (<div className="fixed left-0 top-0 h-full w-72 bg-white border-r border-gray-100 p-6 flex flex-col shadow-sm z-50">
      {/* Brand */}
      <div className="flex flex-col items-center mb-10 px-2">
        <img src="/cartr-logo.png" alt="CARTR" className="h-14 w-auto object-contain mb-2"/>
        <p className="text-[10px] text-orange-600 font-bold tracking-widest uppercase text-center">
          Rapid, Reliable, Responsible
        </p>
      </div>

      {/* Navigation */}
      <nav className="space-y-1.5 flex-1 relative">
        <div className="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Menu</div>
        {navItems.map((item) => {
            const isActive = activePath === item.href ||
                (item.href !== '/' && activePath.startsWith(item.href));
            const Icon = item.icon;
            return (<link_1.default key={item.href} href={item.href} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group relative ${isActive
                    ? 'bg-orange-50 text-orange-600 font-semibold'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}>
              <Icon size={20} className={`transition-transform duration-200 ${isActive ? 'text-orange-500' : 'text-gray-400 group-hover:text-gray-600'}`} strokeWidth={isActive ? 2.5 : 2}/>
              <span className="flex-1">{item.label}</span>
              {isActive && (<lucide_react_1.ChevronRight size={16} className="text-orange-400"/>)}
            </link_1.default>);
        })}
      </nav>

      {/* User Profile / Logout */}
      <div className="mt-auto pt-6 border-t border-gray-100">
        <div className="bg-gradient-to-r from-gray-50 to-gray-100/50 rounded-2xl p-4 mb-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-orange-500 flex items-center justify-center text-white font-bold text-sm shadow-md">
            {adminInfo ? getInitials(adminInfo.email) : <lucide_react_1.User size={18}/>}
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="text-sm font-semibold text-gray-900 truncate">
              {(adminInfo === null || adminInfo === void 0 ? void 0 : adminInfo.role) === 'superadmin' ? 'Super Admin' : 'Admin'}
            </p>
            <p className="text-xs text-gray-500 truncate">
              {(adminInfo === null || adminInfo === void 0 ? void 0 : adminInfo.email) || 'Loading...'}
            </p>
          </div>
        </div>

        <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 text-red-500 hover:bg-red-50 rounded-xl transition-colors text-sm font-medium group">
          <lucide_react_1.LogOut size={18} className="group-hover:translate-x-0.5 transition-transform"/>
          Sign Out
        </button>
      </div>
    </div>);
}
