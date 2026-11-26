// Aviso "no has respondido" y cancelación automática. Apagado por defecto (agent_whatsapp_settings.aviso_cancelacion_activo, migración 180).
// Ante cualquier duda NO se cancela: el aviso tiene que haber sido aceptado por Meta y el cliente no puede haber escrito nada.
import { parseWallClock } from "../wallclock";
import { apptDayLabel, apptNoticeUrl } from "../appt-link";
import type { NotifyInput } from "../notify";
import { tocaAvisar, tocaCancelar } from "./horario-confirmacion";
import { enHorarioDeSilencio } from "./horario-silencio";
import { paredMs, type CitaRecordatorio, type NegocioRecordatorios } from "./recordatorios-whatsapp";
import { hashContactoWhatsApp, normalizarTelefonoWhatsApp, type ResultadoEnvioPlantilla } from "./whatsapp-meta";
import { PROPOSITO_AVISO_CANCELACION, PROPOSITO_RECORDATORIO_CITA } from "./acciones-cita";

export const MAX_POR_PASADA = 20;
export interface CitaPendiente extends CitaRecordatorio { updated_at?: string | null; barber_id?: string | null; deposit_amount?: number | null; deposit_paid_at?: string | null }
export interface Envio { estado: string; aceptado: string | null }
export interface Pendiente { cita: CitaPendiente; confirmacion: Envio; aviso: Envio | null }
export interface RepoAviso {
  negocios: () => Promise<NegocioRecordatorios[]>;
  pendientes: (tenant: string, desdeIso: string, ahoraPared: string) => Promise<Pendiente[]>;
  respondio: (tenant: string, hash: string, desdeIso: string) => Promise<boolean>;
  baja: (tenant: string, hash: string) => Promise<boolean>;
  reclamarAviso: (c: CitaPendiente, ahora: number) => Promise<string | null>;
  finalizarAviso: (c: CitaPendiente, id: string, estado: "aceptado_proveedor" | "fallido" | "incierto", ahora: number, proveedor?: string) => Promise<void>;
  /** Solo cambia la cita si sigue pendiente y con el mismo horario. */
  cancelar: (c: CitaPendiente, ahora: number) => Promise<boolean>;
}
export interface DepsAviso {
  repo: RepoAviso; ahora: () => number; sal: string;
  consumirCuota: (tenant: string, citaId: string) => Promise<boolean>;
  enviar: (n: NegocioRecordatorios, c: CitaPendiente, para: string, limite: string) => Promise<ResultadoEnvioPlantilla>;
  notificar: (input: NotifyInput) => Promise<unknown>;
}

const hhmm = (ms: number) => new Date(ms).toISOString().slice(11, 16);

export async function procesarAvisos(deps: DepsAviso) {
  const totales = { avisos: 0, canceladas: 0, fallidos: 0 };
  if (!deps.sal.trim() || enHorarioDeSilencio(deps.ahora())) return totales;
  for (const n of await deps.repo.negocios()) {
    if (!n.enabled || !n.tenantId || !n.phoneNumberId) continue;
    const ahora = deps.ahora(), pared = paredMs(ahora)!;
    const filas = await deps.repo.pendientes(n.tenantId, new Date(ahora - 30 * 3600000).toISOString(), new Date(pared).toISOString());
    for (const { cita: c, confirmacion, aviso } of filas) {
      if (totales.avisos + totales.canceladas >= MAX_POR_PASADA) return totales;
      try {
        const para = normalizarTelefonoWhatsApp(c.client?.phone);
        const enviada = paredMs(confirmacion.aceptado), inicio = parseWallClock(c.start_time).getTime();
        if (c.tenant_id !== n.tenantId || c.client?.tenant_id !== n.tenantId || c.status !== "scheduled" || !para || enviada === null || confirmacion.estado !== "aceptado_proveedor") continue;
        // Con abono no se toca. Si la cita cambió después de la confirmación, tampoco: el cliente pudo recibir otra hora.
        if ((c.deposit_amount ?? 0) > 0 || c.deposit_paid_at) continue;
        if (c.updated_at && Date.parse(c.updated_at) > Date.parse(confirmacion.aceptado!) + 60000) continue;
        const hash = hashContactoWhatsApp(deps.sal, n.tenantId, para);
        const callado = async () => !await deps.repo.respondio(n.tenantId, hash, confirmacion.aceptado!) && !await deps.repo.baja(n.tenantId, hash);
        if (!aviso) {
          if (!tocaAvisar({ inicio, creada: paredMs(c.created_at), enviada }, pared) || !await callado()) continue;
          const id = await deps.repo.reclamarAviso(c, ahora);
          if (!id) continue;
          let invocado = false;
          try {
            if (!await deps.consumirCuota(n.tenantId, c.id)) { await deps.repo.finalizarAviso(c, id, "fallido", ahora); totales.fallidos++; continue; }
            invocado = true;
            const r = await deps.enviar(n, c, para, hhmm(pared + 3600000));
            await deps.repo.finalizarAviso(c, id, r.estado === "aceptado" ? "aceptado_proveedor" : r.estado, deps.ahora(), r.estado === "aceptado" ? r.id : undefined);
            if (r.estado === "aceptado") totales.avisos++; else totales.fallidos++;
          } catch {
            totales.fallidos++;
            await deps.repo.finalizarAviso(c, id, invocado ? "incierto" : "fallido", deps.ahora());
          }
          continue;
        }
        const avisada = paredMs(aviso.aceptado);
        if (aviso.estado !== "aceptado_proveedor" || avisada === null || !tocaCancelar({ inicio, avisada }, pared) || !await callado()) continue;
        if (!await deps.repo.cancelar(c, ahora)) continue;
        totales.canceladas++;
        try {
          await deps.notificar({
            tenantId: n.tenantId, kind: "appointment_changed", professionalId: c.barber_id || null,
            userIds: c.barber_id ? [c.barber_id] : [], roles: ["admin", "receptionist"],
            title: "Se canceló una cita sin confirmar",
            body: `${c.client?.name || "Un cliente"} no respondió la confirmación: se canceló su hora del ${apptDayLabel(String(c.date))} a las ${hhmm(inicio)}. El espacio quedó libre.`,
            url: apptNoticeUrl(c.id, String(c.date).slice(0, 10)),
          });
        } catch { /* la cita ya quedó cancelada */ }
      } catch { totales.fallidos++; }
    }
  }
  return totales;
}

