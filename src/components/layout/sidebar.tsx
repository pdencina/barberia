"use client";

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

  return (
    <div className="flex h-full w-64 flex-col bg-gray-900 text-white">
      <div className="flex h-16 items-center justify-center border-b border-gray-800">
        <img src="/logo.png" alt="EstudioLevels" className="h-10 w-auto" />
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            return (
              <li key={item.name}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-red-600/10 text-red-500 border-l-2 border-red-500"
                      : "text-gray-400 hover:bg-gray-800 hover:text-white"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.name}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-gray-800 p-4">
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
    </div>
  );
}
