"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { AgendaPromo } from "./agenda-promo";
import { MEDIOS_DE_PAGO, SIN_CONDICIONES, errorCondiciones, textoCondiciones, type CondicionesPromo, type FormaCanje } from "@/lib/promo-condiciones";

// Condiciones opcionales de la promoción. Parte cerrado y vacío: sin elegir nada, el mensaje sale igual que siempre.
export function PromoCondicionesForm({ value, onChange, tenantId, hayCupon, inputClass }: {
  value: CondicionesPromo; onChange: (v: CondicionesPromo) => void; tenantId?: string; hayCupon: boolean; inputClass: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [pros, setPros] = useState<Array<{ id: string; name: string }>>([]);
  useEffect(() => {
    if (!abierto) return;
    fetch(`/api/barberos${tenantId ? `?tenantId=${tenantId}` : ""}`)
      .then((r) => r.json())
      .then((d) => setPros(Array.isArray(d) ? d.filter((p: any) => p.role === "barber" || p.also_attends_clients).map((p: any) => ({ id: String(p.id), name: String(p.name).trim() })) : []))
      .catch(() => setPros([]));
  }, [abierto, tenantId]);

  const set = (p: Partial<CondicionesPromo>) => onChange({ ...value, ...p });
  const alternar = (l: string[], x: string) => (l.includes(x) ? l.filter((y) => y !== x) : [...l, x]);
  const chip = (on: boolean) => `rounded-full border px-3 py-1.5 text-xs font-semibold transition ${on ? "border-brand-blue bg-brand-blue text-white" : "border-gray-200 bg-white text-brand-gray hover:border-brand-blue/50"}`;
  const etiqueta = "mb-1.5 block text-xs font-semibold text-brand-gray";
  const error = errorCondiciones(value);
  const activas = textoCondiciones(value, hayCupon) ? textoCondiciones(value, hayCupon).split("\n").length - 1 : 0;

  return (
    <div className="rounded-2xl border border-gray-200">
      <button type="button" onClick={() => setAbierto((x) => !x)} aria-expanded={abierto} className="flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left">
        <span className="text-sm font-semibold text-brand-dark">Condiciones de la promoción</span>
        <span className="flex items-center gap-2 text-xs text-brand-gray">
          {activas ? `${activas} activa${activas > 1 ? "s" : ""}` : "Opcional"}
          <ChevronDown className={`h-4 w-4 transition-transform ${abierto ? "rotate-180" : ""}`} />
        </span>
      </button>
      {abierto && (
        <div className="space-y-4 border-t border-gray-100 p-3.5">
          <div className="grid grid-cols-2 gap-3">
            <label><span className={etiqueta}>Válida desde</span><input type="date" value={value.desde} onChange={(e) => set({ desde: e.target.value })} className={inputClass} /></label>
            <label><span className={etiqueta}>Hasta</span><input type="date" value={value.hasta} onChange={(e) => set({ hasta: e.target.value })} className={inputClass} /></label>
            <label><span className={etiqueta}>Horario: entre las</span><input type="time" value={value.horaDesde} onChange={(e) => set({ horaDesde: e.target.value })} className={inputClass} /></label>
            <label><span className={etiqueta}>y las</span><input type="time" value={value.horaHasta} onChange={(e) => set({ horaHasta: e.target.value })} className={inputClass} /></label>
          </div>
          <div>
            <span className={etiqueta}>Pago válido solo con</span>
            <div className="flex flex-wrap gap-1.5">
              <button type="button" aria-pressed={value.todosLosPagos} onClick={() => set({ todosLosPagos: !value.todosLosPagos, pagos: [] })} className={chip(value.todosLosPagos)}>Todos</button>
              {MEDIOS_DE_PAGO.map((m) => (
                <button key={m} type="button" aria-pressed={value.pagos.includes(m)} onClick={() => set({ pagos: alternar(value.pagos, m), todosLosPagos: false })} className={chip(value.pagos.includes(m))}>{m}</button>
              ))}
            </div>
          </div>
          {pros.length > 0 && (
            <div>
              <span className={etiqueta}>Válida solo con estos profesionales (si no marcas ninguno, no se menciona)</span>
              <div className="flex flex-wrap gap-1.5">
                {pros.map(({ id, name: n }) => (
                  <button key={id} type="button" aria-pressed={(value.profesionalIds || []).includes(id)} onClick={() => {
                    const ids = alternar(value.profesionalIds || [], id);
                    set({ profesionalIds: ids, profesionales: pros.filter((p) => ids.includes(p.id)).map((p) => p.name) });
                  }} className={chip((value.profesionalIds || []).includes(id))}>{n}</button>
                ))}
              </div>
              <AgendaPromo value={value} tenantId={tenantId} onToggle={(id) => {
                const ids = alternar(value.profesionalIds || [], id);
                set({ profesionalIds: ids, profesionales: pros.filter((p) => ids.includes(p.id)).map((p) => p.name) });
              }} />
            </div>
          )}
          <div>
            <span className={etiqueta}>Cómo se canjea</span>
            <div className="flex flex-wrap gap-1.5">
              {([["", "No indicar"], ["agenda", "Ingresar cupón en el link de agenda"], ["recepcion", "Muestra el código en recepción"], ["online", "Pago online con código"]] as Array<[FormaCanje, string]>).map(([k, t]) => (
                <button key={k} type="button" aria-pressed={value.canje === k} onClick={() => set({ canje: k })} className={chip(value.canje === k)}>{t}</button>
              ))}
            </div>
          </div>
          {error && <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">{error}</p>}
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] text-brand-gray">Se informan en el mensaje. Las fechas, el horario y los profesionales se pueden exigir guardándolos en el cupón.</p>
            {activas > 0 && <button type="button" onClick={() => onChange(SIN_CONDICIONES)} className="flex-shrink-0 text-xs font-semibold text-brand-blue hover:underline">Borrar todas</button>}
          </div>
        </div>
      )}
    </div>
  );
}
