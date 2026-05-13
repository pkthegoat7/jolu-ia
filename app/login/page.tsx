'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/admin'); }, [router]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F2F5FA]">
      <div className="h-8 w-8 rounded-full border-2 border-[#0C417D]/30 border-t-[#0C417D] animate-spin" />
    </div>
  );
}
