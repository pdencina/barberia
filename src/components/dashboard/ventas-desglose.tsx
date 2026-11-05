"use client";

import { formatCurrency } from "@/lib/utils";
import { Panel } from "@/components/ui/premium";

export interface VentaProfesional { id: string; name: string; total: number; ventas: number }
export interface VentaMedio { medio: string; nombre: string; total: number }

// Colores de la paleta de re-booking (azul de marca y sus vecinos), sin amarillos ni rojos.
const COLORES = ["hsl(var(--brand-blue))", "#10b981", "#8b5cf6", "#38bdf8", "#94a3b8", "#14b8a6"];

export function VentasPorProfesional({ data, total }: { data: VentaProfesional[]; total?: number }) {
  const max = Math.max(...data.map((d) => d.total), 1);
  const suma = total || data.reduce((s, d) => s + d.total, 0) || 1;
  return (
    <Panel title="Ventas por profesional" subtitle="Del período del gráfico">
      <div className="space-y-3.5 px-4 pb-4 md:px-5 md:pb-5">
        {data.map((p, i) => (
          <div key={p.id}>
            <div className="mb-1 flex items-baseline justify-between gap-3">
              <span className="truncate text-sm font-medium text-brand-dark">{p.name}</span>
              <span className="flex-shrink-0 text-sm font-bold tabular-nums text-brand-dark">{formatCurrency(p.total)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
              <div className={`h-full rounded-full ${i === 0 ? "bg-gradient-to-r from-brand-blue to-emerald-500" : "bg-brand-blue/60"} transition-all duration-700`} style={{ width: `${Math.max((p.total / max) * 100, 3)}%` }} />
            </div>
            <p className="mt-0.5 text-[11px] text-brand-gray tabular-nums">{p.ventas} {p.ventas === 1 ? "venta" : "ventas"} · {Math.round((p.total / suma) * 100)}%</p>
          </div>
        ))}
      </div>
    </Panel>
  );
}

export function MediosDePago({ data }: { data: VentaMedio[] }) {
  const suma = data.reduce((s, d) => s + d.total, 0) || 1;
  const R = 52, C = 2 * Math.PI * R;
  let acumulado = 0;
  return (
    <Panel title="Medios de pago" subtitle="Del período del gráfico">
      <div className="flex flex-col items-center gap-4 px-4 pb-4 sm:flex-row md:px-5 md:pb-5">
        <svg viewBox="0 0 140 140" className="h-36 w-36 flex-shrink-0 -rotate-90" role="img" aria-label="Reparto de ventas por medio de pago">
          <circle cx="70" cy="70" r={R} fill="none" stroke="currentColor" className="text-brand-gray" strokeOpacity={0.1} strokeWidth="16" />
          {data.map((d, i) => {
            const largo = (d.total / suma) * C;
            const el = (
              <circle key={d.medio} cx="70" cy="70" r={R} fill="none" stroke={COLORES[i % COLORES.length]} strokeWidth="16"
                strokeDasharray={`${Math.max(largo - 1.5, 0.5)} ${C}`} strokeDashoffset={-acumulado} />
            );
            acumulado += largo;
            return el;
          })}
        </svg>
        <ul className="w-full min-w-0 flex-1 space-y-2">
          {data.map((d, i) => (
            <li key={d.medio} className="flex items-center gap-2.5 text-sm">
              <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ background: COLORES[i % COLORES.length] }} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-brand-dark">{d.nombre}</p>
                <p className="text-[11px] tabular-nums text-brand-gray">{formatCurrency(d.total)}</p>
              </div>
              <span className="flex-shrink-0 text-sm font-bold tabular-nums text-brand-dark">{Math.round((d.total / suma) * 100)}%</span>
            </li>
          ))}
        </ul>
      </div>
    </Panel>
  );
}
