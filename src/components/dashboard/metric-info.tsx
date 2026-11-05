"use client";

import Link from "next/link";
import { useEffect } from "react";
import type { Consejo, ResumenCancelaciones } from "@/lib/cancel-reasons";

export interface InfoMetrica {
  titulo: string;
  valor: string;
  que: string;      // qué es, en palabras simples
  calculo: string;  // cómo se calcula
  consejos: Consejo[];
  cancel?: ResumenCancelaciones; // solo en Cancelaciones: quién y por qué
}

const Barra = ({ n, max, texto }: { n: number; max: number; texto: string }) => (
  <div>
    <div className="mb-1 flex justify-between gap-3 text-sm"><span className="text-brand-dark">{texto}</span><b className="tabular-nums text-brand-dark">{n}</b></div>
    <div className="h-1.5 overflow-hidden rounded-full bg-black/5"><div className="h-full rounded-full bg-brand-blue/70" style={{ width: `${Math.max((n / Math.max(max, 1)) * 100, 6)}%` }} /></div>
  </div>
);

// Explicación de una tarjeta del Dashboard: qué mide, cómo se calcula y cómo mejorarla (con el detalle real cuando existe).
export function MetricInfo({ info, onClose }: { info: InfoMetrica | null; onClose: () => void }) {
  useEffect(() => {
    if (!info) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [info, onClose]);
  if (!info) return null;
  const c = info.cancel;
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-gray">{info.titulo}</p>
            <p className="mt-0.5 text-3xl font-extrabold tabular-nums text-brand-dark">{info.valor}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="text-2xl leading-none text-gray-400 hover:text-gray-600">×</button>
        </div>

        <div className="mt-4 space-y-4 text-sm">
          <section>
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-brand-blue">Qué significa</h4>
            <p className="mt-1 leading-relaxed text-brand-dark">{info.que}</p>
          </section>
          <section>
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-brand-blue">Cómo se calcula</h4>
            <p className="mt-1 leading-relaxed text-brand-gray">{info.calculo}</p>
          </section>

          {c && c.total > 0 && (
            <section className="space-y-3 rounded-2xl bg-brand-light/70 p-3.5">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-brand-blue">Qué pasó hoy</h4>
              {c.noLlegaron > 0 && <Barra n={c.noLlegaron} max={c.total} texto="Clientes que no llegaron" />}
              {c.canceladas > 0 && (
                <>
                  <p className="text-xs font-semibold text-brand-gray">Quién canceló</p>
                  {c.porQuien.map((q) => <Barra key={q.quien} n={q.n} max={c.canceladas} texto={q.nombre} />)}
                  <p className="pt-1 text-xs font-semibold text-brand-gray">Motivo</p>
                  {c.motivos.map((m) => <Barra key={m.motivo} n={m.n} max={c.canceladas} texto={m.nombre} />)}
                  {c.sinRegistro > 0 && <p className="text-[11px] text-brand-gray">«Sin motivo registrado» son citas canceladas antes de que se guardara el motivo.</p>}
                </>
              )}
            </section>
          )}

          <section>
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-brand-blue">Cómo mejorarlo</h4>
            <ul className="mt-1.5 space-y-2.5">
              {info.consejos.map((k) => (
                <li key={k.titulo} className="rounded-2xl border border-gray-100 p-3">
                  <p className="font-semibold text-brand-dark">{k.titulo}</p>
                  <p className="mt-0.5 leading-relaxed text-brand-gray">{k.texto}</p>
                  {k.enlace && <Link href={k.enlace.href} onClick={onClose} className="mt-1.5 inline-block text-xs font-semibold text-brand-blue hover:underline">{k.enlace.label} →</Link>}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
