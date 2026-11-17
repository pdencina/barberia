"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { esLunes, sumarDias, diasLaborales, type Rango } from "@/lib/vacation-rules";

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const DIAS = ["L", "M", "M", "J", "V", "S", "D"];
const iso = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

// Calendario para elegir un bloque de vacaciones: primero un lunes (el inicio), despues el ultimo dia. Un solo bloque corrido:
// no se pueden marcar dias sueltos ni dejar dias libres en el medio.
export function CalendarioSolicitud({ hoy, trabaja, bloqueados, inicio, fin, onChange }: {
  hoy: string; trabaja: boolean[]; bloqueados: Rango[]; inicio: string | null; fin: string | null;
  onChange: (inicio: string | null, fin: string | null) => void;
}) {
  const [y0, m0] = hoy.split("-").map(Number);
  const [vista, setVista] = useState({ y: y0, m: m0 - 1 });
  const ocupado = (f: string) => bloqueados.some((r) => r.start_date <= f && r.end_date >= f);

  const celdas = useMemo(() => {
    const primero = new Date(Date.UTC(vista.y, vista.m, 1));
    const offset = (primero.getUTCDay() + 6) % 7; // lunes = 0
    const total = new Date(Date.UTC(vista.y, vista.m + 1, 0)).getUTCDate();
    return [...Array(offset).fill(null), ...Array.from({ length: total }, (_, i) => iso(vista.y, vista.m, i + 1))] as (string | null)[];
  }, [vista]);

  const elegir = (f: string) => {
    if (!inicio || (inicio && fin)) { // empezar de nuevo: solo un lunes futuro y libre
      if (esLunes(f) && f > hoy && !ocupado(f)) onChange(f, null);
      return;
    }
    if (f < inicio) { if (esLunes(f) && f > hoy && !ocupado(f)) onChange(f, null); return; }
    // El bloque no puede cruzar otras vacaciones: si hay una en el medio, se corta antes.
    for (let d = inicio; d <= f; d = sumarDias(d, 1)) if (ocupado(d)) return;
    onChange(inicio, f);
  };

  const dentro = (f: string) => !!inicio && f >= inicio && f <= (fin || inicio);
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-3 md:p-4">
      <div className="mb-2 flex items-center justify-between">
        <button type="button" onClick={() => setVista((v) => (v.m === 0 ? { y: v.y - 1, m: 11 } : { y: v.y, m: v.m - 1 }))} className="rounded-lg p-2 text-brand-gray hover:bg-gray-100" aria-label="Mes anterior"><ChevronLeft className="h-4 w-4" /></button>
        <p className="text-sm font-bold text-brand-dark">{MESES[vista.m]} {vista.y}</p>
        <button type="button" onClick={() => setVista((v) => (v.m === 11 ? { y: v.y + 1, m: 0 } : { y: v.y, m: v.m + 1 }))} className="rounded-lg p-2 text-brand-gray hover:bg-gray-100" aria-label="Mes siguiente"><ChevronRight className="h-4 w-4" /></button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-brand-gray">{DIAS.map((d, i) => <div key={i}>{d}</div>)}</div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {celdas.map((f, i) => {
          if (!f) return <div key={i} />;
          const dia = Number(f.slice(8, 10));
          const lunes = esLunes(f), pasado = f <= hoy, bloq = ocupado(f), libre = !trabaja[new Date(`${f}T12:00:00Z`).getUTCDay()];
          const sel = dentro(f);
          const puedeIniciar = lunes && !pasado && !bloq;
          const habilitado = !bloq && !pasado && (!inicio || !!fin ? puedeIniciar : f >= inicio || puedeIniciar);
          return (
            <button key={f} type="button" disabled={!habilitado} onClick={() => elegir(f)}
              title={bloq ? "Ya tienes vacaciones o una solicitud ese día" : pasado ? "Fecha pasada" : libre ? "Tu día libre (no descuenta)" : lunes ? "Lunes: puede ser el inicio" : undefined}
              className={`h-9 rounded-lg text-xs font-semibold transition-colors ${sel ? "bg-brand-blue text-white" : bloq ? "bg-amber-100 text-amber-700" : pasado ? "text-gray-300" : lunes && (!inicio || !!fin) ? "border border-brand-blue/50 text-brand-blue hover:bg-brand-blue/10" : libre ? "bg-gray-50 text-gray-400" : "text-brand-dark hover:bg-gray-100"} disabled:cursor-not-allowed ${!habilitado && !sel && !bloq && !pasado ? "opacity-40" : ""}`}>
              {dia}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-brand-gray">
        <span className="inline-flex items-center gap-1"><span className="inline-block h-3 w-3 rounded border border-brand-blue/50" /> Lunes (inicio)</span>
        <span className="inline-flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-brand-blue" /> Tu bloque</span>
        <span className="inline-flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-amber-100" /> Ya pedido o aprobado</span>
        <span className="inline-flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-gray-50 border border-gray-200" /> Tu día libre</span>
      </div>
      {inicio && (
        <button type="button" onClick={() => onChange(null, null)} className="mt-2 text-xs text-brand-gray underline">Borrar selección</button>
      )}
    </div>
  );
}

export const resumenBloque = (trabaja: boolean[], inicio: string | null, fin: string | null) => {
  if (!inicio) return null;
  const f = fin || inicio;
  const corridos = Math.round((Date.parse(`${f}T12:00:00Z`) - Date.parse(`${inicio}T12:00:00Z`)) / 86400000) + 1;
  return { corridos, laborales: diasLaborales(trabaja, inicio, f) };
};
