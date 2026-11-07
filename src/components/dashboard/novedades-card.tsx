"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import type { Novedad, TipoNovedad } from "@/lib/novedades";
import { useTenant } from "@/lib/tenant-context";

const CLAVE = "dashboard_novedades_ocultas";
const leer = (): string[] => { try { const v = JSON.parse(localStorage.getItem(CLAVE) || "[]"); return Array.isArray(v) ? v : []; } catch { return []; } };

const ESTILO: Record<TipoNovedad, { barra: string; etiqueta: string; texto: string }> = {
  bien: { barra: "bg-emerald-500", etiqueta: "Funcionó", texto: "text-emerald-700" },
  mal: { barra: "bg-red-400", etiqueta: "Empeoró", texto: "text-red-500" },
  alerta: { barra: "bg-brand-blue", etiqueta: "Atención", texto: "text-brand-blue" },
};

// Novedades de la semana: qué funcionó, qué empeoró y alertas. Si no hay nada que decir, no se muestra el bloque.
// Cada aviso se puede quitar; vuelve a salir la semana siguiente si sigue pasando (se recuerda solo en este navegador).
export function NovedadesCard() {
  const { tenant } = useTenant();
  const [datos, setDatos] = useState<{ semana: string; novedades: Novedad[] } | null>(null);
  const [ocultas, setOcultas] = useState<string[]>([]);

  useEffect(() => {
    setOcultas(leer());
    fetch(`/api/dashboard/novedades${tenant?.id ? `?tenantId=${tenant.id}` : ""}`, { cache: "no-store" }).then((r) => r.json()).then((d) => setDatos(d && Array.isArray(d.novedades) ? d : null)).catch(() => setDatos(null));
  }, []);

  const visibles = useMemo(() => (datos ? datos.novedades.filter((n) => !ocultas.includes(`${n.id}|${datos.semana}`)) : []), [datos, ocultas]);
  if (!datos || visibles.length === 0) return null;

  const quitar = (n: Novedad) => {
    const siguiente = [...ocultas, `${n.id}|${datos.semana}`].slice(-200);
    setOcultas(siguiente);
    try { localStorage.setItem(CLAVE, JSON.stringify(siguiente)); } catch { /* sin almacenamiento: solo dura esta visita */ }
  };

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 md:p-5">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="flex items-center gap-2.5"><span className="h-1.5 w-1.5 rounded-full bg-brand-blue" /><span className="text-[13px] font-bold uppercase tracking-[0.12em] text-brand-dark">Novedades de la semana</span></h3>
        <span className="text-[11px] text-brand-gray">Últimos 7 días vs los 7 anteriores</span>
      </div>
      <ul className="mt-3 space-y-2.5">
        {visibles.map((n) => {
          const e = ESTILO[n.tipo];
          return (
            <li key={n.id} className="flex gap-3 rounded-xl border border-gray-100 p-3">
              <span className={`mt-0.5 w-1 flex-shrink-0 self-stretch rounded-full ${e.barra}`} />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2"><span className={`text-[10px] font-bold uppercase tracking-wider ${e.texto}`}>{e.etiqueta}</span><span className="text-sm font-semibold text-brand-dark">{n.titulo}</span></p>
                <p className="mt-0.5 text-[13px] leading-relaxed text-brand-gray">{n.texto}</p>
                {n.enlace && <Link href={n.enlace.href} className="mt-1 inline-block text-xs font-semibold text-brand-blue hover:underline">{n.enlace.label} →</Link>}
              </div>
              <button type="button" onClick={() => quitar(n)} aria-label={`Quitar: ${n.titulo}`} title="Quitar este aviso (vuelve a salir la próxima semana si sigue pasando)" className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-brand-gray hover:bg-brand-light hover:text-brand-dark"><X className="h-3.5 w-3.5" /></button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
