import { decidirInforme, type PreferenciaCalendarioInforme } from "./calendario-informe";
import type { DailyAppointmentReport } from "./informe-diario";
import type { ResultadoEnvioInforme } from "./informe-diario-email";
import { verifyCron } from "@/lib/cron-auth";

// INFERENCIA para Nico (IA5): propuesta operativa, no cuota ni garantía de duración.
export const MAX_ENVIOS_POR_EJECUCION = 20;
const PURPOSE = "informe-admin-v1";
export interface PreferenciaProgramada extends PreferenciaCalendarioInforme { profile_id: string; tenant_id: string; revision: number }
interface Perfil { id: string; tenant_id: string; role: string; active: boolean; email: string }
interface Negocio { id: string; name: string }
type EstadoFinal = "aceptado_proveedor" | "fallido" | "incierto";
export interface RepositorioInformeProgramado {
  preferencias: () => Promise<PreferenciaProgramada[]>;
  procesandoAnteriores: (inicio: number) => Promise<number>;
  ultimaInformada: (p: PreferenciaProgramada) => Promise<string | null>;
  existe: (p: PreferenciaProgramada, fecha: string) => Promise<boolean>;
  reclamar: (p: PreferenciaProgramada, fecha: string, ahora: number) => Promise<string | null>;
  perfil: (p: PreferenciaProgramada) => Promise<Perfil | null>;
  negocio: (p: PreferenciaProgramada) => Promise<Negocio | null>;
  preferencia: (p: PreferenciaProgramada) => Promise<PreferenciaProgramada | null>;
  finalizar: (p: PreferenciaProgramada, id: string, estado: EstadoFinal, ahora: number, proveedor?: string | null) => Promise<void>;
}
export interface DependenciasInformeProgramado {
  repo: RepositorioInformeProgramado;
  ahora: () => number;
  generar: (tenantId: string, nombre: string, fecha: string) => Promise<DailyAppointmentReport>;
  enviar: (report: DailyAppointmentReport, correo: string, ahora: number) => Promise<ResultadoEnvioInforme>;
}
export class MigracionInformePendiente extends Error {
  constructor() { super("Falta aplicar la migración"); }
}
const respuesta = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
const conteos = (dryRun: boolean) => ({ processed: 0, enviados: 0, omitidos_calendario: 0, fallidos: 0, inciertos: 0, ya_reclamados: 0, procesando_antiguos: 0, candidatos: 0, dryRun });
const correoValido = (s: unknown): s is string => typeof s === "string" && s.length <= 254 && !/[\u0000-\u001f\u007f]/.test(s) && /^[^\s@<>;,]+@[^\s@<>;,]+\.[^\s@<>;,]+$/.test(s);

export function crearAutorizadorInformeProgramado(
  entorno: () => { CRON_SECRET?: string; NODE_ENV?: string } = () => process.env,
) {
  return async (req: Request): Promise<{ ok: true } | { ok: false; status: 401 | 503 }> => {
    const env = entorno();
    const denied = verifyCron(req, env);
    if (denied) return { ok: false, status: denied.status === 503 ? 503 : 401 };
    // verifyCron permite desarrollo sin secreto; aquí también dryRun requiere uno válido.
    return env.CRON_SECRET ? { ok: true } : { ok: false, status: 401 };
  };
}

