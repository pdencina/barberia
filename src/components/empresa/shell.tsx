"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext } from "react";
import { clearAppCache } from "@/lib/swr-cache";
import { createClient } from "@/lib/supabase/client";
import type { Capability, CompanyRole } from "@/lib/empresas/capabilities";

const ROLE_LABEL: Record<CompanyRole, string> = { owner: "Dueño", seller: "Vendedor", warehouse: "Bodega" };

const NAV: { href: string; label: string; needs?: Capability }[] = [
  { href: "/empresa", label: "Stock", needs: "stock.ver" },
  { href: "/empresa/pedidos", label: "Pedidos" },
  { href: "/empresa/conteos", label: "Conteos", needs: "conteos.ver" },
  { href: "/empresa/productos", label: "Productos", needs: "productos.ver" },
  { href: "/empresa/clientes", label: "Clientes", needs: "clientes.ver" },
];

const CompanyContext = createContext<{ role: CompanyRole; capabilities: readonly Capability[] }>({ role: "seller", capabilities: [] });

// Solo para mostrar u ocultar botones. El permiso real lo decide cada ruta en el servidor.
export function useCan() {
  const { capabilities } = useContext(CompanyContext);
  return (capability: Capability) => capabilities.includes(capability);
}

export function CompanyShell({ tenantName, role, capabilities, children }: {
  tenantName: string; role: CompanyRole; capabilities: readonly Capability[]; children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const signOut = async () => {
    clearAppCache();
    await createClient().auth.signOut();
    router.push("/empresa/login");
    router.refresh();
  };
  return (
    <CompanyContext.Provider value={{ role, capabilities }}>
      <div className="min-h-screen bg-brand-light">
        <header className="border-b border-gray-200 bg-white">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate font-bold text-brand-dark">{tenantName}</p>
              <p className="text-xs text-gray-500">{ROLE_LABEL[role]}</p>
            </div>
            <button onClick={signOut} className="text-sm text-gray-600 underline">Salir</button>
          </div>
          <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pb-2">
            {NAV.filter((n) => !n.needs || capabilities.includes(n.needs)).map((n) => {
              const active = n.href === "/empresa" ? pathname === "/empresa" : pathname.startsWith(n.href);
              return (
                <Link key={n.href} href={n.href} className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium ${active ? "bg-brand-blue text-white" : "text-gray-600 hover:bg-gray-100"}`}>
                  {n.label}
                </Link>
              );
            })}
          </nav>
        </header>
        <main className="mx-auto max-w-6xl p-4">{children}</main>
      </div>
    </CompanyContext.Provider>
  );
}
