"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Wallet, DollarSign, ShoppingCart, Package, Users,
  Calendar, CalendarCheck, CalendarDays, MapPin, Receipt, BarChart3,
  Tablet, CreditCard, Tag, Settings, LogOut, Scissors, Menu, X,
  Heart, Bell, Zap, Image, Star, ChevronLeft, ChevronRight, ChevronDown,
} from "lucide-react";

interface NavSection {
  title: string;
  items: Array<{ name: string; href: string; icon: any }>;
}

const sections: NavSection[] = [
  {
    title: "Principal",
    items: [
      { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { name: "Caja", href: "/dashboard/caja", icon: Wallet },
      { name: "Punto de Venta", href: "/dashboard/pos", icon: ShoppingCart },
      { name: "Standby", href: "/dashboard/standby", icon: Zap },
    ],
  },
  {
    title: "Clientes",
    items: [
      { name: "Clientes", href: "/dashboard/clientes", icon: Users },
      { name: "Fidelidad", href: "/dashboard/fidelidad", icon: Star },
      { name: "Retencion", href: "/dashboard/retencion", icon: Heart },
      { name: "Lista Espera", href: "/dashboard/waitlist", icon: Users },
    ],
  },
  {
    title: "Agenda",
    items: [
      { name: "Mi Agenda", href: "/dashboard/mi-agenda", icon: CalendarCheck },
      { name: "Agenda", href: "/dashboard/agenda", icon: Calendar },
      { name: "Calendario", href: "/dashboard/calendario", icon: CalendarDays },
      { name: "Recepcion", href: "/dashboard/recepcion", icon: Tablet },
      { name: "Recordatorios", href: "/dashboard/recordatorios", icon: Bell },
    ],
  },
  {
    title: "Finanzas",
    items: [
      { name: "Ingresos/Egresos", href: "/dashboard/finanzas", icon: DollarSign },
      { name: "Comisiones", href: "/dashboard/comisiones", icon: Zap },
      { name: "Cierre Mensual", href: "/dashboard/reportes", icon: BarChart3 },
      { name: "Boletas", href: "/dashboard/boletas", icon: Receipt },
      { name: "Facturas", href: "/dashboard/facturas", icon: Receipt },
    ],
  },
  {
    title: "Catalogo",
    items: [
      { name: "Servicios", href: "/dashboard/servicios", icon: Tag },
      { name: "Inventario", href: "/dashboard/inventario", icon: Package },
      { name: "Cupones", href: "/dashboard/cupones", icon: CreditCard },
      { name: "Precios", href: "/dashboard/precios", icon: Tag },
      { name: "Galeria", href: "/dashboard/galeria", icon: Image },
    ],
  },
  {
    title: "Equipo",
    items: [
      { name: "Barberos", href: "/dashboard/barberos", icon: Scissors },
      { name: "Sucursales", href: "/dashboard/sucursales", icon: MapPin },
      { name: "Pagos", href: "/dashboard/pagos", icon: CreditCard },
      { name: "Config", href: "/dashboard/configuracion", icon: Settings },
    ],
  },
];

interface SidebarProps {
  userName: string;
  userRole: string;
}

export function Sidebar({ userName, userRole }: SidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const saved = localStorage.getItem("sidebar-collapsed");
    if (saved === "true") setCollapsed(true);
    // Open section that contains active route
    const active = sections.find((s) => s.items.some((i) => i.href === pathname));
    if (active) setOpenSections((prev) => ({ ...prev, [active.title]: true }));
  }, []);

  const toggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("sidebar-collapsed", String(next));
  };

  const toggleSection = (title: string) => {
    setOpenSections((prev) => ({ ...prev, [title]: !prev[title] }));
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const roleLabel: Record<string, string> = {
    admin: "Administrador",
    barber: "Barbero",
    receptionist: "Recepcionista",
  };

  const renderNav = (showLabels: boolean) => (
    <nav className="flex-1 overflow-y-auto px-2 py-2">
      {sections.map((section) => {
        const isOpen = openSections[section.title] !== false; // default open
        const hasActive = section.items.some((i) => i.href === pathname);

        return (
          <div key={section.title} className="mb-1">
            {showLabels ? (
              <button
                onClick={() => toggleSection(section.title)}
                className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] uppercase tracking-wider text-gray-500 hover:text-gray-300 font-medium"
              >
                <span>{section.title}</span>
                <ChevronDown className={cn("h-3 w-3 transition-transform", !isOpen && "-rotate-90")} />
              </button>
            ) : (
              <div className="h-px bg-gray-800 mx-2 my-2" />
            )}

            {(isOpen || !showLabels) && (
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setMobileOpen(false)}
                        title={!showLabels ? item.name : undefined}
                        className={cn(
                          "flex items-center gap-2.5 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors",
                          !showLabels && "justify-center px-2",
                          isActive
                            ? "bg-red-600/10 text-red-400 border-l-2 border-red-500 pl-[10px]"
                            : "text-gray-400 hover:bg-gray-800/50 hover:text-gray-200"
                        )}
                      >
                        <item.icon className="h-3.5 w-3.5 flex-shrink-0" />
                        {showLabels && <span className="truncate">{item.name}</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 h-14 bg-gray-900 flex items-center px-4 gap-3">
        <button onClick={() => setMobileOpen(true)} className="text-white p-1"><Menu className="h-6 w-6" /></button>
        <img src="/logo.png" alt="EstudioLevels" className="h-7 w-auto" />
      </div>

      {/* Mobile overlay */}
      {mobileOpen && <div className="lg:hidden fixed inset-0 z-50 bg-black/50" onClick={() => setMobileOpen(false)} />}

      {/* Mobile drawer */}
      <div className={cn(
        "lg:hidden fixed inset-y-0 left-0 z-50 w-64 bg-gray-900 text-white flex flex-col transform transition-transform duration-200",
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex h-14 items-center justify-between px-4 border-b border-gray-800">
          <img src="/logo.png" alt="EstudioLevels" className="h-8 w-auto" />
          <button onClick={() => setMobileOpen(false)} className="text-gray-400 hover:text-white"><X className="h-5 w-5" /></button>
        </div>
        {renderNav(true)}
        <div className="border-t border-gray-800 p-3">
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{userName}</p>
              <p className="text-xs text-gray-400">{roleLabel[userRole] || userRole}</p>
            </div>
            <button onClick={handleLogout} className="text-gray-400 hover:text-white p-2"><LogOut className="h-4 w-4" /></button>
          </div>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className={cn(
        "hidden lg:flex h-full flex-col bg-gray-900 text-white flex-shrink-0 transition-all duration-200",
        collapsed ? "w-14" : "w-56"
      )}>
        <div className={cn("flex h-12 items-center border-b border-gray-800", collapsed ? "justify-center" : "justify-between px-3")}>
          {!collapsed && <img src="/logo.png" alt="EstudioLevels" className="h-7 w-auto" />}
          <button onClick={toggleCollapse} className="text-gray-500 hover:text-white p-1 rounded hover:bg-gray-800">
            {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
          </button>
        </div>

        {/* Search hint */}
        {!collapsed && (
          <button
            onClick={() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }))}
            className="mx-2 mt-2 flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-800/50 hover:bg-gray-800 transition-colors text-gray-500 hover:text-gray-300"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span className="text-xs flex-1">Buscar...</span>
            <kbd className="text-[9px] bg-gray-700 px-1.5 py-0.5 rounded font-mono">⌘K</kbd>
          </button>
        )}
        {renderNav(!collapsed)}
        <div className="border-t border-gray-800 p-2">
          {collapsed ? (
            <button onClick={handleLogout} className="w-full flex justify-center text-gray-400 hover:text-white p-2" title="Cerrar sesion">
              <LogOut className="h-4 w-4" />
            </button>
          ) : (
            <div className="flex items-center gap-2 px-2">
              <div className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center text-[10px] font-bold text-gray-300">
                {userName.split(" ").map((n) => n[0]).join("").slice(0, 2)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{userName}</p>
                <p className="text-[10px] text-gray-500">{roleLabel[userRole] || userRole}</p>
              </div>
              <button onClick={handleLogout} className="text-gray-500 hover:text-white p-1"><LogOut className="h-3.5 w-3.5" /></button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
