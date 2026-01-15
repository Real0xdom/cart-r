'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  Package,
  Truck,
  Users,
  BarChart3,
  LogOut,
  ChevronRight,
  User,
  Bell,
  Settings,
  MessageSquare
} from 'lucide-react';

interface SidebarProps {
  currentPath?: string;
}

interface AdminInfo {
  email: string;
  role: string;
}

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/bookings', label: 'Bookings', icon: Package },
  { href: '/drivers', label: 'Drivers', icon: Truck },
  { href: '/users', label: 'Users', icon: Users },
  { href: '/notifications', label: 'Notifications', icon: Bell },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/support', label: 'Support', icon: MessageSquare },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export default function Sidebar({ currentPath }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const activePath = currentPath || pathname;
  const [adminInfo, setAdminInfo] = useState<AdminInfo | null>(null);

  // Fetch admin info from session on mount
  useEffect(() => {
    async function fetchAdminInfo() {
      try {
        const response = await fetch('/api/auth/me');
        if (response.ok) {
          const data = await response.json();
          setAdminInfo(data);
        }
      } catch (error) {
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
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Get initials from email
  const getInitials = (email: string) => {
    if (!email) return 'AD';
    const parts = email.split('@')[0].split(/[._-]/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return email.slice(0, 2).toUpperCase();
  };

  return (
    <div className="fixed left-0 top-0 h-full w-72 bg-white border-r border-gray-100 p-6 flex flex-col shadow-sm z-50">
      {/* Brand */}
      <div className="flex flex-col items-center mb-10 px-2">
        <img
          src="/cartr-logo.png"
          alt="CARTR"
          className="h-14 w-auto object-contain mb-2"
        />
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

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group relative ${isActive
                ? 'bg-orange-50 text-orange-600 font-semibold'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
            >
              <Icon
                size={20}
                className={`transition-transform duration-200 ${isActive ? 'text-orange-500' : 'text-gray-400 group-hover:text-gray-600'}`}
                strokeWidth={isActive ? 2.5 : 2}
              />
              <span className="flex-1">{item.label}</span>
              {isActive && (
                <ChevronRight size={16} className="text-orange-400" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* User Profile / Logout */}
      <div className="mt-auto pt-6 border-t border-gray-100">
        <div className="bg-gradient-to-r from-gray-50 to-gray-100/50 rounded-2xl p-4 mb-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-orange-500 flex items-center justify-center text-white font-bold text-sm shadow-md">
            {adminInfo ? getInitials(adminInfo.email) : <User size={18} />}
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="text-sm font-semibold text-gray-900 truncate">
              {adminInfo?.role === 'superadmin' ? 'Super Admin' : 'Admin'}
            </p>
            <p className="text-xs text-gray-500 truncate">
              {adminInfo?.email || 'Loading...'}
            </p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 text-red-500 hover:bg-red-50 rounded-xl transition-colors text-sm font-medium group"
        >
          <LogOut size={18} className="group-hover:translate-x-0.5 transition-transform" />
          Sign Out
        </button>
      </div>
    </div>
  );
}

