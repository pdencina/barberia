"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clearAppCache } from "@/lib/swr-cache";
import { createClient } from "@/lib/supabase/client";

const NAV = [
  { href: "/socios", label: "Catálogo y pedido" },
  { href: "/socios/pedidos", label: "Mis pedidos" },
];

export function PortalShell({ companyName, customerName, children }: { companyName: string; customerName: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const signOut = async () => {
    clearAppCache();
    await createClient().auth.signOut();
    router.push("/socios/login");
    router.refresh();
  };
  return (
    <div className="min-h-screen bg-brand-light">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate font-bold text-brand-dark">{companyName}</p>
            <p className="text-xs text-gray-500">Portal de distribuidores · {customerName}</p>
          </div>
          <button onClick={signOut} className="text-sm text-gray-600 underline">Salir</button>
        </div>
        <nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4 pb-2">
          {NAV.map((n) => {
            const active = n.href === "/socios" ? pathname === "/socios" : pathname.startsWith(n.href);
            return (
              <Link key={n.href} href={n.href} className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium ${active ? "bg-brand-blue text-white" : "text-gray-600 hover:bg-gray-100"}`}>
                {n.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto max-w-5xl p-4">{children}</main>
    </div>
  );
}
