'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';

export type AdminRole = 'admin' | 'superadmin' | 'manager';

interface RoleContextType {
  role: AdminRole;
  email: string;
  loading: boolean;
}

const RoleContext = createContext<RoleContextType>({
  role: 'admin',
  email: '',
  loading: true,
});

export function useRole() {
  return useContext(RoleContext);
}

// Routes that only admins/superadmins can access
export const ADMIN_ONLY_ROUTES = [
  '/finance',
  '/payouts',
  '/settings',
  '/vehicle-types',
  '/service-areas',
  '/addons',
  '/legal',
];

// Sidebar nav items visible to managers
export const MANAGER_ALLOWED_PATHS = [
  '/',
  '/bookings',
  '/drivers',
  '/users',
  '/ratings',
  '/notifications',
  '/support',
];

export function RoleProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [role, setRole] = useState<AdminRole>('admin');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (pathname === '/login') {
      setLoading(false);
      return;
    }

    async function fetchRole() {
      try {
        const response = await fetch('/api/auth/me', {
          cache: 'no-store',
          credentials: 'same-origin',
        });

        if (response.ok) {
          const data = await response.json();
          setRole(data.role || 'admin');
          setEmail(data.email || '');
        }
      } catch (error) {
        console.error('Error fetching role:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchRole();
  }, [pathname]);

  return (
    <RoleContext.Provider value={{ role, email, loading }}>
      {children}
    </RoleContext.Provider>
  );
}