export function crearManejadorInformeProgramado(options: {
  autorizar: (req: Request) => Promise<{ ok: true } | { ok: false; status: 401 | 503 }>;
  crearDependencias: () => DependenciasInformeProgramado;
}) {
  return async function GET(req: Request): Promise<Response> {
    const dryRun = new URL(req.url).searchParams.get("dryRun") === "1";
    const totals = conteos(dryRun);
    let guard;
    try { guard = await options.autorizar(req); } catch { return respuesta(totals, 503); }
    if (!guard.ok) return respuesta(totals, guard.status);
    // Nada de base/proveedor/reloj se construye antes del guard.
    try {
      const deps = options.crearDependencias();
      const { repo } = deps;
      const inicio = deps.ahora();
      const prefs = await repo.preferencias();
      totals.procesando_antiguos = await repo.procesandoAnteriores(inicio); // Comprueba 004 antes de enviar.
      let claimed = 0;
      for (const p of prefs) {
        if (claimed >= MAX_ENVIOS_POR_EJECUCION) break;
        totals.processed++;
        let claim: string | null = null;
        let proveedorInvocado = false;
        try {
          if (!p.profile_id || !p.tenant_id || p.tenant_id === "ALL" || !Number.isSafeInteger(p.revision) || p.revision < 1) throw new Error("Preferencia inválida");
          const last = await repo.ultimaInformada(p);
          const decision = decidirInforme(p, deps.ahora(), last);
          if (!decision.toca) { totals.omitidos_calendario++; continue; }
          if (dryRun) {
            if (await repo.existe(p, decision.fechaInformada)) { totals.ya_reclamados++; continue; }
          } else {
            claim = await repo.reclamar(p, decision.fechaInformada, deps.ahora());
            if (!claim) { totals.ya_reclamados++; continue; }
            claimed++;
          }
          const validar = async () => {
            const business = await repo.negocio(p);
            const current = await repo.preferencia(p);
            const profile = await repo.perfil(p); // Destinatario lo más cerca posible del envío.
            if (!profile || profile.id !== p.profile_id || profile.tenant_id !== p.tenant_id || profile.role !== "admin" || profile.active !== true || !correoValido(profile.email)
              || !business || business.id !== p.tenant_id || !current || current.profile_id !== p.profile_id || current.tenant_id !== p.tenant_id || current.enabled !== true || current.revision !== p.revision) return null;
            const now = deps.ahora();
            const fresh = decidirInforme(current, now, last);
            if (!fresh.toca || fresh.fechaInformada !== decision.fechaInformada) return null;
            return { profile, business, now };
          };
          const initial = await validar();
          if (!initial) {
            if (claim) await repo.finalizar(p, claim, "fallido", deps.ahora());
            totals.fallidos++; continue;
          }
          if (dryRun) { totals.candidatos++; claimed++; continue; }
          const report = await deps.generar(p.tenant_id, initial.business.name, decision.fechaInformada);
          if (report.tenantId !== p.tenant_id || report.date !== decision.fechaInformada) throw new Error("Informe no autorizado");
          // Revalidar DESPUÉS de generar: ni una baja ni el paso de medianoche quedan ocultos por la consulta.
          const fresh = await validar();
          if (!fresh || fresh.business.name !== initial.business.name) {
            await repo.finalizar(p, claim!, "fallido", deps.ahora());
            totals.fallidos++; continue;
          }
          totals.candidatos++;
          proveedorInvocado = true;
          const result = await deps.enviar(report, fresh.profile.email, fresh.now);
          const estado = result.estado === "aceptado" ? "aceptado_proveedor" : result.estado;
          try {
            await repo.finalizar(p, claim!, estado, deps.ahora(), result.estado === "aceptado" ? result.id : null);
          } catch {
            // Queda procesando para conciliación; nunca volver a enviar o borrar el reclamo.
            totals.inciertos++; continue;
          }
          if (result.estado === "aceptado") totals.enviados++;
          else if (result.estado === "fallido") totals.fallidos++;
          else totals.inciertos++;
        } catch (e) {
          if (e instanceof MigracionInformePendiente && totals.processed === 1 && !claim) return respuesta({ ...conteos(dryRun), motivo: "migracion_pendiente" });
          const estado = proveedorInvocado ? "incierto" : "fallido";
          if (claim) {
            try { await repo.finalizar(p, claim, estado, deps.ahora()); }
            catch { totals.inciertos++; continue; }
          }
          if (estado === "incierto") totals.inciertos++; else totals.fallidos++;
        }
      }
      return respuesta(totals);
    } catch (e) {
      return e instanceof MigracionInformePendiente
        ? respuesta({ ...conteos(dryRun), motivo: "migracion_pendiente" }) : respuesta(totals, 503);
    }
  };
}

