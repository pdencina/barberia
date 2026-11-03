"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Trash2, Lock } from "lucide-react";
import { formatCurrency, todayInChile } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { CATEGORIAS_GASTO, CATEGORIAS_INGRESO } from "@/lib/oti/personal";

interface Item { id: string; kind: "expense" | "income"; amount: number; description: string; category: string; entry_date: string; source: string }
const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const mesFin = (y: number, m: number) => `${y}-${String(m).padStart(2, "0")}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, "0")}`;
const fechaCorta = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

// Mis gastos e ingresos PERSONALES (no son los del negocio). Privado: solo la persona los ve. Se llenan aqui o hablando con Oti.
export function GastosPersonales() {
  const { showToast } = useToast();
  const hoy = todayInChile();
  const [y, setY] = useState(Number(hoy.slice(0, 4)));
  const [m, setM] = useState(Number(hoy.slice(5, 7)));
  const [items, setItems] = useState<Item[] | null>(null);
  const [pendiente, setPendiente] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const [form, setForm] = useState({ kind: "expense" as "expense" | "income", amount: "", description: "", category: "Otros", entry_date: hoy });
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const res = await fetch(`/api/personal/movimientos?desde=${y}-${String(m).padStart(2, "0")}-01&hasta=${mesFin(y, m)}`, { cache: "no-store" });
      const d = await res.json().catch(() => ({}));
      if (d?.migracionPendiente) { setPendiente(true); setItems([]); return; }
      setItems(res.ok ? d.items || [] : []);
    } catch { setItems([]); }
  }, [y, m]);
  useEffect(() => { setItems(null); cargar(); }, [cargar]);
  // Oti avisa cuando anota algo para refrescar la lista.
  useEffect(() => { const f = () => cargar(); window.addEventListener("personal-entries-changed", f); return () => window.removeEventListener("personal-entries-changed", f); }, [cargar]);

  const total = useMemo(() => {
    const g = (items || []).filter((i) => i.kind === "expense").reduce((s, i) => s + i.amount, 0);
    const ing = (items || []).filter((i) => i.kind === "income").reduce((s, i) => s + i.amount, 0);
    const porCat = new Map<string, number>();
    for (const i of items || []) if (i.kind === "expense") porCat.set(i.category, (porCat.get(i.category) || 0) + i.amount);
    return { g, ing, balance: ing - g, cats: Array.from(porCat.entries()).sort((a, b) => b[1] - a[1]) };
  }, [items]);

  const mover = (d: number) => { let nm = m + d, ny = y; if (nm < 1) { nm = 12; ny--; } if (nm > 12) { nm = 1; ny++; } setM(nm); setY(ny); };
  const guardar = async () => {
    const monto = Number(form.amount.replace(/[.\s$]/g, ""));
    if (!Number.isInteger(monto) || monto < 1) { showToast("Escribe un monto válido", "error"); return; }
    if (!form.description.trim()) { showToast("Escribe en qué fue", "error"); return; }
    setGuardando(true);
    try {
      const res = await fetch("/api/personal/movimientos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, amount: monto, source: "manual" }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { showToast(d?.error || "No se pudo guardar", "error"); return; }
      setForm({ kind: form.kind, amount: "", description: "", category: "Otros", entry_date: hoy }); setAbierto(false); showToast("Anotado", "success"); cargar();
    } finally { setGuardando(false); }
  };
  const borrar = async (id: string) => {
    if (!window.confirm("¿Borrar este movimiento?")) return;
    const res = await fetch(`/api/personal/movimientos?id=${id}`, { method: "DELETE" });
    if (res.ok) { setItems((x) => (x || []).filter((i) => i.id !== id)); showToast("Borrado", "success"); } else showToast("No se pudo borrar", "error");
  };

  const cats = form.kind === "expense" ? CATEGORIAS_GASTO : CATEGORIAS_INGRESO;
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-bold text-brand-dark">Gastos personales</h2>
          <p className="text-xs text-brand-gray flex items-center gap-1"><Lock className="h-3 w-3" /> Solo tú los ves. No se mezclan con los gastos del negocio. También puedes decírselos a Oti.</p>
        </div>
        <div className="flex items-center gap-1 rounded-xl border border-gray-100 bg-brand-light p-1">
          <button onClick={() => mover(-1)} aria-label="Mes anterior" className="flex h-8 w-8 items-center justify-center rounded-lg text-brand-gray hover:bg-white"><ChevronLeft className="h-4 w-4" /></button>
          <span className="min-w-[110px] text-center text-xs font-bold text-brand-dark">{MESES[m - 1]} {y}</span>
          <button onClick={() => mover(1)} aria-label="Mes siguiente" className="flex h-8 w-8 items-center justify-center rounded-lg text-brand-gray hover:bg-white"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>

      {pendiente && <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-700">Falta una actualización de la base de datos (migración 124) para usar esto.</p>}

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-red-50 p-3"><p className="text-[11px] text-red-600">Gastos</p><p className="text-base md:text-lg font-extrabold tabular-nums text-red-700">{formatCurrency(total.g)}</p></div>
        <div className="rounded-xl bg-emerald-50 p-3"><p className="text-[11px] text-emerald-600">Ingresos</p><p className="text-base md:text-lg font-extrabold tabular-nums text-emerald-700">{formatCurrency(total.ing)}</p></div>
        <div className="rounded-xl bg-gray-50 p-3"><p className="text-[11px] text-brand-gray">Balance</p><p className={`text-base md:text-lg font-extrabold tabular-nums ${total.balance < 0 ? "text-red-700" : "text-brand-dark"}`}>{total.balance < 0 ? "-" : ""}{formatCurrency(Math.abs(total.balance))}</p></div>
      </div>

      {total.cats.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-brand-dark">En qué se fue</p>
          {total.cats.map(([c, v]) => (
            <div key={c} className="text-xs">
              <div className="flex justify-between"><span className="text-brand-dark">{c}</span><span className="tabular-nums text-brand-gray">{formatCurrency(v)} · {Math.round((v / Math.max(1, total.g)) * 100)}%</span></div>
              <div className="mt-0.5 h-1.5 rounded-full bg-gray-100"><div className="h-1.5 rounded-full bg-brand-blue" style={{ width: `${Math.max(3, (v / Math.max(1, total.g)) * 100)}%` }} /></div>
            </div>
          ))}
        </div>
      )}

      <button onClick={() => setAbierto((a) => !a)} className="inline-flex items-center gap-1.5 rounded-xl border border-brand-blue/40 px-3 py-2 text-xs font-semibold text-brand-blue"><Plus className="h-3.5 w-3.5" /> Anotar un movimiento</button>
      {abierto && (
        <div className="space-y-2 rounded-xl border border-gray-100 bg-gray-50 p-3">
          <div className="flex gap-2">
            {(["expense", "income"] as const).map((k) => (
              <button key={k} type="button" onClick={() => setForm({ ...form, kind: k, category: "Otros" })} className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold ${form.kind === k ? (k === "expense" ? "bg-red-600 text-white" : "bg-emerald-600 text-white") : "bg-white text-brand-gray border border-gray-200"}`}>{k === "expense" ? "Gasto" : "Ingreso"}</button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input inputMode="numeric" placeholder="Monto ($)" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm" />
            <input type="date" max={hoy} value={form.entry_date} onChange={(e) => setForm({ ...form, entry_date: e.target.value })} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm" />
          </div>
          <input placeholder="¿En qué fue? (ej: pan, metro, máquina de cortar)" maxLength={200} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm" />
          <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">{[...cats, "Otros"].filter((c, i, a) => a.indexOf(c) === i).map((c) => <option key={c} value={c}>{c}</option>)}</select>
          <button onClick={guardar} disabled={guardando} className="w-full rounded-lg bg-brand-blue px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{guardando ? "Guardando…" : "Guardar"}</button>
        </div>
      )}

      <div className="divide-y divide-gray-100">
        {items === null && <p className="py-4 text-center text-xs text-brand-gray">Cargando…</p>}
        {items !== null && items.length === 0 && <p className="py-4 text-center text-xs text-brand-gray">Aún no anotas nada este mes. Prueba decirle a Oti: «compré pan $1.200».</p>}
        {(items || []).map((i) => (
          <div key={i.id} className="flex items-center justify-between gap-3 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-brand-dark">{i.description}</p>
              <p className="truncate text-xs text-brand-gray">{fechaCorta(i.entry_date)} · {i.category}{i.source === "oti" ? " · con Oti" : i.source === "voz" ? " · por voz" : ""}</p>
            </div>
            <div className="flex flex-shrink-0 items-center gap-2">
              <span className={`text-sm font-bold tabular-nums ${i.kind === "expense" ? "text-red-600" : "text-emerald-600"}`}>{i.kind === "expense" ? "-" : "+"}{formatCurrency(i.amount)}</span>
              <button onClick={() => borrar(i.id)} aria-label="Borrar" className="rounded-lg p-1.5 text-brand-gray hover:bg-red-50 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
