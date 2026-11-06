"use client";

import { useEffect, useState } from "react";
import { META_FRECUENCIA, META_INTERMEDIA, visitasParaMeta, type MesFrecuencia } from "@/lib/frecuencia";

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const nombreMes = (m: string) => `${MESES[Number(m.slice(5, 7)) - 1] || m} ${m.slice(2, 4)}`;
const num = (n: number) => n.toFixed(2).replace(".", ",");

// «¿Cuántas veces al mes viene cada cliente?» Promedio de visitas por cliente en el mes, con meta 1,5 y 2.
// Solo cuenta desde el primer mes con flujo real (antes no se cerraban las ventas como ahora).
export function FrecuenciaCard() {
  const [meses, setMeses] = useState<MesFrecuencia[] | null>(null);
  useEffect(() => {
    fetch("/api/dashboard/frecuencia", { cache: "no-store" }).then((r) => r.json()).then((d) => setMeses(Array.isArray(d?.meses) ? d.meses : [])).catch(() => setMeses([]));
  }, []);
  if (!meses || meses.length === 0) return null;

  const actual = meses[meses.length - 1];
  const anterior = meses.length > 1 ? meses[meses.length - 2] : null;
  const pct = Math.min(100, (actual.promedio / META_FRECUENCIA) * 100);
  const falta15 = visitasParaMeta(actual, META_INTERMEDIA);
  const falta2 = visitasParaMeta(actual, META_FRECUENCIA);
  const dif = anterior ? Math.round((actual.promedio - anterior.promedio) * 100) / 100 : null;

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 md:p-5">
      <h3 className="flex items-center gap-2.5"><span className="h-1.5 w-1.5 rounded-full bg-brand-blue" /><span className="text-[13px] font-bold uppercase tracking-[0.12em] text-brand-dark">Veces que viene cada cliente al mes</span></h3>
      <div className="mt-3 flex flex-wrap items-end gap-x-4 gap-y-1">
        <span className="text-4xl font-bold leading-none text-brand-dark">{num(actual.promedio)}</span>
        <span className="pb-0.5 text-xs text-brand-gray">
          {actual.parcial ? `en ${nombreMes(actual.mes)} (mes en curso)` : `en ${nombreMes(actual.mes)}`} · {actual.visitas} visitas de {actual.clientes} clientes
          {anterior && dif !== null && <> · {dif === 0 ? "igual que" : dif > 0 ? `+${num(dif)} vs` : `${num(dif)} vs`} {nombreMes(anterior.mes)} ({num(anterior.promedio)})</>}
        </span>
      </div>

      {/* Barra hacia la meta de 2, con marca en 1,5 */}
      <div className="relative mt-4 h-2.5 rounded-full bg-gray-100">
        <div className="h-full rounded-full bg-brand-blue" style={{ width: `${pct}%` }} />
        <span className="absolute top-[-3px] h-4 w-px bg-gray-400" style={{ left: `${(META_INTERMEDIA / META_FRECUENCIA) * 100}%` }} />
      </div>
      <div className="relative mt-1 h-4 text-[11px] text-brand-gray">
        <span className="absolute left-0">1</span>
        <span className="absolute -translate-x-1/2" style={{ left: `${(META_INTERMEDIA / META_FRECUENCIA) * 100}%` }}>1,5</span>
        <span className="absolute right-0">meta 2</span>
      </div>

      <p className="mt-2 text-xs text-brand-dark">
        {falta2 === 0 ? "¡Meta de 2 veces al mes alcanzada!" : falta15 === 0
          ? `Ya pasaste 1,5. Para llegar a 2 con los mismos clientes faltan ${falta2} visitas.`
          : `Con los mismos clientes, para llegar a 1,5 faltan ${falta15} visitas y para 2 faltan ${falta2}.`}
        {" "}{actual.volvieron} de {actual.clientes} clientes ({actual.pctVolvieron}%) vinieron 2 veces o más.
      </p>

      {meses.length > 1 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {meses.map((m) => (
            <span key={m.mes} className="rounded-lg bg-gray-50 px-2.5 py-1 text-[11px] text-brand-dark">
              <b>{nombreMes(m.mes)}</b> {num(m.promedio)}{m.parcial ? " (en curso)" : ""}
            </span>
          ))}
        </div>
      )}
      <p className="mt-3 text-[11px] leading-relaxed text-brand-gray">
        Se cuenta solo a clientes que vinieron en el mes (citas completadas con cliente) y desde que el equipo empezó a cerrar las ventas en re-booking. Una venta sin cita no suma.
      </p>
    </div>
  );
}
