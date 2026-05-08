'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Check if there's a token in the URL (backwards-compat redirect)
    const params = new URLSearchParams(window.location.search);
    const rawT = params.get('t');
    // Only allow safe slug characters to prevent injection via the redirect param
    const t = rawT && /^[a-zA-Z0-9_-]{1,128}$/.test(rawT) ? rawT : null;
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
