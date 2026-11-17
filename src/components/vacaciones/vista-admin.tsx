"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/toast";
import { Spinner } from "@/components/ui/spinner";

const fmt = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("es-CL", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" });
const ESTADO: Record<string, { t: string; c: string }> = {
  pending: { t: "Pendiente", c: "bg-amber-100 text-amber-700" },
  approved: { t: "Aceptada", c: "bg-emerald-100 text-emerald-700" },
  rejected: { t: "No aceptada", c: "bg-red-100 text-red-600" },
  cancelled: { t: "Cancelada", c: "bg-gray-100 text-gray-500" },
};
const OPCIONES_DIAS = Array.from({ length: 30 }, (_, i) => i + 1);

// Vista del administrador: preferencias (dias por año y reinicio), solicitudes por resolver y saldo de cada profesional.
export function VistaAdmin({ onCambio }: { onCambio?: () => void }) {
  const { showToast } = useToast();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dias, setDias] = useState<string>("");
  const [modo, setModo] = useState<"calendar" | "anniversary">("calendar");
  const [guardando, setGuardando] = useState(false);
  const [nota, setNota] = useState<Record<string, string>>({});

  const cargar = async () => {
    const r = await fetch("/api/vacaciones/solicitudes", { cache: "no-store" });
    const d = await r.json().catch(() => ({}));
    if (r.ok) { setData(d); setDias(d.prefs?.diasPorAnio ? String(d.prefs.diasPorAnio) : ""); setModo(d.prefs?.modo || "calendar"); }
    else setData({ error: d?.error || "No se pudo cargar" });
    setLoading(false);
  };
  useEffect(() => { cargar(); }, []);

  if (loading) return <Spinner />;
  if (!data || data.error) return <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{data?.error || "No se pudo cargar"}</p>;
  if (data.migracionFalta) return <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">Falta aplicar la migración 171 en la base de datos.</p>;

  const guardarPrefs = async () => {
    setGuardando(true);
    try {
      const res = await fetch("/api/vacaciones/preferencias", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ diasPorAnio: dias ? Number(dias) : null, modo }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d?.error || "No se pudo guardar");
      showToast("Preferencias guardadas", "success");
      cargar();
    } catch (e: any) { showToast(e?.message || "No se pudo guardar", "error"); }
    finally { setGuardando(false); }
  };

  const resolver = async (id: string, action: "approve" | "reject") => {
    const res = await fetch("/api/vacaciones/solicitudes", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, action, note: nota[id] || "" }) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { showToast(d?.error || "No se pudo resolver", "error"); cargar(); return; }
    showToast(action === "approve" ? (d.existingAppointments > 0 ? `Aceptada. Ojo: ya hay ${d.existingAppointments} cita(s) en esas fechas; muévelas o avísales.` : "Solicitud aceptada") : "Solicitud rechazada", action === "approve" && d.existingAppointments > 0 ? "error" : "success");
    cargar(); onCambio?.();
  };

  const guardarIngreso = async (barberId: string, ingreso: string) => {
    const res = await fetch("/api/vacaciones/preferencias", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ barberId, ingreso: ingreso || null }) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { showToast(d?.error || "No se pudo guardar", "error"); return; }
    showToast("Fecha de ingreso guardada", "success"); cargar();
  };

  const nombre = (id: string) => data.saldos.find((s: any) => s.barberId === id)?.name || "Profesional";
  const pendientes = (data.solicitudes || []).filter((s: any) => s.status === "pending");
  const resueltas = (data.solicitudes || []).filter((s: any) => s.status !== "pending").slice(0, 10);
  const activo = !!data.prefs?.diasPorAnio;

  return (
    <div className="space-y-3 md:space-y-4">
      <div className="space-y-3 rounded-2xl border border-gray-100 bg-white p-4 md:p-5">
        <div>
          <h2 className="font-bold text-brand-dark">Solicitudes de vacaciones: preferencias</h2>
          <p className="text-xs text-brand-gray">Tus profesionales piden sus vacaciones desde su sesión, en un calendario. Siempre empiezan un lunes y son un solo bloque corrido. Solo se descuentan los días en que cada uno trabaja.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-0.5 block text-[11px] text-brand-gray">Días laborales por año que puede pedir cada profesional</label>
            <select value={dias} onChange={(e) => setDias(e.target.value)} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm">
              <option value="">No permitir solicitudes</option>
              {OPCIONES_DIAS.map((n) => <option key={n} value={n}>{n} {n === 1 ? "día" : "días"} por año</option>)}
            </select>
          </div>
          <div>
            <label className="mb-0.5 block text-[11px] text-brand-gray">¿Cuándo se reinicia el derecho?</label>
            <select value={modo} onChange={(e) => setModo(e.target.value as any)} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm">
              <option value="calendar">Cada 1 de enero</option>
              <option value="anniversary">En el aniversario de su ingreso (como el año de servicio)</option>
            </select>
          </div>
        </div>
        <p className="text-[11px] text-brand-gray">Un profesional que ingresa durante el año parte automáticamente: si el reinicio es el 1 de enero, recibe la parte proporcional de los meses que le quedan; con aniversario, parte con el año completo desde su ingreso. Los que ya llevan más de un año tienen todos sus días desde enero.</p>
        <button type="button" onClick={guardarPrefs} disabled={guardando} className="rounded-xl bg-brand-blue px-5 py-2 text-sm font-medium text-white disabled:opacity-50">{guardando ? "Guardando…" : "Guardar preferencias"}</button>
      </div>

      {activo && (
        <div className="rounded-2xl border border-gray-100 bg-white">
          <div className="border-b p-4"><h2 className="font-bold text-brand-dark">Solicitudes por resolver ({pendientes.length})</h2></div>
          {pendientes.length === 0 ? <p className="p-6 text-center text-sm text-brand-gray">No hay solicitudes pendientes.</p> : (
            <ul className="divide-y">
              {pendientes.map((s: any) => (
                <li key={s.id} className="space-y-2 p-4">
                  <div>
                    <p className="font-medium text-brand-dark">{nombre(s.barber_id)}</p>
                    <p className="text-sm text-brand-gray">{fmt(s.start_date)} – {fmt(s.end_date)} · {s.working_days} día(s) laborales{s.note ? ` · ${s.note}` : ""}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <input value={nota[s.id] || ""} onChange={(e) => setNota({ ...nota, [s.id]: e.target.value })} maxLength={200} placeholder="Comentario (opcional)" className="min-w-0 flex-1 rounded-xl border border-gray-200 px-3 py-1.5 text-sm" />
                    <button type="button" onClick={() => resolver(s.id, "reject")} className="rounded-xl border border-gray-200 px-4 py-1.5 text-sm font-medium text-brand-gray hover:bg-gray-50">Rechazar</button>
                    <button type="button" onClick={() => resolver(s.id, "approve")} className="rounded-xl bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-700">Aceptar</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {activo && (
        <div className="rounded-2xl border border-gray-100 bg-white">
          <div className="border-b p-4"><h2 className="font-bold text-brand-dark">Días de cada profesional</h2><p className="text-xs text-brand-gray">Incluye lo ya aprobado y lo pendiente. La fecha de ingreso define cuándo parte cada uno.</p></div>
          <ul className="divide-y">
            {data.saldos.map((s: any) => (
              <li key={s.barberId} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="font-medium text-brand-dark">{s.name}</p>
                  <p className="text-xs text-brand-gray">{fmt(s.periodo.desde)} al {fmt(s.periodo.hasta)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-brand-dark">{s.usados} de {s.derecho} días</p>
                  <p className="text-[11px] text-brand-gray">quedan {s.restantes}</p>
                </div>
                <label className="text-[11px] text-brand-gray">Ingreso
                  <input type="date" defaultValue={s.ingreso || ""} onBlur={(e) => { if (e.target.value !== (s.ingreso || "")) guardarIngreso(s.barberId, e.target.value); }} className="ml-1 rounded-lg border border-gray-200 px-2 py-1 text-xs" />
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}

      {resueltas.length > 0 && (
        <details className="rounded-2xl border border-gray-100 bg-white">
          <summary className="cursor-pointer p-4 text-sm font-medium text-brand-gray">Últimas solicitudes resueltas ({resueltas.length})</summary>
          <ul className="divide-y border-t">
            {resueltas.map((s: any) => (
              <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm text-brand-gray">
                <span>{nombre(s.barber_id)} · {fmt(s.start_date)} – {fmt(s.end_date)}</span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${ESTADO[s.status]?.c || ""}`}>{ESTADO[s.status]?.t || s.status}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
