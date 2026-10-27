import { parseWallClock } from "../wallclock";
import { apptDayLabel, apptNoticeUrl } from "../appt-link";
import { obtenerFechaHoraInforme } from "./calendario-informe";
import type { NotifyInput } from "../notify";

export const PROPOSITO_RECORDATORIO_CITA = "recordatorio-cita-v1";
export type MotivoAccionCita = "ok" | "ya_estaba" | "fuera_de_plazo" | "estado_no_permitido" | "no_encontrada";
export interface ResultadoAccionCita { motivo: MotivoAccionCita }
// Contexto resuelto por el servidor después de autenticar al remitente. Nunca usar ids del texto recibido.
export interface ContextoAccionCita { tenantId: string; clienteId: string; referenciaRecordatorio: string }
export interface CitaAccion {
  id: string; tenant_id: string; client_id: string; status: string;
  date: string; start_time: string; barber_id: string | null;
  client?: { name: string | null } | { name: string | null }[] | null;
}
export interface RepositorioAccionesCita {
  desdeRecordatorio: (contexto: ContextoAccionCita) => Promise<CitaAccion | null>;
  // CAS: debe incluir tenant, cliente, id, estado Y horario leídos. Devuelve false si cambió la fila.
  transicionar: (cita: CitaAccion, estado: "confirmed" | "cancelled") => Promise<boolean>;
}
export interface DependenciasAccionesCita {
  repo: RepositorioAccionesCita;
  ahora: () => number;
  notificar?: (input: NotifyInput) => Promise<unknown>;
}
export class MigracionAccionesCitaPendiente extends Error {
  constructor() { super("Falta aplicar la migración 005"); }
}
const resultado = (motivo: MotivoAccionCita): ResultadoAccionCita => ({ motivo });
const propia = (c: CitaAccion | null, contexto: ContextoAccionCita): c is CitaAccion =>
  !!c && c.tenant_id === contexto.tenantId && c.client_id === contexto.clienteId;

// Ambas magnitudes son horas de pared chilenas. No interpretar start_time como instante real UTC.
function anticipacion(cita: CitaAccion, ahora: number): number {
  const chile = obtenerFechaHoraInforme(ahora);
  const segundos = chile.segundos % 60;
  const horaChile = `${chile.fecha}T${chile.hora}:${String(segundos).padStart(2, "0")}.${String(((ahora % 1000) + 1000) % 1000).padStart(3, "0")}Z`;
  return parseWallClock(cita.start_time).getTime() - parseWallClock(horaChile).getTime();
}
async function avisoCancelacion(c: CitaAccion, deps: DependenciasAccionesCita): Promise<void> {
  try {
    const hhmm = String(c.start_time || "").match(/(\d{2}:\d{2})/)?.[1] || "";
    const who = (Array.isArray(c.client) ? c.client[0]?.name : c.client?.name) || "Un cliente";
    const enviar = deps.notificar ?? (await import("../notify")).notify;
    // Mismo aviso que src/app/api/public/cancel/route.ts; solo el ganador del CAS lo emite.
    await enviar({
      tenantId: c.tenant_id, kind: "appointment_changed", professionalId: c.barber_id || null,
      userIds: c.barber_id ? [c.barber_id] : [], roles: ["admin", "receptionist"],
      title: "😕 Se canceló una cita",
      body: `${who} canceló${hhmm ? ` su hora del ${apptDayLabel(String(c.date))} a las ${hhmm}` : " su cita"}. El espacio quedó libre.`,
      url: apptNoticeUrl(c.id, String(c.date).slice(0, 10)),
    });
  } catch { /* La cita ya fue cancelada. No reintentar la transición ni registrar PII. */ }
}
async function ejecutar(contexto: ContextoAccionCita, deps: DependenciasAccionesCita, destino: "confirmed" | "cancelled"): Promise<ResultadoAccionCita> {
  if (!contexto.tenantId || contexto.tenantId === "ALL" || !contexto.clienteId || !contexto.referenciaRecordatorio) return resultado("no_encontrada");
  const cita = await deps.repo.desdeRecordatorio(contexto);
  if (!propia(cita, contexto)) return resultado("no_encontrada");
  const restante = anticipacion(cita, deps.ahora());
  if (!Number.isFinite(restante) || restante <= 0) return resultado("fuera_de_plazo");
  if (cita.status === destino) return resultado("ya_estaba");
  if (cita.status !== "scheduled" && !(destino === "cancelled" && cita.status === "confirmed")) return resultado("estado_no_permitido");
  if (destino === "cancelled" && restante < 2 * 60 * 60 * 1000) return resultado("fuera_de_plazo");
  if (!await deps.repo.transicionar(cita, destino)) {
    const actual = await deps.repo.desdeRecordatorio(contexto);
    return resultado(propia(actual, contexto) && actual.id === cita.id && actual.status === destino ? "ya_estaba" : "estado_no_permitido");
  }
  if (destino === "cancelled") await avisoCancelacion(cita, deps);
  return resultado("ok");
}
export function confirmarCitaPropia(contexto: ContextoAccionCita, deps: DependenciasAccionesCita): Promise<ResultadoAccionCita> {
  return ejecutar(contexto, deps, "confirmed");
}
export function cancelarCitaPropia(contexto: ContextoAccionCita, deps: DependenciasAccionesCita): Promise<ResultadoAccionCita> {
  return ejecutar(contexto, deps, "cancelled");
}

// Base inyectada; no crea clientes privilegiados, rutas ni conexiones por su cuenta.
export function crearRepositorioAccionesCita(db: any): RepositorioAccionesCita {
  const check = (r: any) => {
    if (r.error) {
      if (["42P01", "42703", "PGRST205", "PGRST204"].includes(r.error.code)) throw new MigracionAccionesCitaPendiente();
      throw new Error("Acción de cita no disponible");
    }
    return r;
  };
  return {
    async desdeRecordatorio(c) {
      const envio = check(await db.from("agent_reminder_deliveries").select("appointment_id")
        .eq("id", c.referenciaRecordatorio).eq("tenant_id", c.tenantId).eq("channel", "whatsapp")
        .eq("purpose", PROPOSITO_RECORDATORIO_CITA).eq("status", "aceptado_proveedor").maybeSingle()).data;
      if (!envio?.appointment_id) return null;
      return check(await db.from("appointments").select("id,tenant_id,client_id,status,date,start_time,barber_id,client:clients(name)")
        .eq("id", envio.appointment_id).eq("tenant_id", c.tenantId).eq("client_id", c.clienteId).maybeSingle()).data;
    },
    async transicionar(c, status) {
      return !!check(await db.from("appointments").update({ status }).eq("id", c.id).eq("tenant_id", c.tenant_id)
        .eq("client_id", c.client_id).eq("status", c.status).eq("start_time", c.start_time).eq("date", c.date)
        .select("id").maybeSingle()).data;
    },
  };
}
