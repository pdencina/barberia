"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarClock, CalendarDays, Plane } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Spinner } from "@/components/ui/spinner";
import { CalendarioSolicitud, DesgloseDias, resumenBloque } from "@/components/vacaciones/calendario-solicitud";
import { diasLibresSemana, equivalencia, type Rango } from "@/lib/vacation-rules";

const fmt = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("es-CL", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" });
const corridos = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86400000) + 1;
const ESTADO: Record<string, { t: string; c: string }> = {
  pending: { t: "Pendiente", c: "bg-amber-100 text-amber-700" },
  approved: { t: "Aceptada", c: "bg-emerald-100 text-emerald-700" },
  rejected: { t: "No aceptada", c: "bg-red-100 text-red-600" },
  cancelled: { t: "Cancelada", c: "bg-gray-100 text-gray-500" },
};
const OPCIONES_DIAS = Array.from({ length: 30 }, (_, i) => i + 1);
const SEMANA = ["L", "M", "M", "J", "V", "S", "D"];
const card = "rounded-3xl border border-gray-100 bg-white shadow-sm";

function Titulo({ icono, t, sub }: { icono: React.ReactNode; t: string; sub?: string }) {
  return (
    <div className="flex items-start gap-3 border-b border-gray-50 p-4 md:p-5">
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-blue/10 text-brand-blue">{icono}</span>
      <div><h2 className="font-bold text-brand-dark">{t}</h2>{sub && <p className="text-xs text-brand-gray">{sub}</p>}</div>
    </div>
  );
}

