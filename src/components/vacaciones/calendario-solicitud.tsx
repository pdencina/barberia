"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { esLunes, sumarDias, diasLaborales, type Rango } from "@/lib/vacation-rules";

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const iso = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const dow0 = (f: string) => new Date(`${f}T12:00:00Z`).getUTCDay();

// Calendario para elegir un bloque de vacaciones: 1) un lunes (el inicio) y 2) el ultimo dia, o con un toque «1, 2 o 3 semanas».
// Es un solo bloque corrido: no se pueden marcar dias sueltos ni dejar dias libres en el medio.
export function CalendarioSolicitud({ hoy, trabaja, bloqueados, inicio, fin, onChange }: {
  hoy: string; trabaja: boolean[]; bloqueados: Rango[]; inicio: string | null; fin: string | null;
  onChange: (inicio: string | null, fin: string | null) => void;
}) {
  const [y0, m0] = hoy.split("-").map(Number);
  const [vista, setVista] = useState({ y: y0, m: m0 - 1 });
  const ocupado = (f: string) => bloqueados.some((r) => r.start_date <= f && r.end_date >= f);
  const choca = (a: string, b: string) => { for (let d = a; d <= b; d = sumarDias(d, 1)) if (ocupado(d)) return true; return false; };

  const celdas = useMemo(() => {
    const primero = new Date(Date.UTC(vista.y, vista.m, 1));
    const offset = (primero.getUTCDay() + 6) % 7; // lunes = 0
    const total = new Date(Date.UTC(vista.y, vista.m + 1, 0)).getUTCDate();
    return [...Array(offset).fill(null), ...Array.from({ length: total }, (_, i) => iso(vista.y, vista.m, i + 1))] as (string | null)[];
  }, [vista]);

  const puedeIniciar = (f: string) => esLunes(f) && f > hoy && !ocupado(f);
  const esperandoFin = !!inicio && !fin;

  const elegir = (f: string) => {
    if (!esperandoFin) { if (puedeIniciar(f)) onChange(f, null); return; }
    if (f < inicio!) { if (puedeIniciar(f)) onChange(f, null); return; }
    if (choca(inicio!, f)) return; // el bloque no puede cruzar otras vacaciones
    onChange(inicio, f);
  };
  const semanas = (n: number) => { if (inicio && !choca(inicio, sumarDias(inicio, n * 7 - 1))) onChange(inicio, sumarDias(inicio, n * 7 - 1)); };

  return (
    <div className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
      <div className="flex items-center justify-between bg-gradient-to-r from-[#0F8B8D] to-[#0a6b6d] px-4 py-3 text-white">
        <button type="button" onClick={() => setVista((v) => (v.m === 0 ? { y: v.y - 1, m: 11 } : { y: v.y, m: v.m - 1 }))} className="rounded-full bg-white/15 p-2 hover:bg-white/25" aria-label="Mes anterior"><ChevronLeft className="h-4 w-4" /></button>
        <div className="text-center"><p className="text-lg font-bold leading-tight">{MESES[vista.m]}</p><p className="text-xs opacity-75">{vista.y}</p></div>
        <button type="button" onClick={() => setVista((v) => (v.m === 11 ? { y: v.y + 1, m: 0 } : { y: v.y, m: v.m + 1 }))} className="rounded-full bg-white/15 p-2 hover:bg-white/25" aria-label="Mes siguiente"><ChevronRight className="h-4 w-4" /></button>
      </div>

      <div className="p-3 md:p-4">
        <p className="mb-2 rounded-xl bg-brand-blue/5 px-3 py-2 text-xs text-brand-dark">
          {!inicio ? <><b>Paso 1:</b> toca el <b>lunes</b> en que empiezan las vacaciones (los lunes tienen borde de color).</> : esperandoFin ? <><b>Paso 2:</b> toca el último día, o elige cuántas semanas.</> : <>Listo. Si quieres cambiarlo, toca otro lunes.</>}
        </p>

        <div className="grid grid-cols-7 text-center text-[11px] font-semibold uppercase tracking-wide text-brand-gray">
          {DIAS.map((d, i) => <div key={d} className={`pb-1 ${i === 0 ? "text-brand-blue" : ""}`}>{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-y-1">
          {celdas.map((f, i) => {
            if (!f) return <div key={i} />;
            const dia = Number(f.slice(8, 10)), col = i % 7;
            const pasado = f <= hoy, bloq = ocupado(f), libre = !trabaja[dow0(f)];
            const fx = fin || inicio;
            const enRango = !!inicio && !!fx && f >= inicio && f <= fx;
            const esIni = f === inicio, esFin = !!fx && f === fx && !!inicio;
            const habilitado = !bloq && !pasado && (esperandoFin ? f >= inicio! || puedeIniciar(f) : puedeIniciar(f));
            const esHoy = f === hoy;
            let cls = "relative mx-auto flex h-10 w-full items-center justify-center text-sm font-semibold transition-colors ";
            if (enRango) cls += `${esIni && esFin ? "rounded-xl" : esIni ? "rounded-l-xl" : esFin ? "rounded-r-xl" : col === 0 ? "rounded-l-xl" : col === 6 ? "rounded-r-xl" : ""} ${esIni || esFin ? "bg-brand-blue text-white" : "bg-brand-blue/15 text-brand-dark"}`;
            else if (bloq) cls += "rounded-xl bg-amber-100 text-amber-700";
            else if (pasado) cls += "text-gray-300";
            else if (habilitado && col === 0 && !esperandoFin) cls += "rounded-xl border-2 border-brand-blue/60 text-brand-blue hover:bg-brand-blue/10";
            else if (habilitado) cls += "rounded-xl text-brand-dark hover:bg-brand-blue/10";
            else cls += "rounded-xl text-gray-400";
            return (
              <button key={f} type="button" disabled={!habilitado} onClick={() => elegir(f)}
                title={bloq ? "Ya tienes vacaciones o una solicitud ese día" : pasado ? "Fecha pasada" : libre ? "Es un día libre: está dentro de las vacaciones pero no se descuenta" : col === 0 ? "Lunes: puede ser el inicio" : undefined}
                className={`${cls} disabled:cursor-not-allowed`}>
                {dia}
                {libre && !pasado && <span className={`absolute bottom-0.5 h-1 w-1 rounded-full ${enRango && (esIni || esFin) ? "bg-white/80" : "bg-gray-400"}`} />}
                {esHoy && !enRango && <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-brand-blue" />}
              </button>
            );
          })}
        </div>

        {esperandoFin && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs text-brand-gray">Atajos:</span>
            {[1, 2, 3].map((n) => (
              <button key={n} type="button" onClick={() => semanas(n)} disabled={choca(inicio!, sumarDias(inicio!, n * 7 - 1))} className="rounded-full border border-brand-blue/40 px-3 py-1 text-xs font-semibold text-brand-blue hover:bg-brand-blue/10 disabled:opacity-40">
                {n} {n === 1 ? "semana" : "semanas"} · {n * 7} días
              </button>
            ))}
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-gray-50 pt-3 text-[11px] text-brand-gray">
          <span className="inline-flex items-center gap-1"><span className="inline-block h-3 w-3 rounded border-2 border-brand-blue/60" /> Lunes (inicio)</span>
          <span className="inline-flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-brand-blue" /> Inicio y fin</span>
          <span className="inline-flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-brand-blue/15" /> Días fuera</span>
          <span className="inline-flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-amber-100" /> Ya pedido o aprobado</span>
          <span className="inline-flex items-center gap-1"><span className="inline-block h-1.5 w-1.5 rounded-full bg-gray-400" /> Día libre (no descuenta)</span>
        </div>
        {inicio && <button type="button" onClick={() => onChange(null, null)} className="mt-2 text-xs text-brand-gray underline">Borrar selección</button>}
      </div>
    </div>
  );
}

// Cuantos dias esta fuera y cuantos se descuentan (solo los que trabaja).
export const resumenBloque = (trabaja: boolean[], inicio: string | null, fin: string | null) => {
  if (!inicio) return null;
  const f = fin || inicio;
  const corridos = Math.round((Date.parse(`${f}T12:00:00Z`) - Date.parse(`${inicio}T12:00:00Z`)) / 86400000) + 1;
  const laborales = diasLaborales(trabaja, inicio, f);
  return { corridos, laborales, libres: corridos - laborales };
};

// Tres cifras que explican el bloque: fuera = se descuentan + libres.
export function DesgloseDias({ corridos, laborales, compacto }: { corridos: number; laborales: number; compacto?: boolean }) {
  const libres = corridos - laborales;
  if (compacto) return <span><b>{corridos} días fuera</b> = {laborales} laborales (se descuentan) + {libres} libres</span>;
  return (
    <div className="grid grid-cols-3 overflow-hidden rounded-2xl border border-gray-100 text-center">
      <div className="bg-brand-blue/5 p-3"><p className="text-2xl font-bold text-brand-dark">{corridos}</p><p className="text-[11px] text-brand-gray">días fuera<br />(corridos)</p></div>
      <div className="bg-brand-blue p-3 text-white"><p className="text-2xl font-bold">{laborales}</p><p className="text-[11px] opacity-90">se descuentan<br />(laborales)</p></div>
      <div className="bg-gray-50 p-3"><p className="text-2xl font-bold text-brand-dark">{libres}</p><p className="text-[11px] text-brand-gray">días libres<br />(no descuentan)</p></div>
    </div>
  );
}
