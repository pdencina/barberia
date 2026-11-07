"use client";

import { useEffect, useState } from "react";
import { CalendarDays, UserPlus, TrendingUp } from "lucide-react";
import type { AgendaSummary } from "@/lib/agenda-summary";
import { formatCurrency } from "@/lib/utils";

export function DaySummary({ barberId, date, refresh }: { barberId: string; date: string; refresh: number }) {
  const [data, setData] = useState<AgendaSummary | null>(null);
  const [error, setError] = useState(false);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const update = () => setTick(t => t + 1);
    const timer = setInterval(update, 60_000);
    window.addEventListener("focus", update);
    return () => { clearInterval(timer); window.removeEventListener("focus", update); };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    if (tick === 0) setData(null);
    setError(false);
    if (!barberId) return () => controller.abort();
    fetch(`/api/barber/agenda/resumen?barberId=${encodeURIComponent(barberId)}&date=${encodeURIComponent(date)}`, { signal: controller.signal, cache: "no-store" })
      .then(async r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(result => { if (!controller.signal.aborted) setData(result); })
      .catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [barberId, date, refresh, tick]);

  return (
    <section aria-label="Resumen del día" aria-live="polite" className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-blue to-brand-accent p-3 text-white shadow-lg shadow-brand-blue/15">
      {error ? <p className="text-xs text-white/75">No se pudo cargar el resumen del día.</p> : !data ?
        <p className="text-xs text-white/75">Cargando resumen del día…</p> : <>
          <dl className="grid grid-cols-3 gap-2 text-center">
            <div><dt className="text-[11px] sm:text-xs text-white/75"><CalendarDays aria-hidden="true" className="mr-1 inline h-3 w-3 text-white/80"/>Atenciones</dt><dd className="mt-1 text-2xl font-extrabold tracking-tight text-white">{data.appointments}</dd><p className="text-[10px] sm:text-xs text-white/75">{data.completed} completadas</p></div>
            <div className="border-x border-white/20 px-1"><dt className="text-[11px] sm:text-xs text-white/75"><UserPlus aria-hidden="true" className="mr-1 inline h-3 w-3 text-white/80"/>Clientes nuevos</dt><dd className="mt-1 text-2xl font-extrabold tracking-tight text-white">{data.newClients ?? "—"}</dd><p className="text-[10px] sm:text-xs text-white/75">Primera visita</p></div>
            <div><dt className="text-[11px] sm:text-xs text-white/75"><TrendingUp aria-hidden="true" className="mr-1 inline h-3 w-3 text-white/80"/>{data.incomeBasis === "day_total" ? "Total esperado" : "Tu estimado"}</dt><dd className="mt-1 text-lg sm:text-2xl font-extrabold tracking-tight text-white break-words">{data.expectedIncome === null ? "—" : formatCurrency(data.expectedIncome)}</dd><p className="text-[10px] sm:text-xs text-white/75">{data.incomeUnavailable || (data.incomeBasis === "day_total" ? "Sin descuentos" : `${data.commissionRate}% de los servicios`)}</p><p className="mt-1 text-[10px] leading-tight text-white/80">Total de ventas actual <span className="block text-xs font-semibold text-white">{data.actualSales == null ? "—" : formatCurrency(data.actualSales)}</span></p></div>
          </dl>
          <p className="mt-2 border-t border-white/15 pt-1.5 text-[10px] sm:text-xs text-white/75 text-center">Proyección sin cancelaciones ni ausencias; no es lo cobrado.</p>
          {(data.newClients === null || data.unlinkedClients > 0) && <p className="mt-1 text-[10px] text-amber-100 text-center">{data.newClients === null ? "No se pudo verificar el historial de clientes." : `${data.unlinkedClients} cita(s) sin ficha: no se clasifican como cliente nuevo.`}</p>}
        </>}
    </section>
  );
}