export function repoAvisoDesdeBase(db: any): RepoAviso {
  const check = (r: any) => { if (r.error) throw new Error("Avisos no disponibles"); return r; };
  const tabla = "agent_reminder_deliveries";
  const iso = (ms: number) => new Date(ms).toISOString();
  const campos = "id,tenant_id,client_id,status,date,start_time,created_at,updated_at,barber_id,deposit_amount,deposit_paid_at,client:clients!client_id(id,tenant_id,name,email,phone),barber:profiles!barber_id(name),services:appointment_services(service:services(name))";
  return {
    async negocios() {
      const r = await db.from("agent_whatsapp_settings").select("tenant_id,phone_number_id,enabled")
        .eq("enabled", true).eq("confirmacion_activa", true).eq("aviso_cancelacion_activo", true);
      // Sin la migración 180 no hay interruptor: no se avisa ni se cancela.
      if (r.error && ["42703", "PGRST204"].includes(r.error.code)) return [];
      return (check(r).data ?? []).map((x: any) => ({ tenantId: x.tenant_id, phoneNumberId: x.phone_number_id, enabled: x.enabled === true }));
    },
    async pendientes(tenant, desde, ahoraPared) {
      const envios: any[] = check(await db.from(tabla).select(`appointment_id,status,provider_accepted_at,appointment:appointments!appointment_id!inner(${campos})`)
        .eq("tenant_id", tenant).eq("channel", "whatsapp").eq("purpose", PROPOSITO_RECORDATORIO_CITA).eq("status", "aceptado_proveedor")
        .gte("provider_accepted_at", desde).eq("appointment.tenant_id", tenant).eq("appointment.status", "scheduled").gt("appointment.start_time", ahoraPared)
        .order("provider_accepted_at").limit(500)).data ?? [];
      if (!envios.length) return [];
      const avisos: any[] = check(await db.from(tabla).select("appointment_id,status,provider_accepted_at").eq("tenant_id", tenant).eq("channel", "whatsapp")
        .eq("purpose", PROPOSITO_AVISO_CANCELACION).in("appointment_id", envios.map((e) => e.appointment_id))).data ?? [];
      const porCita = new Map(avisos.map((a) => [a.appointment_id, { estado: a.status, aceptado: a.provider_accepted_at }]));
      return envios.map((e) => ({ cita: e.appointment, confirmacion: { estado: e.status, aceptado: e.provider_accepted_at }, aviso: porCita.get(e.appointment_id) ?? null }));
    },
    async respondio(tenant, hash, desde) {
      return !!check(await db.from("agent_whatsapp_events").select("id").eq("tenant_id", tenant).eq("contact_hash", hash).gte("received_at", desde).limit(1)).data?.length;
    },
    async baja(tenant, hash) { return !!check(await db.from("agent_contact_optouts").select("id").eq("tenant_id", tenant).eq("contact_hash", hash).maybeSingle()).data; },
    async reclamarAviso(c, ahora) {
      return check(await db.from(tabla).upsert({ tenant_id: c.tenant_id, appointment_id: c.id, channel: "whatsapp", purpose: PROPOSITO_AVISO_CANCELACION, status: "procesando", attempts: 1, started_at: iso(ahora) },
        { onConflict: "appointment_id,channel,purpose", ignoreDuplicates: true }).select("id").maybeSingle()).data?.id ?? null;
    },
    async finalizarAviso(c, id, estado, ahora, proveedor) {
      check(await db.from(tabla).update({ status: estado, finished_at: iso(ahora), ...(estado === "aceptado_proveedor" ? { provider_message_id: proveedor ?? null, provider_accepted_at: iso(ahora) } : {}) })
        .eq("tenant_id", c.tenant_id).eq("id", id).eq("status", "procesando"));
    },
    async cancelar(c, ahora) {
      return !!check(await db.from("appointments").update({ status: "cancelled", cancelled_by: "system", cancel_channel: "sin_confirmar", cancelled_at: iso(ahora) })
        .eq("id", c.id).eq("tenant_id", c.tenant_id).eq("status", "scheduled").eq("start_time", c.start_time).eq("date", c.date).select("id").maybeSingle()).data;
    },
  };
}
