"use client";

import { useCallback, useEffect, useState } from "react";
import { StickyNote, Trash2, Plus } from "lucide-react";
import { todayInChile } from "@/lib/utils";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { estadoVencimiento, ordenarNotas, type NotaOti } from "@/lib/oti/notas";

// Notas del administrador (las deja Oti o se escriben aquí). Se quedan siempre visibles hasta que se borran, y borrar pide confirmación.
export function NotasCard() {
  const { confirm } = useConfirm();
  const { showToast } = useToast();
  const [notas, setNotas] = useState<NotaOti[] | null>(null);
  const [nueva, setNueva] = useState("");
  const [dia, setDia] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const r = await fetch("/api/notas", { cache: "no-store" });
      const d = await r.json().catch(() => ({}));
      setNotas(r.ok && !d?.migracionPendiente ? (d.notas || []) : []);
    } catch { setNotas([]); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);
  // Oti avisa cuando deja o borra una nota.
  useEffect(() => { const f = () => cargar(); window.addEventListener("notas-changed", f); return () => window.removeEventListener("notas-changed", f); }, [cargar]);

  const agregar = async () => {
    if (!nueva.trim()) return;
    setGuardando(true);
    try {
      const r = await fetch("/api/notas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ texto: nueva, dia: dia ? Number(dia) : null }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { showToast(d?.error || "No pude guardar la nota", "error"); return; }
      setNueva(""); setDia(""); setAbierto(false);
      await cargar();
    } finally { setGuardando(false); }
  };

  const borrar = async (n: NotaOti) => {
    const ok = await confirm({ title: "Borrar nota", message: `¿Seguro que quieres borrar «${n.texto}»? Dejará de aparecer en tu Dashboard.`, confirmText: "Sí, borrar", variant: "danger" });
    if (!ok) return;
    const r = await fetch(`/api/notas?id=${n.id}`, { method: "DELETE" });
    if (!r.ok) { showToast("No pude borrar la nota", "error"); return; }
    showToast("Nota borrada", "success");
    await cargar();
  };

  if (notas === null) return null;
  const hoy = todayInChile();
  const lista = ordenarNotas(notas, hoy);
  if (lista.length === 0 && !abierto) {
    // Sin notas no se ocupa espacio: solo un botoncito «+ Nota» (Oti también las deja: «recuérdame pagar la luz el 5»).
    return (
      <button type="button" onClick={() => setAbierto(true)} title="Agregar una nota (también puedes pedírsela a Oti)"
        className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-dashed border-gray-300 px-3 py-1 text-xs font-semibold text-brand-gray transition-colors hover:border-brand-blue hover:text-brand-blue">
        <StickyNote className="h-3.5 w-3.5" strokeWidth={1.75} /> <Plus className="-ml-1 h-3 w-3" /> Nota
      </button>
    );
  }
  return (
    <div className="order-last w-full basis-full rounded-2xl border border-gray-100 bg-white p-4 md:p-5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2.5"><span className="h-1.5 w-1.5 rounded-full bg-brand-blue" /><span className="text-[13px] font-bold uppercase tracking-[0.12em] text-brand-dark">Mis notas</span></h3>
        <button type="button" onClick={() => setAbierto((v) => !v)} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-blue hover:underline"><Plus className="h-3.5 w-3.5" /> Agregar</button>
      </div>
      <ul className="mt-3 space-y-2">
        {lista.map((n) => {
          const e = estadoVencimiento(n.dia, hoy);
          return (
            <li key={n.id} className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${e?.urgente ? "border-brand-blue/40 bg-brand-blue/[0.06]" : "border-gray-100"}`}>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-brand-dark">{n.texto}</p>
                {e && <p className={`text-[11px] ${e.urgente ? "font-semibold text-brand-blue" : "text-brand-gray"}`}>{e.texto}</p>}
              </div>
              <button type="button" onClick={() => borrar(n)} aria-label={`Borrar la nota ${n.texto}`} className="flex-shrink-0 rounded-lg p-1.5 text-brand-gray hover:bg-red-50 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
            </li>
          );
        })}
      </ul>
      {abierto && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input value={nueva} onChange={(e) => setNueva(e.target.value)} maxLength={200} placeholder="Ej: Pagar la luz" className="min-w-[180px] flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-brand-dark outline-none focus:border-brand-blue" onKeyDown={(e) => { if (e.key === "Enter") agregar(); }} />
          <input value={dia} onChange={(e) => setDia(e.target.value.replace(/\D/g, "").slice(0, 2))} inputMode="numeric" placeholder="Día (opc.)" className="w-24 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-brand-dark outline-none focus:border-brand-blue" />
          <button type="button" onClick={agregar} disabled={guardando || !nueva.trim()} className="rounded-xl bg-brand-blue px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">Guardar</button>
        </div>
      )}
    </div>
  );
}
