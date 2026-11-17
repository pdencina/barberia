"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Spinner } from "@/components/ui/spinner";
import { CalendarioSolicitud, resumenBloque } from "@/components/vacaciones/calendario-solicitud";
import { validarSolicitud, type Rango } from "@/lib/vacation-rules";

const fmt = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("es-CL", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" });
const ESTADO: Record<string, { t: string; c: string }> = {
  pending: { t: "Pendiente", c: "bg-amber-100 text-amber-700" },
  approved: { t: "Aceptada", c: "bg-emerald-100 text-emerald-700" },
  rejected: { t: "No aceptada", c: "bg-red-100 text-red-600" },
  cancelled: { t: "Cancelada", c: "bg-gray-100 text-gray-500" },
};

// Vista del profesional: calendario para pedir vacaciones (siempre desde un lunes, un solo bloque corrido) y sus solicitudes.
export function VistaProfesional() {
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [inicio, setInicio] = useState<string | null>(null);
  const [fin, setFin] = useState<string | null>(null);
  const [nota, setNota] = useState("");
  const [enviando, setEnviando] = useState(false);

  const cargar = async () => {
    const r = await fetch("/api/vacaciones/solicitudes", { cache: "no-store" });
    const d = await r.json().catch(() => ({}));
    setData(r.ok ? d : { error: d?.error || "No se pudo cargar" });
    setLoading(false);
  };
  useEffect(() => { cargar(); }, []);

  if (loading) return <Spinner />;
  if (!data || data.error) return <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{data?.error || "No se pudo cargar"}</p>;
  if (data.migracionFalta) return <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">Falta aplicar la migración 171 en la base de datos.</p>;
  if (!data.prefs?.diasPorAnio) return <p className="rounded-2xl border border-gray-100 bg-white p-5 text-sm text-brand-gray">Tu administrador todavía no activó las solicitudes de vacaciones. Cuando lo haga, podrás pedirlas desde aquí.</p>;

  const { saldo, trabaja, hoy } = data;
  const bloqueados: Rango[] = data.bloqueados || [];
  const resumen = resumenBloque(trabaja, inicio, fin);
  const chequeo = inicio && fin ? validarSolicitud({ hoy, inicio, fin, trabaja, diasAnio: data.prefs.diasPorAnio, modo: data.prefs.modo, ingreso: data.ingreso, ocupados: bloqueados }) : null;

  const enviar = async () => {
    if (!inicio || !fin) return;
    setEnviando(true);
    try {
      const res = await fetch("/api/vacaciones/solicitudes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ startDate: inicio, endDate: fin, note: nota }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d?.error || "No se pudo enviar");
      showToast("Solicitud enviada. Tu administrador la revisará.", "success");
      setInicio(null); setFin(null); setNota("");
      cargar();
    } catch (e: any) { showToast(e?.message || "No se pudo enviar", "error"); }
    finally { setEnviando(false); }
  };

  const cancelar = async (id: string) => {
    const ok = await confirm({ title: "Cancelar solicitud", message: "Se retira esta solicitud de vacaciones.", confirmText: "Cancelar solicitud", variant: "warning" });
    if (!ok) return;
    const res = await fetch("/api/vacaciones/solicitudes", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, action: "cancel" }) });
    if (!res.ok) { showToast("No se pudo cancelar", "error"); return; }
    cargar();
  };

  return (
    <div className="space-y-3 md:space-y-4">
      <div className="rounded-2xl bg-gradient-to-br from-[#0F8B8D] to-[#0a6b6d] p-5 text-white">
        <p className="text-sm opacity-80">Tus días de vacaciones ({fmt(saldo.periodo.desde)} al {fmt(saldo.periodo.hasta)})</p>
        <p className="mt-1 text-3xl font-bold">{saldo.restantes} <span className="text-base font-medium opacity-80">de {saldo.derecho} días laborales disponibles</span></p>
        <p className="mt-1 text-xs opacity-70">Cuentan solo los días en que trabajas: tus días libres no se descuentan. Las vacaciones siempre empiezan un lunes y son un solo bloque corrido.</p>
      </div>

      <div className="space-y-2">
        <h2 className="font-bold text-brand-dark">Pedir vacaciones</h2>
        <p className="text-xs text-brand-gray">1) Toca el lunes en que empiezan. 2) Toca el último día. Para tomarlas en dos partes (por ejemplo 5 y 5), envía una solicitud por cada una.</p>
        <CalendarioSolicitud hoy={hoy} trabaja={trabaja} bloqueados={bloqueados} inicio={inicio} fin={fin} onChange={(a, b) => { setInicio(a); setFin(b); }} />
        {resumen && (
          <div className="rounded-xl border border-gray-100 bg-white p-3 text-sm">
            <p className="text-brand-dark"><b>{fmt(inicio!)}</b>{fin ? <> al <b>{fmt(fin)}</b></> : " (elige el último día)"}</p>
            {fin && <p className="text-xs text-brand-gray">{resumen.corridos} días corridos · <b>{resumen.laborales} días laborales</b> (los que se descuentan)</p>}
            {chequeo && !chequeo.ok && <p className="mt-1 text-xs font-medium text-red-600">{chequeo.error}</p>}
          </div>
        )}
        <input value={nota} onChange={(e) => setNota(e.target.value)} maxLength={200} placeholder="Nota para tu administrador (opcional)" className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" />
        <button type="button" onClick={enviar} disabled={enviando || !inicio || !fin || !chequeo?.ok} className="w-full rounded-xl bg-brand-blue py-2.5 text-sm font-medium text-white disabled:opacity-50">
          {enviando ? "Enviando…" : "Enviar solicitud"}
        </button>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white">
        <div className="border-b p-4"><h2 className="font-bold text-brand-dark">Mis solicitudes</h2></div>
        {(data.solicitudes || []).length === 0 ? <p className="p-6 text-center text-sm text-brand-gray">Todavía no has pedido vacaciones.</p> : (
          <ul className="divide-y">
            {data.solicitudes.map((s: any) => (
              <li key={s.id} className="flex items-start justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-brand-dark">{fmt(s.start_date)} – {fmt(s.end_date)}</p>
                  <p className="text-xs text-brand-gray">{s.working_days} día(s) laborales{s.note ? ` · ${s.note}` : ""}</p>
                  {s.decision_note && <p className="mt-0.5 text-xs text-brand-gray">Respuesta: {s.decision_note}</p>}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${ESTADO[s.status]?.c || ""}`}>{ESTADO[s.status]?.t || s.status}</span>
                  {s.status === "pending" && <button type="button" onClick={() => cancelar(s.id)} className="text-[11px] text-red-500 underline">Cancelar</button>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
