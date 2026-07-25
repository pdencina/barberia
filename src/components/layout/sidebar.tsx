"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Wallet,
  DollarSign,
  ShoppingCart,
  Package,
  Users,
  Calendar,
  CalendarCheck,
  CalendarDays,
  MapPin,
  Receipt,
  BarChart3,
  Tablet,
  CreditCard,
  Tag,
  Settings,
  LogOut,
  Scissors,
  Menu,
  X,
  Heart,
  Bell,
  Zap,
  Image,
  Star,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Caja", href: "/dashboard/caja", icon: Wallet },
  { name: "Ingresos/Egresos", href: "/dashboard/finanzas", icon: DollarSign },
  { name: "Punto de Venta", href: "/dashboard/pos", icon: ShoppingCart },
  { name: "Inventario", href: "/dashboard/inventario", icon: Package },
  { name: "Clientes", href: "/dashboard/clientes", icon: Users },
  { name: "Retencion", href: "/dashboard/retencion", icon: Heart },
  { name: "Fidelidad", href: "/dashboard/fidelidad", icon: Star },
  { name: "Mi Agenda", href: "/dashboard/mi-agenda", icon: CalendarCheck },
  { name: "Agenda", href: "/dashboard/agenda", icon: Calendar },
  { name: "Calendario", href: "/dashboard/calendario", icon: CalendarDays },
  { name: "Recordatorios", href: "/dashboard/recordatorios", icon: Bell },
  { name: "Lista Espera", href: "/dashboard/waitlist", icon: Users },
  { name: "Boletas", href: "/dashboard/boletas", icon: Receipt },
  { name: "Cierre Mensual", href: "/dashboard/reportes", icon: BarChart3 },
  { name: "Comisiones", href: "/dashboard/comisiones", icon: Zap },
  { name: "Facturas", href: "/dashboard/facturas", icon: Receipt },
  { name: "Standby", href: "/dashboard/standby", icon: Zap },
  { name: "Recepcion", href: "/dashboard/recepcion", icon: Tablet },
  { name: "Pagos", href: "/dashboard/pagos", icon: CreditCard },
  { name: "Cupones", href: "/dashboard/cupones", icon: Tag },
  { name: "Barberos", href: "/dashboard/barberos", icon: Scissors },
  { name: "Galeria", href: "/dashboard/galeria", icon: Image },
  { name: "Servicios", href: "/dashboard/servicios", icon: Tag },
  { name: "Precios", href: "/dashboard/precios", icon: Tag },
  { name: "Sucursales", href: "/dashboard/sucursales", icon: MapPin },
  { name: "Config", href: "/dashboard/configuracion", icon: Settings },
];

interface SidebarProps {
  userName: string;
  userRole: string;
}

export function Sidebar({ userName, userRole }: SidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  // Persist collapsed state
  useEffect(() => {
    const saved = localStorage.getItem("sidebar-collapsed");
    if (saved === "true") setCollapsed(true);
  }, []);

  const toggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("sidebar-collapsed", String(next));
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
    <nav className="flex-1 overflow-y-auto px-2 py-3">
      <ul className="space-y-0.5">
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          return (
            <li key={item.name}>
              <Link
                href={item.href}
                onClick={() => setMobileOpen(false)}
                title={!showLabels ? item.name : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  !showLabels && "justify-center px-2",
                  isActive
                    ? "bg-red-600/10 text-red-500 border-l-2 border-red-500"
                    : "text-gray-400 hover:bg-gray-800 hover:text-white"
                )}
              >
                <item.icon className="h-4 w-4 flex-shrink-0" />
                {showLabels && <span className="truncate">{item.name}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );

  return (
    <>
      {/* Mobile header bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 h-14 bg-gray-900 flex items-center px-4 gap-3">
        <button onClick={() => setMobileOpen(true)} className="text-white p-1" aria-label="Abrir menu">
          <Menu className="h-6 w-6" />
        </button>
        <img src="/logo.png" alt="EstudioLevels" className="h-7 w-auto" />
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/50" onClick={() => setMobileOpen(false)} />
      )}

      {/* Mobile sidebar drawer */}
      <div className={cn(
        "lg:hidden fixed inset-y-0 left-0 z-50 w-64 bg-gray-900 text-white flex flex-col transform transition-transform duration-200",
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex h-14 items-center justify-between px-4 border-b border-gray-800">
          <img src="/logo.png" alt="EstudioLevels" className="h-8 w-auto" />
          <button onClick={() => setMobileOpen(false)} className="text-gray-400 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>
        {renderNav(true)}
        <div className="border-t border-gray-800 p-3">
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{userName}</p>
              <p className="text-xs text-gray-400">{roleLabel[userRole] || userRole}</p>
            </div>
            <button onClick={handleLogout} className="text-gray-400 hover:text-white p-2" aria-label="Cerrar sesion">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className={cn(
        "hidden lg:flex h-full flex-col bg-gray-900 text-white flex-shrink-0 transition-all duration-200",
        collapsed ? "w-16" : "w-64"
      )}>
        {/* Header */}
        <div className={cn("flex h-14 items-center border-b border-gray-800", collapsed ? "justify-center px-2" : "justify-between px-4")}>
          {!collapsed && <img src="/logo.png" alt="EstudioLevels" className="h-8 w-auto" />}
          <button onClick={toggleCollapse} className="text-gray-400 hover:text-white p-1.5 rounded-md hover:bg-gray-800" title={collapsed ? "Expandir menu" : "Minimizar menu"}>
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        {/* Nav */}
        {renderNav(!collapsed)}

        {/* User */}
        <div className="border-t border-gray-800 p-3">
          {collapsed ? (
            <button onClick={handleLogout} className="w-full flex justify-center text-gray-400 hover:text-white p-2" title="Cerrar sesion">
              <LogOut className="h-4 w-4" />
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{userName}</p>
                <p className="text-xs text-gray-400 truncate">{roleLabel[userRole] || userRole}</p>
              </div>
              <button onClick={handleLogout} className="text-gray-400 hover:text-white p-2 rounded-md hover:bg-gray-800" aria-label="Cerrar sesion">
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
