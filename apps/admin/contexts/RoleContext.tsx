'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';

export type AdminRole = 'admin' | 'superadmin' | 'manager';

interface RoleContextType {
  role: AdminRole | null;
  email: string;
  loading: boolean;
}

const RoleContext = createContext<RoleContextType>({
  role: null,
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

interface RoleProviderProps {
  children: ReactNode;
  initialRole?: AdminRole | null;
  initialEmail?: string;
  initialLoading?: boolean;
}

export function RoleProvider({
  children,
  initialRole = null,
  initialEmail = '',
  initialLoading,
}: RoleProviderProps) {
  const pathname = usePathname();
  const hasInitialIdentity = Boolean(initialRole || initialEmail);
  const [role, setRole] = useState<AdminRole | null>(initialRole);
  const [email, setEmail] = useState(initialEmail);
  const [loading, setLoading] = useState(
    initialLoading ?? (pathname !== '/login' && !initialRole && !initialEmail)
  );

  useEffect(() => {
    if (pathname === '/login') {
      setRole(null);
      setEmail('');
      setLoading(false);
      return;
    }

    async function fetchRole() {
      if (!hasInitialIdentity) {
        setLoading(true);
      }

      try {
        const response = await fetch('/api/auth/me', {
          cache: 'no-store',
          credentials: 'same-origin',
        });

        if (response.ok) {
          const data = await response.json();
          setRole(data.role || null);
          setEmail(data.email || '');
        } else {
          setRole(null);
          setEmail('');
        }
      } catch (error) {
        console.error('Error fetching role:', error);
        setRole(null);
        setEmail('');
      } finally {
        setLoading(false);
      }
    }
    fetchRole();
  }, [pathname, hasInitialIdentity]);

  return (
    <RoleContext.Provider value={{ role, email, loading }}>
      {children}
    </RoleContext.Provider>
  );
}
