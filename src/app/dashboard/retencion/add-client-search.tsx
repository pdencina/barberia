"use client";

import { useEffect, useRef, useState } from "react";
import { Search, Plus, Check } from "lucide-react";
import { inputClass } from "@/components/ui/premium";
import { formatPhoneCL } from "@/lib/phone";

export interface ManualClient { id: string; name: string; email: string | null; phone: string | null }

interface Found extends ManualClient { optedOut: boolean }

// Buscador para agregar A MANO a un cliente al envio de Retencion (aunque no este en el rango de dias elegido).
// Busca entre TODOS los clientes del negocio (nombre, correo o telefono). Quien pidio no recibir promociones no se puede agregar.
export function AddClientSearch({
  inListIds,
  manualIds,
  onAdd,
}: {
  /** Ids que ya estan en la lista calculada (no se vuelven a agregar). */
  inListIds: Set<string>;
  /** Ids ya agregados a mano. */
  manualIds: Set<string>;
  onAdd: (c: ManualClient) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Found[]>([]);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setResults([]); setLoading(false); return; }
    setLoading(true);
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/clients?search=${encodeURIComponent(q)}&limit=8`);
        const data = await res.json();
        if (cancelled) return;
        setResults((Array.isArray(data?.clients) ? data.clients : []).map((c: any) => ({
          id: c.id, name: c.name, email: c.email || null, phone: c.phone || null,
          optedOut: c.do_not_contact === true || c.marketing_consent === false,
        })));
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [query]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const showList = open && query.trim().length >= 2;

  return (
    <div ref={boxRef} className="relative">
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-gray" strokeWidth={1.75} />
      <input
        type="text"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}
        placeholder="Agregar a un cliente en especial: busca por nombre, correo o teléfono…"
        className={`${inputClass} pl-10`}
        aria-label="Buscar un cliente para agregarlo al envío"
      />
      {showList && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1.5 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-xl">
          {loading && results.length === 0 ? (
            <p className="px-4 py-3 text-sm text-brand-gray">Buscando…</p>
          ) : results.length === 0 ? (
            <p className="px-4 py-3 text-sm text-brand-gray">No se encontró ningún cliente con “{query.trim()}”.</p>
          ) : (
            <ul className="max-h-72 divide-y divide-gray-50 overflow-y-auto">
              {results.map((c) => {
                const already = inListIds.has(c.id);
                const added = manualIds.has(c.id);
                const contactable = !!(c.email || c.phone);
                const blocked = c.optedOut || !contactable;
                const note = already ? "Ya está en la lista" : added ? "Agregado" : c.optedOut ? "No quiere recibir promociones" : !contactable ? "Sin correo ni teléfono" : null;
                return (
                  <li key={c.id} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold capitalize text-brand-dark">{c.name}</p>
                      <p className="truncate text-xs text-brand-gray">{c.email || "Sin correo"}{c.phone ? ` · ${formatPhoneCL(c.phone)}` : " · Sin teléfono"}</p>
                    </div>
                    {note ? (
                      <span className={`flex flex-shrink-0 items-center gap-1 text-xs font-semibold ${added || already ? "text-emerald-600" : "text-amber-600"}`}>
                        {(added || already) && <Check className="h-3.5 w-3.5" strokeWidth={2.5} />}{note}
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={blocked}
                        onClick={() => { onAdd({ id: c.id, name: c.name, email: c.email, phone: c.phone }); }}
                        className="inline-flex flex-shrink-0 items-center gap-1 rounded-xl bg-brand-blue/10 px-3 py-1.5 text-xs font-bold text-brand-blue transition-colors hover:bg-brand-blue hover:text-white"
                      >
                        <Plus className="h-3.5 w-3.5" strokeWidth={2.5} /> Agregar
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
