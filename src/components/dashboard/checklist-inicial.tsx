"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, AlertTriangle, ChevronDown, X } from "lucide-react";
import { avance, type PasoConfig } from "@/lib/configuracion-inicial";

const KEY = "rb_checklist_manual";
const OCULTO = "rb_checklist_oculto";
const leer = (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } };
const guardar = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } };

// Tarjeta «Deja tu negocio listo»: guia de configuracion con los errores que mas se repiten. Se oculta sola cuando lo esencial esta listo.
export function ChecklistInicial() {
  const [pasos, setPasos] = useState<PasoConfig[] | null>(null);
  const [manuales, setManuales] = useState<string[]>([]);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [oculto, setOculto] = useState(false);

  useEffect(() => {
    try { setManuales(JSON.parse(leer(KEY) || "[]")); } catch { /* vacio */ }
    setOculto(leer(OCULTO) === "1");
    fetch("/api/configuracion/checklist").then((r) => (r.ok ? r.json() : null)).then((j) => j?.pasos && setPasos(j.pasos)).catch(() => {});
  }, []);

  if (!pasos || oculto) return null;
  const av = avance(pasos, manuales);
  if (av.porcentaje === 100) return null;
  const hayProblema = pasos.some((p) => p.problema);
  if (av.esencialesPendientes.length === 0 && !hayProblema && av.porcentaje >= 80) return null;

  const marcar = (id: string) => {
    const n = manuales.includes(id) ? manuales.filter((x) => x !== id) : [...manuales, id];
    setManuales(n); guardar(KEY, JSON.stringify(n));
  };
  const estaHecho = (p: PasoConfig) => p.hecho || (!!p.manual && manuales.includes(p.id));

  return (
    <div className="mb-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Deja tu negocio listo para recibir reservas</h2>
          <p className="text-sm text-gray-500">{av.hechos} de {av.total} pasos · revisa lo que más se olvida</p>
        </div>
        <button onClick={() => { setOculto(true); guardar(OCULTO, "1"); }} aria-label="Ocultar" className="text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${av.porcentaje}%` }} /></div>
      <ul className="mt-3 divide-y divide-gray-100">
        {pasos.map((p) => {
          const hecho = estaHecho(p);
          return (
            <li key={p.id} className="py-2">
              <div className="flex items-center gap-2">
                {p.manual ? (
                  <button onClick={() => marcar(p.id)} aria-label="Marcar" className="shrink-0">{hecho ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <Circle className="h-5 w-5 text-gray-300" />}</button>
                ) : p.problema ? <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" /> : hecho ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" /> : <Circle className="h-5 w-5 shrink-0 text-gray-300" />}
                <button onClick={() => setAbierto(abierto === p.id ? null : p.id)} className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left">
                  <span className={`text-sm ${hecho ? "text-gray-400 line-through" : "font-medium text-gray-900"}`}>{p.titulo}{p.nivel === "esencial" && !hecho && <span className="ml-2 rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-600">esencial</span>}</span>
                  <ChevronDown className={`h-4 w-4 shrink-0 text-gray-400 transition ${abierto === p.id ? "rotate-180" : ""}`} />
                </button>
              </div>
              {abierto === p.id && (
                <div className="ml-7 mt-2 space-y-1.5 text-sm">
                  <p className={p.problema ? "text-amber-700" : "text-gray-600"}>{p.detalle}</p>
                  <p className="rounded-lg bg-gray-50 p-2 text-gray-600"><b>Lo que más se olvida:</b> {p.consejo}</p>
                  {p.ruta && <Link href={p.ruta} className="inline-block font-medium text-emerald-700 hover:underline">Ir a configurarlo →</Link>}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
