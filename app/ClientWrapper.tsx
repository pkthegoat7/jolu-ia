'use client';
import { usePathname } from 'next/navigation';

const LEAD_PATHS = ['/analise', '/obrigado'];

// Admin route protection is handled server-side by middleware.ts.
// This wrapper only strips the layout shell from lead-facing pages.
export default function ClientWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLeadPath = LEAD_PATHS.some(p => pathname.startsWith(p));
  if (isLeadPath) return <>{children}</>;
  return <>{children}</>;
}
