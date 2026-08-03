"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Role } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Wallet, DollarSign, ShoppingCart, Package, Users,
  Calendar, CalendarCheck, CalendarDays, MapPin, Receipt, BarChart3,
  Tablet, CreditCard, Tag, Settings, LogOut, Scissors, Menu, X,
  Heart, Bell, Zap, Image, Star, ChevronLeft, ChevronRight, ChevronDown,
} from "lucide-react";

interface NavItem {
  name: string;
  href: string;
  icon: any;
  minRole: Role; // minimum role required to see this item
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const sections: NavSection[] = [
  {
    title: "Principal",
    items: [
      { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, minRole: "admin" },
      { name: "Caja", href: "/dashboard/caja", icon: Wallet, minRole: "admin" },
      { name: "Punto de Venta", href: "/dashboard/pos", icon: ShoppingCart, minRole: "admin" },
      { name: "Standby", href: "/dashboard/standby", icon: Zap, minRole: "barber" },
    ],
  },
  {
    title: "Clientes",
    items: [
      { name: "Clientes", href: "/dashboard/clientes", icon: Users, minRole: "barber" },
      { name: "Fidelidad", href: "/dashboard/fidelidad", icon: Star, minRole: "admin" },
      { name: "Retencion", href: "/dashboard/retencion", icon: Heart, minRole: "admin" },
      { name: "WhatsApp", href: "/dashboard/whatsapp", icon: Users, minRole: "admin" },
      { name: "Lista Espera", href: "/dashboard/waitlist", icon: Users, minRole: "admin" },
    ],
  },
  {
    title: "Agenda",
    items: [
      { name: "Mi Agenda", href: "/dashboard/mi-agenda", icon: CalendarCheck, minRole: "barber" },
      { name: "Agenda", href: "/dashboard/agenda", icon: Calendar, minRole: "admin" },
      { name: "Calendario", href: "/dashboard/calendario", icon: CalendarDays, minRole: "barber" },
      { name: "Recepcion", href: "/dashboard/recepcion", icon: Tablet, minRole: "admin" },
      { name: "Recordatorios", href: "/dashboard/recordatorios", icon: Bell, minRole: "admin" },
    ],
  },
  {
    title: "Finanzas",
    items: [
      { name: "Ingresos/Egresos", href: "/dashboard/finanzas", icon: DollarSign, minRole: "admin" },
      { name: "Comisiones", href: "/dashboard/comisiones", icon: Zap, minRole: "barber" },
      { name: "Arriendo", href: "/dashboard/arriendo", icon: Zap, minRole: "admin" },
      { name: "MercadoPago", href: "/dashboard/mercadopago", icon: CreditCard, minRole: "admin" },
      { name: "Cierre Mensual", href: "/dashboard/reportes", icon: BarChart3, minRole: "admin" },
      { name: "Boletas", href: "/dashboard/boletas", icon: Receipt, minRole: "admin" },
      { name: "Facturas", href: "/dashboard/facturas", icon: Receipt, minRole: "admin" },
    ],
  },
  {
    title: "Catalogo",
    items: [
      { name: "Servicios", href: "/dashboard/servicios", icon: Tag, minRole: "admin" },
      { name: "Inventario", href: "/dashboard/inventario", icon: Package, minRole: "admin" },
      { name: "Cupones", href: "/dashboard/cupones", icon: CreditCard, minRole: "admin" },
      { name: "Precios", href: "/dashboard/precios", icon: Tag, minRole: "super_admin" },
      { name: "Galeria", href: "/dashboard/galeria", icon: Image, minRole: "admin" },
    ],
  },
  {
    title: "Equipo",
    items: [
      { name: "Profesionales", href: "/dashboard/barberos", icon: Scissors, minRole: "admin" },
      { name: "Sucursales", href: "/dashboard/sucursales", icon: MapPin, minRole: "super_admin" },
      { name: "Pagos", href: "/dashboard/pagos", icon: CreditCard, minRole: "super_admin" },
      { name: "Config", href: "/dashboard/configuracion", icon: Settings, minRole: "super_admin" },
    ],
  },
  {
    title: "Super Admin",
    items: [
      { name: "Empresas", href: "/dashboard/superadmin/tenants", icon: Users, minRole: "super_admin" },
      { name: "Auditoria", href: "/dashboard/superadmin/audit", icon: Receipt, minRole: "super_admin" },
      { name: "Horarios", href: "/dashboard/configuracion/horarios", icon: Calendar, minRole: "super_admin" },
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
  const { isAtLeast, loading: authLoading, role: userAuthRole } = useAuth();

  // Filter sections based on role
  // While auth is loading, show minimal items to avoid flash
  const filteredSections = authLoading
    ? sections.map((s) => ({ ...s, items: s.items.slice(0, 1) })).slice(0, 2)
    : sections
        .map((section) => ({
          ...section,
          items: section.items.filter((item) => isAtLeast(item.minRole)),
        }))
        .filter((section) => section.items.length > 0);

  useEffect(() => {
    const saved = localStorage.getItem("sidebar-collapsed");
    if (saved === "true") setCollapsed(true);
    // Open section that contains active route
    const active = filteredSections.find((s) => s.items.some((i) => i.href === pathname));
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
    super_admin: "Super Admin",
    admin: "Administrador",
    barber: "Profesional",
    receptionist: "Recepcionista",
  };

  const renderNav = (showLabels: boolean) => (
    <nav className="flex-1 overflow-y-auto px-3 py-4">
      {filteredSections.map((section) => {
        const isOpen = openSections[section.title] !== false;
        const hasActive = section.items.some((i) => i.href === pathname);

        return (
          <div key={section.title} className="mb-2">
            {showLabels && (
              <button
                onClick={() => toggleSection(section.title)}
                className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] uppercase tracking-wider text-brand-gray font-semibold"
              >
                <span>{section.title}</span>
                <ChevronDown className={cn("h-3 w-3 transition-transform text-brand-gray", !isOpen && "-rotate-90")} />
              </button>
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
                          "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all",
                          !showLabels && "justify-center px-2",
                          isActive
                            ? "bg-brand-blue/10 text-brand-blue"
                            : "text-brand-dark/70 hover:bg-brand-light hover:text-brand-dark"
                        )}
                      >
                        <item.icon className={cn("h-[18px] w-[18px] flex-shrink-0", isActive ? "text-brand-blue" : "text-brand-gray")} strokeWidth={1.5} />
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
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 h-14 bg-white border-b border-gray-100 flex items-center px-4 gap-3">
        <button onClick={() => setMobileOpen(true)} className="text-brand-dark p-1"><Menu className="h-6 w-6" /></button>
        <img src="/logo.png" alt="re-booking" className="h-7 w-auto" />
      </div>

      {/* Mobile overlay */}
      {mobileOpen && <div className="lg:hidden fixed inset-0 z-50 bg-black/30 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />}

      {/* Mobile drawer */}
      <div className={cn(
        "lg:hidden fixed inset-y-0 left-0 z-50 w-64 bg-white flex flex-col transform transition-transform duration-200 shadow-xl",
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex h-14 items-center justify-between px-4 border-b border-gray-100">
          <img src="/logo.png" alt="re-booking" className="h-8 w-auto" />
          <button onClick={() => setMobileOpen(false)} className="text-brand-gray hover:text-brand-dark"><X className="h-5 w-5" /></button>
        </div>
        {renderNav(true)}
        <div className="border-t border-gray-100 p-3">
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-brand-dark truncate">{userName}</p>
              <p className="text-xs text-brand-gray">{roleLabel[userRole] || userRole}</p>
            </div>
            <button onClick={handleLogout} className="text-brand-gray hover:text-red-500 p-2"><LogOut className="h-4 w-4" /></button>
          </div>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className={cn(
        "hidden lg:flex h-full flex-col bg-white border-r border-gray-100 flex-shrink-0 transition-all duration-200",
        collapsed ? "w-16" : "w-60"
      )}>
        <div className={cn("flex h-14 items-center border-b border-gray-100", collapsed ? "justify-center" : "justify-between px-4")}>
          {!collapsed && <img src="/logo.png" alt="re-booking" className="h-7 w-auto" />}
          <button onClick={toggleCollapse} className="text-brand-gray hover:text-brand-dark p-1 rounded-lg hover:bg-brand-light">
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        {/* Search hint */}
        {!collapsed && (
          <button
            onClick={() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }))}
            className="mx-3 mt-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-brand-light hover:bg-gray-100 transition-colors text-brand-gray"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span className="text-xs flex-1 text-left">Buscar...</span>
            <kbd className="text-[9px] bg-white border border-gray-200 px-1.5 py-0.5 rounded font-mono text-brand-gray">⌘K</kbd>
          </button>
        )}
        {renderNav(!collapsed)}
        <div className="border-t border-gray-100 p-3">
          {collapsed ? (
            <button onClick={handleLogout} className="w-full flex justify-center text-brand-gray hover:text-red-500 p-2" title="Cerrar sesion">
              <LogOut className="h-4 w-4" />
            </button>
          ) : (
            <div className="flex items-center gap-2 px-2">
              <div className="w-8 h-8 rounded-full bg-brand-blue/10 flex items-center justify-center text-[10px] font-bold text-brand-blue">
                {userName.split(" ").map((n) => n[0]).join("").slice(0, 2)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-brand-dark truncate">{userName}</p>
                <p className="text-[10px] text-brand-gray">{roleLabel[userRole] || userRole}</p>
              </div>
              <button onClick={handleLogout} className="text-brand-gray hover:text-red-500 p-1"><LogOut className="h-3.5 w-3.5" /></button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