// Adapter PostgREST. No conserva mensajes crudos de errores ni datos personales en logs.
export function crearRepositorioInformeProgramado(db: any): RepositorioInformeProgramado {
  const prefTable = "agent_admin_report_preferences", logTable = "agent_admin_report_deliveries";
  const prefFields = "profile_id,tenant_id,enabled,frequency,custom_weekdays,weekly_weekday,anchor_date,send_local_time,effective_from,revision";
  const timestamp = (ms: number) => new Date(ms).toISOString(); // Instante real UTC, NO fecha local del informe.
  const check = (r: any) => {
    if (r.error) {
      if (["42P01", "42703", "PGRST205", "PGRST204"].includes(r.error.code)) throw new MigracionInformePendiente();
      throw new Error("Operación de informe no disponible");
    }
    return r;
  };
  const scoped = (p: PreferenciaProgramada) => db.from(logTable).select("id").eq("tenant_id", p.tenant_id).eq("profile_id", p.profile_id).eq("purpose", PURPOSE);
  return {
    async preferencias() {
      // Patrón fetchAllRows, orden profile_id: esta tabla NO tiene columna id.
      const rows: PreferenciaProgramada[] = [];
      for (let from = 0; ; from += 1000) {
        const r = check(await db.from(prefTable).select(prefFields).eq("enabled", true).order("profile_id", { ascending: true }).range(from, from + 999));
        rows.push(...(r.data ?? []));
        if (!r.data || r.data.length < 1000) return rows;
      }
    },
    async procesandoAnteriores(inicio) {
      const r = check(await db.from(logTable).select("id", { count: "exact", head: true }).eq("purpose", PURPOSE).eq("status", "procesando").lt("started_at", timestamp(inicio)));
      if (typeof r.count !== "number") throw new Error("Conteo no disponible");
      return r.count;
    },
    async ultimaInformada(p) {
      const r = check(await db.from(logTable).select("report_date").eq("tenant_id", p.tenant_id).eq("profile_id", p.profile_id).eq("purpose", PURPOSE).eq("status", "aceptado_proveedor").order("report_date", { ascending: false }).limit(1).maybeSingle());
      return r.data?.report_date ?? null;
    },
    async existe(p, fecha) { return !!check(await scoped(p).eq("report_date", fecha).maybeSingle()).data; },
    async reclamar(p, fecha, ahora) {
      // Una petición INSERT ... ON CONFLICT DO NOTHING RETURNING id, nunca merge/update.
      const r = check(await db.from(logTable).upsert({ tenant_id: p.tenant_id, profile_id: p.profile_id, report_date: fecha, purpose: PURPOSE, status: "procesando", attempts: 1, started_at: timestamp(ahora) }, { onConflict: "profile_id,report_date,purpose", ignoreDuplicates: true }).select("id").maybeSingle());
      return r.data?.id ?? null;
    },
    async perfil(p) { return check(await db.from("profiles").select("id,tenant_id,role,active,email").eq("id", p.profile_id).eq("tenant_id", p.tenant_id).maybeSingle()).data; },
    async negocio(p) { return check(await db.from("tenants").select("id,name").eq("id", p.tenant_id).maybeSingle()).data; },
    async preferencia(p) { return check(await db.from(prefTable).select(prefFields).eq("tenant_id", p.tenant_id).eq("profile_id", p.profile_id).maybeSingle()).data; },
    async finalizar(p, id, estado, ahora, proveedor) {
      const patch = { status: estado, finished_at: timestamp(ahora), ...(estado === "aceptado_proveedor" ? { provider_accepted_at: timestamp(ahora), provider_message_id: proveedor ?? null } : {}) };
      const r = check(await db.from(logTable).update(patch).eq("id", id).eq("tenant_id", p.tenant_id).eq("profile_id", p.profile_id).eq("purpose", PURPOSE).eq("status", "procesando").select("id").maybeSingle());
      if (!r.data) throw new Error("Registro no actualizado");
    },
  };
}
