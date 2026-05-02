'use client';
import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

const LEAD_PATHS = ['/analise', '/obrigado'];
const ADMIN_PROTECTED = ['/admin/dashboard', '/admin/leads'];

export default function ClientWrapper({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const isLeadPath  = LEAD_PATHS.some(p => pathname.startsWith(p));
  const isAdminAuth = ADMIN_PROTECTED.some(p => pathname.startsWith(p));
  const isAdminLogin = pathname === '/admin';

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;

    if (isAdminAuth && !token) {
      router.push('/admin');
    } else if (isAdminLogin && token) {
      router.push('/admin/dashboard');
    }
  }, [pathname, router, isAdminAuth, isAdminLogin]);

  // Lead pages and obrigado: render children directly, no chrome
  if (isLeadPath) return <>{children}</>;

  return <>{children}</>;
}
