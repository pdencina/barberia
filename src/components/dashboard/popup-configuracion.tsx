"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Circle, X } from "lucide-react";
import { type PasoConfig } from "@/lib/configuracion-inicial";

const KEY = "rb_popup_config_dia";
const hoy = () => new Date().toISOString().slice(0, 10);
const leer = (): string | null => { try { return localStorage.getItem(KEY); } catch { return null; } };
const guardar = () => { try { localStorage.setItem(KEY, hoy()); } catch { /* sin almacenamiento */ } };

// Ventana «Terminemos de configurar tu negocio»: aparece al entrar al Inicio mientras falte algo importante (una vez al día).
export function PopupConfiguracion() {
  const [faltan, setFaltan] = useState<PasoConfig[] | null>(null);

  useEffect(() => {
    if (leer() === hoy()) return;
    fetch("/api/configuracion/checklist").then((r) => (r.ok ? r.json() : null)).then((j) => {
      const pend = ((j?.pasos as PasoConfig[]) || []).filter((p) => !p.manual && !p.hecho && (p.nivel === "esencial" || p.problema));
      if (pend.length > 0) setFaltan(pend);
    }).catch(() => {});
  }, []);

  if (!faltan) return null;
  const cerrar = () => { guardar(); setFaltan(null); };
  const primero = faltan[0];

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="popup-config-titulo">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl dark:bg-brand-white">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="popup-config-titulo" className="text-lg font-bold text-brand-dark">Terminemos de configurar tu negocio</h2>
            <p className="mt-1 text-sm text-brand-gray">Te falta esto para que tus clientes puedan reservar sin problemas:</p>
          </div>
          <button onClick={cerrar} aria-label="Cerrar" className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>
        <ul className="mt-3 space-y-2">
          {faltan.slice(0, 4).map((p) => (
            <li key={p.id} className="rounded-xl border border-gray-100 p-3">
              <div className="flex items-start gap-2">
                {p.problema ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" /> : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-gray-300" />}
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-brand-dark">{p.titulo}</p>
                  <p className="text-xs text-brand-gray">{p.detalle}</p>
                  {p.ruta && <Link href={p.ruta} onClick={cerrar} className="mt-1 inline-block text-xs font-semibold text-brand-blue hover:underline">Hacerlo ahora →</Link>}
                </div>
              </div>
            </li>
          ))}
        </ul>
        {faltan.length > 4 && <p className="mt-2 text-xs text-brand-gray">Y {faltan.length - 4} más en la guía de tu Inicio.</p>}
        <div className="mt-4 flex gap-2">
          {primero.ruta && <Link href={primero.ruta} onClick={cerrar} className="flex-1 rounded-xl bg-brand-blue px-4 py-2.5 text-center text-sm font-semibold text-white">Empezar</Link>}
          <button onClick={cerrar} className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-brand-gray">Ahora no</button>
        </div>
      </div>
    </div>
  );
}
