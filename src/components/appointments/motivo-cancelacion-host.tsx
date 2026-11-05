"use client";

import { useEffect, useState } from "react";
import { MOTIVOS_EQUIPO } from "@/lib/cancel-reasons";
import { registrarAnfitrionMotivo } from "@/lib/motivo-cancelacion-bus";

// Cuadro «¿Por qué se cancela?»: sirve de confirmación y deja el motivo registrado para el Dashboard.
export function MotivoCancelacionHost() {
  const [pedido, setPedido] = useState<((v: string | false) => void) | null>(null);
  const [motivo, setMotivo] = useState("");

  useEffect(() => {
    registrarAnfitrionMotivo((resolve) => { setMotivo(""); setPedido(() => resolve); });
    return () => registrarAnfitrionMotivo(null);
  }, []);

  if (!pedido) return null;
  const cerrar = (v: string | false) => { pedido(v); setPedido(null); };
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={() => cerrar(false)}>
      <div className="w-full max-w-sm rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-bold text-brand-dark">Cancelar cita</h3>
        <p className="mt-1 text-sm text-brand-gray">Elige el motivo. Así sabrás por qué se cae tu agenda.</p>
        <div className="mt-3 space-y-1.5">
          {MOTIVOS_EQUIPO.map((o) => (
            <label key={o.v} className={`flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm ${motivo === o.v ? "border-brand-blue bg-brand-blue/5" : "border-gray-100"}`}>
              <input type="radio" name="motivo-cancelacion" checked={motivo === o.v} onChange={() => setMotivo(o.v)} />
              <span className="text-brand-dark">{o.l}</span>
            </label>
          ))}
        </div>
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={() => cerrar(false)} className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm text-brand-gray">Volver</button>
          <button type="button" disabled={!motivo} onClick={() => cerrar(motivo)} className="flex-1 rounded-xl bg-red-500 py-2.5 text-sm font-semibold text-white disabled:opacity-40">Cancelar cita</button>
        </div>
      </div>
    </div>
  );
}