// Vista del administrador: solicitudes por resolver, agregar vacaciones en un calendario, dias de cada profesional y preferencias.
export function VistaAdmin() {
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const [data, setData] = useState<any>(null);
  const [vacaciones, setVacaciones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dias, setDias] = useState<string>("");
  const [modo, setModo] = useState<"calendar" | "anniversary">("calendar");
  const [guardando, setGuardando] = useState(false);
  const [nota, setNota] = useState<Record<string, string>>({});
  // agregar vacaciones
  const [proId, setProId] = useState("");
  const [inicio, setInicio] = useState<string | null>(null);
  const [fin, setFin] = useState<string | null>(null);
  const [notaNueva, setNotaNueva] = useState("");
  const [agregando, setAgregando] = useState(false);

  const cargar = async () => {
    const [r, v] = await Promise.all([
      fetch("/api/vacaciones/solicitudes", { cache: "no-store" }),
      fetch("/api/vacaciones", { cache: "no-store" }).then((x) => x.json()).catch(() => ({ vacations: [] })),
    ]);
    const d = await r.json().catch(() => ({}));
    if (r.ok) { setData(d); setDias(d.prefs?.diasPorAnio ? String(d.prefs.diasPorAnio) : ""); setModo(d.prefs?.modo || "calendar"); if (!proId && d.saldos?.[0]) setProId(d.saldos[0].barberId); }
    else setData({ error: d?.error || "No se pudo cargar" });
    setVacaciones(v.vacations || []);
    setLoading(false);
  };
  useEffect(() => { cargar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const pro = useMemo(() => data?.saldos?.find((s: any) => s.barberId === proId), [data, proId]);

  if (loading) return <Spinner />;
  if (!data || data.error) return <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{data?.error || "No se pudo cargar"}</p>;
  if (data.migracionFalta) return <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">Falta aplicar la migración 171 en la base de datos.</p>;

  const hoy: string = data.hoy;
  const activo = !!data.prefs?.diasPorAnio;
  const nombre = (id: string) => data.saldos.find((s: any) => s.barberId === id)?.name || "Profesional";
  const trabajaDe = (id: string): boolean[] => data.saldos.find((s: any) => s.barberId === id)?.trabaja || [false, true, true, true, true, true, true];
  const pendientes = (data.solicitudes || []).filter((s: any) => s.status === "pending");
  const resueltas = (data.solicitudes || []).filter((s: any) => s.status !== "pending").slice(0, 10);
  const proximas = vacaciones.filter((v) => v.end_date >= hoy);
  const pasadas = vacaciones.filter((v) => v.end_date < hoy);
  const enCurso = proximas.filter((v) => v.start_date <= hoy).length;

  const guardarPrefs = async () => {
    setGuardando(true);
    try {
      const res = await fetch("/api/vacaciones/preferencias", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ diasPorAnio: dias ? Number(dias) : null, modo }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d?.error || "No se pudo guardar");
      showToast("Preferencias guardadas", "success"); cargar();
    } catch (e: any) { showToast(e?.message || "No se pudo guardar", "error"); }
    finally { setGuardando(false); }
  };

  const resolver = async (id: string, action: "approve" | "reject") => {
    const res = await fetch("/api/vacaciones/solicitudes", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, action, note: nota[id] || "" }) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { showToast(d?.error || "No se pudo resolver", "error"); cargar(); return; }
    showToast(action === "approve" ? (d.existingAppointments > 0 ? `Aceptada. Ojo: ya hay ${d.existingAppointments} cita(s) en esas fechas; muévelas o avísales.` : "Solicitud aceptada") : "Solicitud rechazada", action === "approve" && d.existingAppointments > 0 ? "error" : "success");
    cargar();
  };

  const agregar = async () => {
    if (!proId || !inicio || !fin) return;
    setAgregando(true);
    try {
      const res = await fetch("/api/vacaciones", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ barberId: proId, startDate: inicio, endDate: fin, note: notaNueva }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d?.error || "No se pudo guardar");
      showToast(d.existingAppointments > 0 ? `Vacaciones guardadas. Ojo: ya hay ${d.existingAppointments} cita(s) en esas fechas; muévelas o avísales.` : "Vacaciones guardadas", d.existingAppointments > 0 ? "error" : "success");
      setInicio(null); setFin(null); setNotaNueva(""); cargar();
    } catch (e: any) { showToast(e?.message || "No se pudo guardar", "error"); }
    finally { setAgregando(false); }
  };

  const quitar = async (v: any) => {
    const ok = await confirm({ title: "Quitar vacaciones", message: `${nombre(v.barber_id)} volverá a aparecer en la reserva online esos días.`, confirmText: "Quitar", variant: "warning" });
    if (!ok) return;
    const res = await fetch(`/api/vacaciones?id=${v.id}`, { method: "DELETE" });
    if (!res.ok) { showToast("No se pudo quitar", "error"); return; }
    cargar();
  };

  const guardarIngreso = async (barberId: string, ingreso: string) => {
    const res = await fetch("/api/vacaciones/preferencias", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ barberId, ingreso: ingreso || null }) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { showToast(d?.error || "No se pudo guardar", "error"); return; }
    showToast("Fecha de ingreso guardada", "success"); cargar();
  };

  const resumen = pro ? resumenBloque(pro.trabaja, inicio, fin) : null;
  const filaVacacion = (v: any) => {
    const c = corridos(v.start_date, v.end_date);
    const l = (resumenBloque(trabajaDe(v.barber_id), v.start_date, v.end_date)?.laborales) ?? c;
    return (
      <li key={v.id} className="flex items-center justify-between gap-3 p-4 md:px-5">
        <div className="min-w-0">
          <p className="font-medium text-brand-dark">{nombre(v.barber_id)}{v.start_date <= hoy && v.end_date >= hoy && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">en curso</span>}</p>
          <p className="text-sm text-brand-gray">{fmt(v.start_date)} – {fmt(v.end_date)}</p>
          <p className="text-xs text-brand-gray"><DesgloseDias compacto corridos={c} laborales={l} />{v.note ? ` · ${v.note}` : ""}</p>
        </div>
        <button type="button" onClick={() => quitar(v)} className="shrink-0 text-xs text-red-500 hover:underline">Quitar</button>
      </li>
    );
  };

  return (
    <div className="space-y-3 md:space-y-4">
      <div className="grid grid-cols-3 gap-2 md:gap-3">
        {[
          { t: "Por resolver", v: pendientes.length, c: pendientes.length > 0 ? "text-amber-600" : "text-brand-dark" },
          { t: "De vacaciones hoy", v: enCurso, c: "text-brand-dark" },
          { t: "Próximas", v: proximas.length - enCurso, c: "text-brand-dark" },
        ].map((x) => (
          <div key={x.t} className={`${card} p-3 text-center md:p-4`}><p className={`text-2xl font-bold md:text-3xl ${x.c}`}>{x.v}</p><p className="text-[11px] text-brand-gray">{x.t}</p></div>
        ))}
      </div>

      {activo && pendientes.length > 0 && (
        <div className={`${card} overflow-hidden ring-2 ring-amber-200`}>
          <Titulo icono={<CalendarClock className="h-5 w-5" />} t={`Solicitudes por resolver (${pendientes.length})`} sub="Tus profesionales las envían desde su sesión." />
          <ul className="divide-y divide-gray-50">
            {pendientes.map((s: any) => {
              const c = corridos(s.start_date, s.end_date);
              return (
                <li key={s.id} className="space-y-3 p-4 md:p-5">
                  <div>
                    <p className="font-semibold text-brand-dark">{nombre(s.barber_id)}</p>
                    <p className="text-sm text-brand-gray">Del {fmt(s.start_date)} al {fmt(s.end_date)}{s.note ? ` · “${s.note}”` : ""}</p>
                  </div>
                  <DesgloseDias corridos={c} laborales={s.working_days} />
                  <div className="flex flex-wrap items-center gap-2">
                    <input value={nota[s.id] || ""} onChange={(e) => setNota({ ...nota, [s.id]: e.target.value })} maxLength={200} placeholder="Comentario (opcional)" className="min-w-0 flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm" />
                    <button type="button" onClick={() => resolver(s.id, "reject")} className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-brand-gray hover:bg-gray-50">Rechazar</button>
                    <button type="button" onClick={() => resolver(s.id, "approve")} className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700">Aceptar</button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className={card}>
        <Titulo icono={<Plane className="h-5 w-5" />} t="Agregar vacaciones" sub="Las vacaciones siempre empiezan un lunes y son un solo bloque corrido." />
        <div className="space-y-3 p-4 md:p-5">
          <select value={proId} onChange={(e) => { setProId(e.target.value); setInicio(null); setFin(null); }} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm">
            {data.saldos.map((s: any) => <option key={s.barberId} value={s.barberId}>{s.name}</option>)}
          </select>
          {pro && (
            <>
              <CalendarioSolicitud hoy={hoy} trabaja={pro.trabaja} bloqueados={(pro.bloqueados || []) as Rango[]} inicio={inicio} fin={fin} onChange={(a, b) => { setInicio(a); setFin(b); }} />
              {resumen && fin && (
                <div className="space-y-2">
                  <p className="text-sm text-brand-dark"><b>{pro.name}</b>: del <b>{fmt(inicio!)}</b> al <b>{fmt(fin)}</b></p>
                  <DesgloseDias corridos={resumen.corridos} laborales={resumen.laborales} />
                  {activo && resumen.laborales > pro.restantes && <p className="text-xs font-medium text-amber-700">Ojo: son {resumen.laborales} días laborales y a {pro.name} le quedan {pro.restantes}. Tú puedes guardarlo igual.</p>}
                </div>
              )}
              <div className="flex gap-2">
                <input value={notaNueva} onChange={(e) => setNotaNueva(e.target.value)} placeholder="Nota (opcional)" maxLength={200} className="min-w-0 flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm" />
                <button type="button" onClick={agregar} disabled={agregando || !inicio || !fin} className="rounded-xl bg-brand-blue px-6 py-2 text-sm font-semibold text-white disabled:opacity-50">{agregando ? "Guardando…" : "Guardar"}</button>
              </div>
            </>
          )}
        </div>
      </div>

      {activo && (
        <div className={`${card} overflow-hidden`}>
          <Titulo icono={<CalendarDays className="h-5 w-5" />} t="Días de cada profesional" sub="Los días laborales son los que se descuentan; los días libres de cada uno también quedan fuera, pero no cuentan." />
          <ul className="divide-y divide-gray-50">
            {data.saldos.map((s: any) => {
              const eq = equivalencia(s.derecho, s.trabaja);
              const libres = diasLibresSemana(s.trabaja);
              return (
                <li key={s.barberId} className="space-y-2 p-4 md:p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold text-brand-dark">{s.name}</p>
                      <p className="text-[11px] text-brand-gray">{fmt(s.periodo.desde)} al {fmt(s.periodo.hasta)}</p>
                    </div>
                    <div className="text-right"><p className="text-sm font-bold text-brand-dark">{s.usados} de {s.derecho} días</p><p className="text-[11px] text-brand-gray">le quedan {s.restantes}</p></div>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-brand-blue" style={{ width: `${s.derecho > 0 ? Math.min(100, (s.usados / s.derecho) * 100) : 0}%` }} /></div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1" title={libres.length ? `Días libres: ${libres.join(", ")}` : "Trabaja todos los días"}>
                      {SEMANA.map((d, i) => { const idx = i === 6 ? 0 : i + 1; return <span key={i} className={`flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-bold ${s.trabaja[idx] ? "bg-brand-blue/15 text-brand-blue" : "bg-gray-100 text-gray-400 line-through"}`}>{d}</span>; })}
                      <span className="ml-1 text-[11px] text-brand-gray">{libres.length ? `libre: ${libres.join(", ")}` : "sin días libres"}</span>
                    </div>
                    <label className="text-[11px] text-brand-gray">Ingreso
                      <input type="date" defaultValue={s.ingreso || ""} onBlur={(e) => { if (e.target.value !== (s.ingreso || "")) guardarIngreso(s.barberId, e.target.value); }} className="ml-1 rounded-lg border border-gray-200 px-2 py-1 text-xs" />
                    </label>
                  </div>
                  {eq.corridos > 0 && <p className="rounded-xl bg-brand-blue/5 px-3 py-2 text-xs text-brand-dark">{s.derecho} días laborales = <b>{eq.semanas} {eq.semanas === 1 ? "semana" : "semanas"} fuera ({eq.corridos} días corridos)</b>, porque trabaja {eq.porSemana} días a la semana.</p>}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className={`${card} overflow-hidden`}>
        <Titulo icono={<Plane className="h-5 w-5" />} t={`Próximas y en curso (${proximas.length})`} />
        {proximas.length === 0 ? <p className="p-6 text-center text-sm text-brand-gray">No hay vacaciones programadas.</p> : <ul className="divide-y divide-gray-50">{proximas.map(filaVacacion)}</ul>}
      </div>

      {(pasadas.length > 0 || resueltas.length > 0) && (
        <details className={card}>
          <summary className="cursor-pointer p-4 text-sm font-medium text-brand-gray md:px-5">Historial ({pasadas.length + resueltas.length})</summary>
          <ul className="divide-y border-t border-gray-50">
            {pasadas.map((v) => <li key={v.id} className="px-4 py-3 text-sm text-brand-gray md:px-5">{nombre(v.barber_id)} · {fmt(v.start_date)} – {fmt(v.end_date)}</li>)}
            {resueltas.map((s: any) => (
              <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm text-brand-gray md:px-5">
                <span>{nombre(s.barber_id)} · {fmt(s.start_date)} – {fmt(s.end_date)}</span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${ESTADO[s.status]?.c || ""}`}>{ESTADO[s.status]?.t || s.status}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      <details className={card} open={!activo}>
        <summary className="cursor-pointer p-4 text-sm font-bold text-brand-dark md:px-5">Preferencias de solicitudes {activo ? `· ${data.prefs.diasPorAnio} días por año` : "· apagadas"}</summary>
        <div className="space-y-3 border-t border-gray-50 p-4 md:p-5">
          <p className="text-xs text-brand-gray">Tus profesionales piden sus vacaciones desde su sesión, en un calendario. Solo se descuentan los días en que cada uno trabaja.</p>
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
                <option value="anniversary">En el aniversario de su ingreso (año de servicio)</option>
              </select>
            </div>
          </div>
          <p className="text-[11px] text-brand-gray">Un profesional que ingresa durante el año parte automáticamente: con reinicio el 1 de enero recibe la parte proporcional de los meses que le quedan; con aniversario, parte con el año completo desde su ingreso. Los que ya llevan más de un año tienen todos sus días desde enero.</p>
          <button type="button" onClick={guardarPrefs} disabled={guardando} className="rounded-xl bg-brand-blue px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">{guardando ? "Guardando…" : "Guardar preferencias"}</button>
        </div>
      </details>
    </div>
  );
}
