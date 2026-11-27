"use client";

import { useEffect, useState } from "react";
import { contieneSinTildes } from "@/lib/busqueda";

// Qué servicios tienen el descuento. Sin ninguno marcado, valen todos.
export function ServiciosPromo({ tenantId, elegidos, onChange }: { tenantId?: string; elegidos: string[]; onChange: (ids: string[]) => void }) {
  const [lista, setLista] = useState<Array<{ id: string; name: string; price: number }>>([]);
  const [buscar, setBuscar] = useState("");
  const [modo, setModo] = useState(false); // "solo algunos" recién tocado, aún sin marcar
  useEffect(() => {
    if (!tenantId) return;
    fetch(`/api/services?tenantId=${tenantId}`).then((r) => r.json()).then((d) => setLista(Array.isArray(d) ? d.filter((s: any) => !s.internal_only) : [])).catch(() => setLista([]));
  }, [tenantId]);
  const algunos = modo || elegidos.length > 0;
  const visibles = lista.filter((s) => !buscar.trim() || contieneSinTildes(s.name, buscar));
  const chip = (on: boolean) => `rounded-full border px-3.5 py-1.5 text-xs font-semibold ${on ? "border-brand-blue bg-brand-blue text-white" : "border-gray-200 bg-white text-brand-gray"}`;
  return (
    <div>
      <span className="mb-1.5 block text-xs font-semibold text-brand-gray">¿Qué servicios entran?</span>
      <div className="flex flex-wrap gap-1.5">
        <button type="button" aria-pressed={!algunos} onClick={() => { setModo(false); onChange([]); }} className={chip(!algunos)}>Todos</button>
        <button type="button" aria-pressed={algunos} onClick={() => setModo(true)} className={chip(algunos)}>Solo algunos{elegidos.length ? ` (${elegidos.length})` : ""}</button>
      </div>
      {algunos && (
        <div className="mt-2 rounded-xl border border-gray-200">
          <div className="flex items-center gap-2 border-b border-gray-100 p-2">
            <input value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar servicio" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-blue" />
            <button type="button" onClick={() => onChange(Array.from(new Set([...elegidos, ...visibles.map((s) => s.id)])))} className="flex-shrink-0 text-xs font-semibold text-brand-blue">Marcar {buscar.trim() ? "estos" : "todos"}</button>
            <button type="button" onClick={() => onChange([])} className="flex-shrink-0 text-xs font-semibold text-brand-gray">Limpiar</button>
          </div>
          <div className="max-h-64 overflow-y-auto p-1">
            {visibles.map((s) => (
              <label key={s.id} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-brand-dark hover:bg-gray-50">
                <input type="checkbox" checked={elegidos.includes(s.id)} onChange={(e) => onChange(e.target.checked ? [...elegidos, s.id] : elegidos.filter((x) => x !== s.id))} />
                <span className="min-w-0 flex-1">{s.name}</span><span className="text-xs text-brand-gray">${Number(s.price).toLocaleString("es-CL")}</span>
              </label>
            ))}
          </div>
          {!elegidos.length && <p className="border-t border-gray-100 px-3 py-2 text-xs text-amber-700">Marca al menos uno; si no, la promoción vale para todos.</p>}
        </div>
      )}
    </div>
  );
}
