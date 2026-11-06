"use client";

import { useEffect, useState } from "react";
import { Repeat } from "lucide-react";
import { StatCard } from "@/components/ui/premium";
import { META_FRECUENCIA, META_INTERMEDIA, visitasParaMeta, type MesFrecuencia } from "@/lib/frecuencia";

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const nombreMes = (m: string) => `${MESES[Number(m.slice(5, 7)) - 1] || m} ${m.slice(2, 4)}`;
const num = (n: number) => n.toFixed(2).replace(".", ",");

// «Veces que viene cada cliente al mes»: cuadro chico como los otros del Dashboard (el promedio del mes y cómo va contra el mes anterior);
// al tocarlo se abre el detalle con la meta de 1,5 y 2, lo que falta y el historial. Solo cuenta desde el primer mes con flujo real.
export function FrecuenciaCard() {
  const [meses, setMeses] = useState<MesFrecuencia[] | null>(null);
  const [abierto, setAbierto] = useState(false);
  useEffect(() => {
    fetch("/api/dashboard/frecuencia", { cache: "no-store" }).then((r) => r.json()).then((d) => setMeses(Array.isArray(d?.meses) ? d.meses : [])).catch(() => setMeses([]));
  }, []);
  useEffect(() => {
    if (!abierto) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") setAbierto(false); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [abierto]);
  if (!meses || meses.length === 0) return null;

  const actual = meses[meses.length - 1];
  const anterior = meses.length > 1 ? meses[meses.length - 2] : null;
  const pct = Math.min(100, (actual.promedio / META_FRECUENCIA) * 100);
  const falta15 = visitasParaMeta(actual, META_INTERMEDIA);
  const falta2 = visitasParaMeta(actual, META_FRECUENCIA);
  const dif = anterior ? Math.round((actual.promedio - anterior.promedio) * 100) / 100 : null;
  const cambioPct = anterior && anterior.promedio > 0 ? Math.round(((actual.promedio - anterior.promedio) / anterior.promedio) * 100) : null;

  return (
    <>
      <div role="button" tabIndex={0} onClick={() => setAbierto(true)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setAbierto(true); } }}
        className="h-full cursor-pointer rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/40" title="Ver el detalle">
        <StatCard
          label="Veces al mes por cliente"
          value={num(actual.promedio)}
          Icon={Repeat}
          tone="teal"
          hint={`${nombreMes(actual.mes)}${actual.parcial ? " · en curso" : ""} · meta 2`}
          delta={cambioPct !== null ? { value: cambioPct, suffix: "vs mes anterior" } : undefined}
        />
      </div>

      {abierto && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={() => setAbierto(false)}>
          <div className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-brand-gray">Veces que viene cada cliente al mes</p>
                <p className="mt-0.5 text-3xl font-extrabold tabular-nums text-brand-dark">{num(actual.promedio)}</p>
                <p className="mt-0.5 text-xs text-brand-gray">
                  {actual.parcial ? `${nombreMes(actual.mes)} (mes en curso)` : nombreMes(actual.mes)} · {actual.visitas} visitas de {actual.clientes} clientes
                  {anterior && dif !== null && <> · {dif === 0 ? "igual que" : dif > 0 ? `+${num(dif)} vs` : `${num(dif)} vs`} {nombreMes(anterior.mes)} ({num(anterior.promedio)})</>}
                </p>
              </div>
              <button type="button" onClick={() => setAbierto(false)} aria-label="Cerrar" className="text-2xl leading-none text-gray-400 hover:text-gray-600">×</button>
            </div>

            <div className="mt-5">
              <div className="relative h-2.5 rounded-full bg-gray-100">
                <div className="h-full rounded-full bg-brand-blue" style={{ width: `${pct}%` }} />
                <span className="absolute top-[-3px] h-4 w-px bg-gray-400" style={{ left: `${(META_INTERMEDIA / META_FRECUENCIA) * 100}%` }} />
              </div>
              <div className="relative mt-1 h-4 text-[11px] text-brand-gray">
                <span className="absolute left-0">1</span>
                <span className="absolute -translate-x-1/2" style={{ left: `${(META_INTERMEDIA / META_FRECUENCIA) * 100}%` }}>1,5</span>
                <span className="absolute right-0">meta 2</span>
              </div>
            </div>

            <div className="mt-4 space-y-4 text-sm">
              <section>
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-brand-blue">Cómo vas</h4>
                <p className="mt-1 leading-relaxed text-brand-dark">
                  {falta2 === 0 ? "¡Meta de 2 veces al mes alcanzada!" : falta15 === 0
                    ? `Ya pasaste 1,5. Para llegar a 2 con los mismos clientes faltan ${falta2} visitas.`
                    : `Con los mismos clientes, para llegar a 1,5 faltan ${falta15} visitas y para 2 faltan ${falta2}.`}
                  {" "}{actual.volvieron} de {actual.clientes} clientes ({actual.pctVolvieron}%) vinieron 2 veces o más.
                </p>
              </section>
              {meses.length > 1 && (
                <section>
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-brand-blue">Mes a mes</h4>
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    {meses.map((m) => (
                      <span key={m.mes} className="rounded-lg bg-gray-50 px-2.5 py-1 text-[11px] text-brand-dark"><b>{nombreMes(m.mes)}</b> {num(m.promedio)}{m.parcial ? " (en curso)" : ""}</span>
                    ))}
                  </div>
                </section>
              )}
              <section>
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-brand-blue">Cómo se calcula</h4>
                <p className="mt-1 leading-relaxed text-brand-gray">
                  Visitas del mes dividido por los clientes distintos que vinieron ese mes (citas completadas con cliente). Cuenta desde que el equipo empezó a cerrar las ventas en re-booking. Una venta sin cita no suma.
                </p>
              </section>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
