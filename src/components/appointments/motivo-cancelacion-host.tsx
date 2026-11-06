"use client";

import { useEffect, useState } from "react";
import { MOTIVOS_EQUIPO } from "@/lib/cancel-reasons";
import { registrarAnfitrionMotivo, type MotivoElegido } from "@/lib/motivo-cancelacion-bus";
import { NOTA_MINIMA } from "@/lib/cancel-reasons";

// Cuadro «¿Por qué se cancela?»: sirve de confirmación y deja el motivo registrado para el Dashboard.
export function MotivoCancelacionHost() {
  const [pedido, setPedido] = useState<((v: MotivoElegido | false) => void) | null>(null);
  const [motivo, setMotivo] = useState("");
  const [nota, setNota] = useState("");

  useEffect(() => {
    registrarAnfitrionMotivo((resolve) => { setMotivo(""); setNota(""); setPedido(() => resolve); });
    return () => registrarAnfitrionMotivo(null);
  }, []);

  if (!pedido) return null;
  const cerrar = (v: MotivoElegido | false) => { pedido(v); setPedido(null); };
  const valido = !!motivo && (motivo !== "otro" || nota.trim().length >= NOTA_MINIMA);
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
        {motivo === "otro" && (
          <div className="mt-2">
            <textarea value={nota} onChange={(e) => setNota(e.target.value)} maxLength={300} rows={2} autoFocus placeholder="Escribe cuál fue el motivo (obligatorio)"
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-brand-dark outline-none focus:border-brand-blue" />
            <p className="mt-1 text-[11px] text-brand-gray">Así podrás analizar después por qué se cancelan las citas.</p>
          </div>
        )}
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={() => cerrar(false)} className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm text-brand-gray">Volver</button>
          <button type="button" disabled={!valido} onClick={() => cerrar({ motivo, nota: nota.trim() })} className="flex-1 rounded-xl bg-red-500 py-2.5 text-sm font-semibold text-white disabled:opacity-40">Cancelar cita</button>
        </div>
      </div>
    </div>
  );
}
