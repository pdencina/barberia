"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

interface CommandItem {
  name: string;
  href: string;
  icon: string;
  keywords: string;
}

const commands: CommandItem[] = [
  { name: "Dashboard", href: "/dashboard", icon: "📊", keywords: "inicio home resumen" },
  { name: "Punto de Venta", href: "/dashboard/pos", icon: "🛒", keywords: "venta cobrar pos pago" },
  { name: "Caja Diaria", href: "/dashboard/caja", icon: "💰", keywords: "caja apertura cierre efectivo" },
  { name: "Clientes", href: "/dashboard/clientes", icon: "👥", keywords: "cliente buscar persona" },
  { name: "Agenda", href: "/dashboard/agenda", icon: "📅", keywords: "cita agendar hora reserva" },
  { name: "Calendario", href: "/dashboard/calendario", icon: "🗓️", keywords: "calendario semana dia" },
  { name: "Mi Agenda", href: "/dashboard/mi-agenda", icon: "📋", keywords: "mi agenda barbero personal" },
  { name: "Inventario", href: "/dashboard/inventario", icon: "📦", keywords: "producto stock inventario" },
  { name: "Ingresos/Egresos", href: "/dashboard/finanzas", icon: "💵", keywords: "finanzas ingreso egreso gasto" },
  { name: "Comisiones", href: "/dashboard/comisiones", icon: "⚡", keywords: "comision barbero pago porcentaje" },
  { name: "Cierre Mensual", href: "/dashboard/reportes", icon: "📈", keywords: "reporte cierre mes mensual" },
  { name: "Recepcion", href: "/dashboard/recepcion", icon: "📺", keywords: "recepcion tv tablet" },
  { name: "Fidelidad", href: "/dashboard/fidelidad", icon: "⭐", keywords: "puntos fidelidad lealtad" },
  { name: "Retencion", href: "/dashboard/retencion", icon: "❤️", keywords: "retencion inactivo whatsapp" },
  { name: "Cupones", href: "/dashboard/cupones", icon: "🏷️", keywords: "cupon descuento codigo" },
  { name: "Servicios", href: "/dashboard/servicios", icon: "✂️", keywords: "servicio corte precio" },
  { name: "Barberos", href: "/dashboard/barberos", icon: "💈", keywords: "barbero equipo profesional" },
  { name: "Galeria", href: "/dashboard/galeria", icon: "🖼️", keywords: "foto galeria trabajo" },
  { name: "Boletas", href: "/dashboard/boletas", icon: "🧾", keywords: "boleta email enviar" },
  { name: "Recordatorios", href: "/dashboard/recordatorios", icon: "🔔", keywords: "recordatorio notificacion" },
  { name: "Lista de Espera", href: "/dashboard/waitlist", icon: "⏳", keywords: "espera waitlist" },
  { name: "Standby", href: "/dashboard/standby", icon: "⚡", keywords: "standby rapido barbero" },
  { name: "Facturas", href: "/dashboard/facturas", icon: "📄", keywords: "factura documento" },
  { name: "Precios", href: "/dashboard/precios", icon: "💲", keywords: "precio historial cambio" },
  { name: "Configuracion", href: "/dashboard/configuracion", icon: "⚙️", keywords: "config setting" },
  { name: "Booking (publico)", href: "/booking", icon: "🌐", keywords: "booking publico agendar" },
  { name: "Ranking", href: "/ranking", icon: "🏆", keywords: "ranking review estrella" },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
      setQuery("");
    }
  }, [open]);

  const filtered = query
    ? commands.filter(
        (c) =>
          c.name.toLowerCase().includes(query.toLowerCase()) ||
          c.keywords.includes(query.toLowerCase())
      )
    : commands.slice(0, 8);

  const navigate = (href: string) => {
    router.push(href);
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[20vh]" onClick={() => setOpen(false)}>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar pagina, modulo o accion..."
            className="flex-1 text-sm bg-transparent outline-none placeholder:text-gray-400"
          />
          <kbd className="hidden md:inline-flex items-center gap-0.5 px-2 py-0.5 text-[10px] text-gray-400 bg-gray-100 rounded-md font-mono">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p className="text-center py-8 text-sm text-gray-400">No se encontraron resultados</p>
          ) : (
            filtered.map((item) => (
              <button
                key={item.href}
                onClick={() => navigate(item.href)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-gray-50 transition-colors group"
              >
                <span className="text-lg w-8 text-center">{item.icon}</span>
                <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">{item.name}</span>
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 px-4 py-2 flex items-center justify-between text-[10px] text-gray-400">
          <span>Navegar con ↑↓ · Enter para ir</span>
          <span className="hidden md:inline">Ctrl+K para abrir</span>
        </div>
      </div>
    </div>
  );
}
