"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";
import { ClipboardCheck, ClipboardList, Contact, FileBarChart, Import, LayoutDashboard, LogOut, Megaphone, Menu, Package, Phone, Settings, Tag, Users, UsersRound, Warehouse, X, type LucideIcon } from "lucide-react";
import { clearAppCache } from "@/lib/swr-cache";
import { createClient } from "@/lib/supabase/client";
import type { Capability, CompanyRole } from "@/lib/empresas/capabilities";

const ROLE_LABEL: Record<CompanyRole, string> = { owner: "Dueño", seller: "Vendedor", warehouse: "Bodega" };

// hides: el vendedor ve "Mi cola"; el dueño ve "Cartera" (la misma página, con la vista de todos).
const NAV: { href: string; label: string; icon: LucideIcon; needs?: Capability; hides?: Capability }[] = [
  { href: "/empresa", label: "Dashboard", icon: LayoutDashboard, needs: "reporte.ver" },
  { href: "/empresa/stock", label: "Stock", icon: Warehouse, needs: "stock.ver" },
  { href: "/empresa/cartera", label: "Mi cola", icon: Phone, needs: "gestiones.registrar", hides: "cartera.ver_todas" },
  { href: "/empresa/pedidos", label: "Pedidos", icon: ClipboardList },
  { href: "/empresa/conteos", label: "Conteos", icon: ClipboardCheck, needs: "conteos.ver" },
  { href: "/empresa/productos", label: "Productos", icon: Package, needs: "productos.ver" },
  { href: "/empresa/marcas", label: "Marcas", icon: Tag, needs: "productos.editar" },
  { href: "/empresa/clientes", label: "Clientes", icon: Contact, needs: "clientes.ver" },
  { href: "/empresa/cartera", label: "Cartera", icon: UsersRound, needs: "cartera.ver_todas" },
  { href: "/empresa/reporte", label: "Reporte", icon: FileBarChart, needs: "reporte.ver" },
  { href: "/empresa/campanas", label: "Campañas", icon: Megaphone, needs: "campanas.gestionar" },
  { href: "/empresa/importar", label: "Importar", icon: Import, needs: "importar" },
  { href: "/empresa/equipo", label: "Equipo", icon: Users, needs: "usuarios.gestionar" },
  { href: "/empresa/config", label: "Configuración", icon: Settings, needs: "config.editar" },
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
  const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(false); }, [pathname]);
  const items = NAV.filter((n) => (!n.needs || capabilities.includes(n.needs)) && (!n.hides || !capabilities.includes(n.hides)));

  // Mismo estilo del menú del salón: fila con icono, barrita azul en la activa.
  const nav = (
    <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-3">
      {items.map((n) => {
        const active = n.href === "/empresa" ? pathname === "/empresa" : pathname.startsWith(n.href);
        return (
          <Link key={n.label} href={n.href}
            className={`relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${active ? "bg-brand-dark/[0.06] font-semibold text-brand-dark" : "font-medium text-brand-dark/65 hover:bg-brand-dark/[0.04] hover:text-brand-dark"}`}>
            {active && <span className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r-full bg-brand-blue" />}
            <n.icon className={`h-4 w-4 flex-shrink-0 ${active ? "text-brand-blue" : "text-brand-gray"}`} strokeWidth={1.6} />
            <span className="truncate">{n.label}</span>
          </Link>
        );
      })}
    </nav>
  );
  const logo = (
    <Link href="/empresa" className="flex items-center">
      <img src="/logo-horizontal.png" alt="re-booking" className="h-7 w-auto" />
    </Link>
  );
  const footer = (
    <div className="border-t border-gray-100 p-3">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-brand-dark">{tenantName}</p>
          <p className="text-xs text-brand-gray">{ROLE_LABEL[role]}</p>
        </div>
        <button onClick={signOut} title="Salir" aria-label="Salir" className="p-2 text-brand-gray hover:text-red-500"><LogOut className="h-4 w-4" /></button>
      </div>
    </div>
  );

  return (
    <CompanyContext.Provider value={{ role, capabilities }}>
      <div className="min-h-screen bg-brand-light lg:flex">
        {/* Celular: barra de arriba con las 3 rayitas */}
        <div className="fixed inset-x-0 top-0 z-40 flex h-14 items-center gap-3 border-b border-gray-100 bg-white px-4 lg:hidden">
          <button onClick={() => setOpen(true)} aria-label="Abrir menú" className="p-1 text-brand-dark"><Menu className="h-6 w-6" /></button>
          {logo}
          <span className="ml-auto truncate text-xs font-medium text-brand-gray">{tenantName}</span>
        </div>
        {open && <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm lg:hidden" onClick={() => setOpen(false)} />}
        <aside className={`fixed inset-y-0 left-0 z-50 flex w-64 transform flex-col bg-white shadow-xl transition-transform duration-200 lg:hidden ${open ? "translate-x-0" : "-translate-x-full"}`}>
          <div className="flex h-14 items-center justify-between border-b border-gray-100 px-4">
            {logo}
            <button onClick={() => setOpen(false)} aria-label="Cerrar menú" className="text-brand-gray hover:text-brand-dark"><X className="h-5 w-5" /></button>
          </div>
          {nav}
          {footer}
        </aside>

        {/* Computador: menú fijo a la izquierda */}
        <aside className="sticky top-0 hidden h-screen w-60 flex-shrink-0 flex-col border-r border-gray-100 bg-white lg:flex">
          <div className="flex h-14 items-center border-b border-gray-100 px-4">{logo}</div>
          <p className="truncate px-4 pb-1 pt-3 text-[13px] font-semibold tracking-tight text-brand-dark">{tenantName}</p>
          {nav}
          {footer}
        </aside>

        <main className="min-w-0 flex-1 px-4 pb-6 pt-[4.5rem] lg:px-8 lg:pt-6">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </CompanyContext.Provider>
  );
}
