"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { formatCurrency, todayInChile } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { Panel, inputClass, primaryButton, ghostButton } from "@/components/ui/premium";

interface Row {
  barberId: string; name: string; gross: number; rate: number; retention: number; net: number;
  record: { folio: string; issuedOn: string | null; amount: number; retentionAmount: number; notes: string | null } | null;
  status: "pendiente" | "recibida" | "diferencia";
}

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const BADGE: Record<Row["status"], string> = {
  pendiente: "bg-amber-100 text-amber-700",
  recibida: "bg-green-100 text-green-700",
  diferencia: "bg-red-100 text-red-700",
};
const LABEL: Record<Row["status"], string> = { pendiente: "Pendiente", recibida: "Recibida", diferencia: "Monto distinto" };

export default function HonorariosPage() {
  const { showToast } = useToast();
  const [y0, m0] = todayInChile().split("-").map(Number);
  const [year, setYear] = useState(y0);
  const [month, setMonth] = useState(m0);
  const [rows, setRows] = useState<Row[]>([]);
  const [summary, setSummary] = useState({ expectedRetention: 0, receivedRetention: 0, pending: 0 });
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [form, setForm] = useState({ folio: "", issuedOn: "", amount: "", notes: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch(`/api/honorarios?year=${year}&month=${month}`);
    const j = await r.json().catch(() => ({}));
    setLoading(false);
    if (!r.ok) { showToast(j.error || "No se pudo cargar", "error"); return; }
    setRows(j.rows || []); setSummary(j.summary); setMissing(!!j.missing_migration);
  }, [year, month, showToast]);
  useEffect(() => { load(); }, [load]);

  const shift = (d: number) => {
    const t = year * 12 + (month - 1) + d;
    setYear(Math.floor(t / 12)); setMonth((t % 12) + 1); setOpenId(null);
  };

  const openForm = (r: Row) => {
    setOpenId(openId === r.barberId ? null : r.barberId);
    setForm({ folio: r.record?.folio || "", issuedOn: r.record?.issuedOn || "", amount: String(r.record?.amount ?? r.gross), notes: r.record?.notes || "" });
  };

  const save = async (r: Row, clear = false) => {
    setSaving(true);
    const res = await fetch("/api/honorarios", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profileId: r.barberId, year, month, ...(clear ? { folio: "" } : form) }),
    });
    const j = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) { showToast(j.error || "No se pudo guardar", "error"); return; }
    showToast(clear ? "Registro quitado" : "Boleta registrada", "success");
    setOpenId(null); load();
  };

  const copyNotice = async (r: Row) => {
    const text = `Hola ${r.name.split(" ")[0]}, para cerrar ${MONTHS[month - 1]} ${year} debes emitir tu boleta de honorarios por ${formatCurrency(r.gross)}. ` +
      `Se te retiene el ${String(r.rate).replace(".", ",")}% (${formatCurrency(r.retention)}) y recibes ${formatCurrency(r.net)}. Cuando la emitas, envíame el número de folio.`;
    try { await navigator.clipboard.writeText(text); showToast("Aviso copiado, pégalo en WhatsApp", "success"); } catch { showToast("No se pudo copiar", "error"); }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <Link href="/dashboard/configuracion" className="inline-flex items-center gap-1 text-sm text-brand-gray"><ArrowLeft className="h-4 w-4" /> Configuración</Link>
      <h1 className="text-xl font-extrabold text-brand-dark">Boletas de honorarios</h1>
      <p className="text-sm text-brand-gray">
        Profesionales por comisión con retención. Cada uno emite su boleta de honorarios en el SII; aquí ves cuánto debe emitir,
        registras la que te entregó y sumas la retención del mes. re-booking no emite estas boletas.
      </p>
      <div className="flex items-center justify-between">
        <button className={ghostButton} onClick={() => shift(-1)} aria-label="Mes anterior"><ChevronLeft className="h-4 w-4" /></button>
        <b className="capitalize">{MONTHS[month - 1]} {year}</b>
        <button className={ghostButton} onClick={() => shift(1)} aria-label="Mes siguiente"><ChevronRight className="h-4 w-4" /></button>
      </div>
      {missing && <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">Falta aplicar la migración 119: aún no se pueden guardar registros.</div>}
      <Panel>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div><p className="text-[11px] text-brand-gray">Retención esperada</p><p className="font-extrabold tabular-nums">{formatCurrency(summary.expectedRetention)}</p></div>
          <div><p className="text-[11px] text-brand-gray">Según boletas recibidas</p><p className="font-extrabold tabular-nums">{formatCurrency(summary.receivedRetention)}</p></div>
          <div><p className="text-[11px] text-brand-gray">Boletas pendientes</p><p className="font-extrabold tabular-nums">{summary.pending}</p></div>
        </div>
      </Panel>
      {loading ? <p className="text-sm text-brand-gray">Cargando…</p> : rows.length === 0 ? (
        <Panel><p className="text-sm text-brand-gray">Ningún profesional por comisión tiene retención de honorarios activa. Se enciende en su ficha → Trabajo → Integración SII.</p></Panel>
      ) : rows.map((r) => (
        <Panel key={r.barberId}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-bold text-brand-dark">{r.name}</p>
              <p className="text-xs text-brand-gray">Debe emitir {formatCurrency(r.gross)} · retención {String(r.rate).replace(".", ",")}% = {formatCurrency(r.retention)} · recibe {formatCurrency(r.net)}</p>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${BADGE[r.status]}`}>{LABEL[r.status]}</span>
          </div>
          {r.record && <p className="mt-2 text-xs text-brand-gray">Folio {r.record.folio}{r.record.issuedOn ? ` · ${r.record.issuedOn}` : ""} · monto {formatCurrency(r.record.amount)}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <button className={ghostButton} onClick={() => copyNotice(r)}>Copiar aviso</button>
            <button className={ghostButton} onClick={() => openForm(r)}>{r.record ? "Editar registro" : "Registrar boleta recibida"}</button>
          </div>
          {openId === r.barberId && (
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <div><label className="block text-xs text-gray-500 mb-1">Folio</label><input className={inputClass} value={form.folio} onChange={(e) => setForm({ ...form, folio: e.target.value })} /></div>
              <div><label className="block text-xs text-gray-500 mb-1">Fecha de emisión</label><input type="date" className={inputClass} value={form.issuedOn} onChange={(e) => setForm({ ...form, issuedOn: e.target.value })} /></div>
              <div><label className="block text-xs text-gray-500 mb-1">Monto bruto ($)</label><input type="number" className={inputClass} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
              <div className="md:col-span-3"><label className="block text-xs text-gray-500 mb-1">Nota (opcional)</label><input className={inputClass} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
              <div className="md:col-span-3 flex gap-2">
                <button className={primaryButton} disabled={saving} onClick={() => save(r)}>{saving ? "Guardando…" : "Guardar"}</button>
                {r.record && <button className={ghostButton} disabled={saving} onClick={() => save(r, true)}>Quitar registro</button>}
              </div>
            </div>
          )}
        </Panel>
      ))}
    </div>
  );
}
