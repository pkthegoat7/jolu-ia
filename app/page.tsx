'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Check if there's a token in the URL (backwards-compat redirect)
    const params = new URLSearchParams(window.location.search);
    const t = params.get('t');
    if (t) {
      router.replace(`/analise?t=${t}`);
    } else {
      router.replace('/admin');
    }
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f7f0f3]">
      <div className="h-8 w-8 rounded-full border-2 border-[#b96f8d]/30 border-t-[#b96f8d] animate-spin" />
    </div>
  );
}
