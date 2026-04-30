'use client';
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Image from "next/image";

export default function ClientWrapper({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    setIsAuthenticated(Boolean(token));

    if (!token && pathname.startsWith("/dashboard")) {
      router.push("/login");
    } else if (token && pathname === "/login") {
      router.push("/dashboard");
    }
  }, [pathname, router]);

  const logout = () => {
    localStorage.removeItem("access_token");
    setIsAuthenticated(false);
    router.push("/login");
  };

  return (
    <>
      <nav className="sticky top-0 z-50 border-b border-[#0a376c] bg-[#072c57]">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center">
            <Image
              src="/logo.png"
              alt="Patrícia Elias"
              width={200}
              height={40}
              className="h-10 w-auto object-contain"
              priority
            />
          </div>

        {isAuthenticated && (
            <button
              onClick={logout}
              className="rounded-full border border-white/30 bg-white/10 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-white/20"
            >
              Sair
            </button>
        )}
        </div>
      </nav>
      {children}
    </>
  );
}