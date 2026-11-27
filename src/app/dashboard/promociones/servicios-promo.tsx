"use client";

import { useEffect, useState } from "react";
import { contieneSinTildes } from "@/lib/busqueda";
import { porCategoria } from "@/lib/categorias-servicios";

// Qué servicios tienen el descuento. Sin ninguno marcado, valen todos.
export function ServiciosPromo({ tenantId, elegidos, onChange }: { tenantId?: string; elegidos: string[]; onChange: (ids: string[]) => void }) {
  const [lista, setLista] = useState<Array<{ id: string; name: string; price: number; category?: string | null }>>([]);
  const [cerradas, setCerradas] = useState<string[]>([]); // categorías plegadas
  const [buscar, setBuscar] = useState("");
  const [modo, setModo] = useState(false); // "solo algunos" recién tocado, aún sin marcar
  useEffect(() => {
    if (!tenantId) return;
    fetch(`/api/services?tenantId=${tenantId}`).then((r) => r.json()).then((d) => setLista(Array.isArray(d) ? d.filter((s: any) => !s.internal_only) : [])).catch(() => setLista([]));
  }, [tenantId]);
  const algunos = modo || elegidos.length > 0;
  const visibles = lista.filter((s) => !buscar.trim() || contieneSinTildes(s.name, buscar));
  const grupos = porCategoria(visibles);
  const marcar = (ids: string[], on: boolean) => onChange(on ? Array.from(new Set([...elegidos, ...ids])) : elegidos.filter((x) => !ids.includes(x)));
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
          <div className="max-h-96 overflow-y-auto p-1">
            {grupos.map((g) => {
              const ids = g.items.map((s) => s.id);
              const marcados = ids.filter((id) => elegidos.includes(id)).length;
              // Buscando, todo queda abierto.
              const abierta = !!buscar.trim() || !cerradas.includes(g.nombre);
              const conTitulo = grupos.length > 1 || g.nombre !== "Sin categoría";
              return (
                <div key={g.nombre}>
                  {conTitulo && (
                    <div className="mt-1 flex items-center gap-2.5 rounded-lg bg-gray-50 px-2 py-2">
                      <input type="checkbox" aria-label={`Marcar toda la categoría ${g.nombre}`} checked={marcados === ids.length}
                        ref={(el) => { if (el) el.indeterminate = marcados > 0 && marcados < ids.length; }} onChange={(e) => marcar(ids, e.target.checked)} />
                      <button type="button" aria-expanded={abierta} onClick={() => setCerradas((l) => (l.includes(g.nombre) ? l.filter((x) => x !== g.nombre) : [...l, g.nombre]))} className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left">
                        <span className="truncate text-xs font-bold uppercase tracking-wide text-brand-dark">{g.nombre}</span>
                        <span className="flex-shrink-0 text-xs text-brand-gray">{marcados} de {ids.length} {abierta ? "▾" : "▸"}</span>
                      </button>
                    </div>
                  )}
                  {abierta && g.items.map((s) => (
                    <label key={s.id} className={`flex cursor-pointer items-center gap-2.5 rounded-lg py-1.5 pr-2 text-sm text-brand-dark hover:bg-gray-50 ${conTitulo ? "pl-7" : "pl-2"}`}>
                      <input type="checkbox" checked={elegidos.includes(s.id)} onChange={(e) => marcar([s.id], e.target.checked)} />
                      <span className="min-w-0 flex-1">{s.name}</span><span className="text-xs text-brand-gray">${Number(s.price).toLocaleString("es-CL")}</span>
                    </label>
                  ))}
                </div>
              );
            })}
          </div>
          {!elegidos.length && <p className="border-t border-gray-100 px-3 py-2 text-xs text-amber-700">Marca al menos uno; si no, la promoción vale para todos.</p>}
        </div>
      )}
    </div>
  );
}
