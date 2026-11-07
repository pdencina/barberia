"use client";

import { useEffect, useState } from "react";

export function BookingReschedule({ appointmentId }: { appointmentId: string }) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  const [expectedStart, setExpectedStart] = useState("");
  const [slots, setSlots] = useState<string[]>([]);
  const [start, setStart] = useState("");
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!open || done) return;
    const controller = new AbortController();
    setBusy(true); setError(""); setSlots([]); setStart("");
    const params = new URLSearchParams({ id: appointmentId, ...(date ? { date } : {}) });
    fetch(`/api/public/reschedule?${params}`, { cache: "no-store", signal: controller.signal })
      .then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error); return d; })
      .then((d) => { if (date) setSlots(d.slots || []); else { setExpectedStart(d.start); setDate(d.date); } })
      .catch((e) => { if (!controller.signal.aborted) setError(e.message || "No se pudieron consultar las horas"); })
      .finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
  }, [open, date, appointmentId, done]);

  async function save() {
    if (saving || !start || !expectedStart) return;
    setSaving(true); setError("");
    try {
      const r = await fetch("/api/public/reschedule", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointmentId, date, start, expectedStart }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "No se pudo cambiar la hora");
      setDone(true);
    } catch (e: any) { setError(e.message || "No se pudo cambiar la hora"); }
    finally { setSaving(false); }
  }

  if (!open) return <button onClick={() => setOpen(true)} className="w-full rounded-xl bg-brand-blue py-3 text-sm font-semibold text-white">Cambiar fecha u hora</button>;
  return <section className="rounded-xl border border-brand-blue/20 bg-brand-blue/5 p-4 text-left" aria-label="Cambiar fecha u hora">
    <h3 className="font-bold text-brand-dark">{done ? "Tu cita fue modificada" : "Elige tu nuevo horario"}</h3>
    <p className="mt-1 text-sm text-brand-gray">{done ? "Si ya pagaste un abono, se conserva en esta misma cita. No necesitas pagarlo de nuevo." : "Si ya pagaste un abono, lo conservas al cambiar la hora. Mantienes el profesional y los servicios."}</p>
    {done ? <p className="mt-3 font-semibold text-brand-blue">{start.slice(8, 10)}/{start.slice(5, 7)}/{start.slice(0, 4)} · {start.slice(11, 16)}</p> : <>
      <label className="mt-3 block text-sm font-medium">Nueva fecha<input type="date" value={date} disabled={saving || !expectedStart} onChange={(e) => setDate(e.target.value)} className="mt-1 block w-full rounded-lg border bg-white p-2" /></label>
      {busy ? <p role="status" className="mt-3 text-sm">Buscando horas…</p> : <div className="mt-3 grid grid-cols-3 gap-2">
        {slots.map((s) => <button key={s} disabled={saving} onClick={() => setStart(s)} aria-pressed={start === s} className={`rounded-lg border py-2 text-sm ${start === s ? "bg-brand-blue text-white" : "bg-white text-brand-dark"}`}>{s.slice(11, 16)}</button>)}
      </div>}
      {!busy && !error && !slots.length && <p className="mt-2 text-sm text-brand-gray">No hay horas disponibles ese día.</p>}
      <button onClick={save} disabled={busy || saving || !start || !expectedStart} className="mt-4 w-full rounded-lg bg-brand-blue py-2.5 text-sm font-semibold text-white disabled:opacity-40">{saving ? "Guardando…" : "Confirmar cambio sin volver a pagar"}</button>
      <button onClick={() => { setOpen(false); setDate(""); setExpectedStart(""); }} disabled={saving} className="mt-2 w-full py-2 text-sm text-brand-gray">Volver</button>
    </>}
    {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
  </section>;
}
