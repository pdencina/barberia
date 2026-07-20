"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  DollarSign,
  ShoppingCart,
  Package,
  Users,
  Calendar,
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
} from "lucide-react";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Ingresos/Egresos", href: "/dashboard/finanzas", icon: DollarSign },
  { name: "Punto de Venta", href: "/dashboard/pos", icon: ShoppingCart },
  { name: "Inventario", href: "/dashboard/inventario", icon: Package },
  { name: "Clientes", href: "/dashboard/clientes", icon: Users },
  { name: "Agenda", href: "/dashboard/agenda", icon: Calendar },
  { name: "Boletas", href: "/dashboard/boletas", icon: Receipt },
  { name: "Cierre Mensual", href: "/dashboard/reportes", icon: BarChart3 },
  { name: "Recepcion", href: "/dashboard/recepcion", icon: Tablet },
  { name: "Pagos", href: "/dashboard/pagos", icon: CreditCard },
  { name: "Cupones", href: "/dashboard/cupones", icon: Tag },
  { name: "Barberos", href: "/dashboard/barberos", icon: Scissors },
  { name: "Config", href: "/dashboard/configuracion", icon: Settings },
];

interface SidebarProps {
  userName: string;
  userRole: string;
}

export function Sidebar({ userName, userRole }: SidebarProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

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

  const sidebarContent = (
    <>
      <div className="flex h-14 items-center justify-between px-4 border-b border-gray-800">
        <img src="/logo.png" alt="EstudioLevels" className="h-8 w-auto" />
        <button
          onClick={() => setOpen(false)}
          className="lg:hidden text-gray-400 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-3">
        <ul className="space-y-0.5">
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            return (
              <li key={item.name}>
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-red-600/10 text-red-500 border-l-2 border-red-500"
                      : "text-gray-400 hover:bg-gray-800 hover:text-white"
                  )}
                >
                  <item.icon className="h-4 w-4 flex-shrink-0" />
                  {item.name}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-gray-800 p-3">
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{userName}</p>
            <p className="text-xs text-gray-400 truncate">
              {roleLabel[userRole] || userRole}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="text-gray-400 hover:text-white p-2 rounded-md hover:bg-gray-800 transition-colors"
            aria-label="Cerrar sesion"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile header bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 h-14 bg-gray-900 flex items-center px-4 gap-3">
        <button
          onClick={() => setOpen(true)}
          className="text-white p-1"
          aria-label="Abrir menu"
        >
          <Menu className="h-6 w-6" />
        </button>
        <img src="/logo.png" alt="EstudioLevels" className="h-7 w-auto" />
      </div>

      {/* Mobile overlay */}
      {open && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-black/50"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Mobile sidebar drawer */}
      <div
        className={cn(
          "lg:hidden fixed inset-y-0 left-0 z-50 w-64 bg-gray-900 text-white flex flex-col transform transition-transform duration-200",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {sidebarContent}
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:flex h-full w-64 flex-col bg-gray-900 text-white flex-shrink-0">
        {sidebarContent}
      </div>
    </>
  );
}
