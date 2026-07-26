"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function QuickActions() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const actions = [
    { label: "Nueva Venta", href: "/dashboard/pos", icon: "🛒", color: "bg-green-500" },
    { label: "Agendar Cita", href: "/dashboard/agenda", icon: "📅", color: "bg-blue-500" },
    { label: "Nuevo Cliente", href: "/dashboard/clientes", icon: "👤", color: "bg-purple-500" },
    { label: "Abrir Caja", href: "/dashboard/caja", icon: "💰", color: "bg-yellow-500" },
  ];

  return (
    <div className="fixed bottom-6 right-6 z-50 lg:hidden">
      {/* Action buttons */}
      {open && (
        <div className="absolute bottom-16 right-0 space-y-2 animate-fade-in">
          {actions.map((action) => (
            <button
              key={action.label}
              onClick={() => { router.push(action.href); setOpen(false); }}
              className="flex items-center gap-2 px-4 py-2.5 bg-white rounded-xl shadow-lg border border-gray-100 whitespace-nowrap active:scale-95 transition-transform"
            >
              <span className={`w-7 h-7 rounded-lg ${action.color} flex items-center justify-center text-sm`}>
                {action.icon}
              </span>
              <span className="text-sm font-medium text-gray-700">{action.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* FAB button */}
      <button
        onClick={() => setOpen(!open)}
        className={`w-14 h-14 rounded-2xl shadow-lg flex items-center justify-center transition-all active:scale-90 ${
          open ? "bg-gray-900 rotate-45" : "bg-red-600 shadow-red-600/30"
        }`}
      >
        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
        </svg>
      </button>
    </div>
  );
}
