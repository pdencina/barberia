import { isValidReportDate } from "./informe-diario";

interface Identity { userId: string; role: string; tenantId: string | null }
type Guard = { ok: false; response: Response } | ({ ok: true } & Identity);
export interface DependenciasPreferenciasInforme {
  autorizar: () => Promise<Guard>;
  crearBase: () => any;
}
const TABLE = "agent_admin_report_preferences";
const FIELDS = ["enabled", "frequency", "custom_weekdays", "weekly_weekday", "anchor_date", "send_local_time", "effective_from"] as const;
const SELECT = ["profile_id", "tenant_id", ...FIELDS, "revision"].join(",");
type Settings = {
  enabled: boolean; frequency: string; custom_weekdays: number[];
  weekly_weekday: number | null; anchor_date: string | null;
  send_local_time: string | null; effective_from: string | null;
};
const defaults = (): Settings => ({ enabled: false, frequency: "daily", custom_weekdays: [], weekly_weekday: null, anchor_date: null, send_local_time: null, effective_from: null });
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
const error = (message: string, status: number) => json({ error: message }, status);
const migration = () => json({ error: "Falta aplicar la migración", enabled: false }, 503);
const missing = (e: any) => ["42P01", "42703", "PGRST205", "PGRST204"].includes(e?.code);
const uuid = (v: unknown): v is string => typeof v === "string" && /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(v);

// No correo ni campos de identidad/revisión/timestamps en el whitelist de escritura.
function validate(s: Settings): string | null {
  if (typeof s.enabled !== "boolean") return "enabled debe ser booleano";
  if (!["daily", "every_3_days", "weekly", "custom"].includes(s.frequency)) return "Frecuencia inválida";
  if (!Array.isArray(s.custom_weekdays) || s.custom_weekdays.some(d => !Number.isInteger(d) || d < 0 || d > 6) || new Set(s.custom_weekdays).size !== s.custom_weekdays.length) return "Días inválidos: usa 0 a 6 sin repetidos";
  if (s.weekly_weekday !== null && (!Number.isInteger(s.weekly_weekday) || s.weekly_weekday < 0 || s.weekly_weekday > 6)) return "Día semanal inválido";
  if (s.frequency !== "weekly" && s.weekly_weekday !== null) return "El día semanal solo se usa en frecuencia semanal";
  if (s.frequency !== "custom" && s.custom_weekdays.length > 0) return "Los días personalizados solo se usan en frecuencia personalizada";
  for (const name of ["effective_from", "anchor_date"] as const) {
    if (s[name] !== null && !isValidReportDate(s[name])) return `${name}: fecha inválida; usa YYYY-MM-DD`;
  }
  if (s.send_local_time !== null && (typeof s.send_local_time !== "string" || !/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(s.send_local_time))) return "Hora inválida; usa HH:mm o HH:mm:ss";
  if (s.enabled) {
    if (!s.effective_from || !s.send_local_time) return "Para activar indica effective_from y send_local_time";
    if (s.frequency === "every_3_days" && !s.anchor_date) return "Para activar cada 3 días indica anchor_date";
    if (s.frequency === "weekly" && s.weekly_weekday === null) return "Para activar semanal indica weekly_weekday";
    if (s.frequency === "custom" && s.custom_weekdays.length === 0) return "Para activar personalizada elige al menos un día";
  }
  return null;
}
function settings(row: any): Settings {
  const result = defaults();
  for (const key of FIELDS) if (row && Object.prototype.hasOwnProperty.call(row, key)) (result as any)[key] = row[key];
  return result;
}

// El guard real es requireRole; las dependencias permiten pruebas sin red/base/sesión real.
export function crearManejadoresPreferenciasInforme(deps: DependenciasPreferenciasInforme) {
  async function handle(req: Request, write: boolean): Promise<Response> {
    try {
      const g = await deps.autorizar();
      if (!g.ok) return g.response;
      if (!g.userId) return error("No autenticado", 401);
      if (!["admin", "super_admin"].includes(g.role)) return error("No autorizado", 403);
      const url = new URL(req.url);
      if (write) {
        const origin = req.headers.get("origin");
        if (req.headers.get("sec-fetch-site") === "cross-site" || (origin !== null && origin !== url.origin)) return error("Origen no autorizado", 403);
      }
      let invalidQuery = false;
      url.searchParams.forEach((_, key) => {
        if (!["profileId", "tenantId"].includes(key) || url.searchParams.getAll(key).length !== 1) invalidQuery = true;
      });
      if (invalidQuery) return error("Parámetros no permitidos", 400);
      let profileId: string, tenantId: string;
      if (g.role === "admin") {
        // Identidad siempre de sesión: ni siquiera una query puede seleccionar otra fila.
        if (url.searchParams.has("profileId") || url.searchParams.has("tenantId")) return error("Solo puedes gestionar tu propia preferencia", 403);
        if (!uuid(g.userId) || !uuid(g.tenantId)) return error("Negocio de sesión inválido", 403);
        profileId = g.userId; tenantId = g.tenantId;
      } else {
        const requestedProfile = url.searchParams.get("profileId");
        const requestedTenant = url.searchParams.get("tenantId");
        if (!uuid(requestedProfile) || !uuid(requestedTenant)) return error("Indica profileId y un tenantId concreto; ALL no está permitido", 400);
        profileId = requestedProfile; tenantId = requestedTenant;
      }
      let body: Record<string, unknown> = {};
      if (write) {
        try { body = await req.json(); } catch { return error("JSON inválido", 400); }
        if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).length === 0 || Object.keys(body).some(k => !(FIELDS as readonly string[]).includes(k))) return error("Campos no permitidos; solo preferencias, nunca correo, identidad ni revisión", 400);
      }
      const db = deps.crearBase();
      const profile = await db.from("profiles").select("id,tenant_id,role,active").eq("id", profileId).eq("tenant_id", tenantId).maybeSingle();
      if (profile.error) return error("No se pudo validar el perfil", 500);
      if (!profile.data || profile.data.id !== profileId || profile.data.tenant_id !== tenantId || profile.data.role !== "admin" || profile.data.active !== true) return error("Administrador activo no autorizado en ese negocio", 403);
      const current = await db.from(TABLE).select(SELECT).eq("profile_id", profileId).eq("tenant_id", tenantId).maybeSingle();
      if (current.error) return missing(current.error) ? migration() : error("No se pudo leer la preferencia", 500);
      if (current.data && (current.data.profile_id !== profileId || current.data.tenant_id !== tenantId)) return error("Preferencia no autorizada", 403);
      if (!write) return json({ preference: { profile_id: profileId, tenant_id: tenantId, ...settings(current.data), revision: current.data?.revision ?? null } });

      const next = settings(current.data);
      for (const key of FIELDS) if (Object.prototype.hasOwnProperty.call(body, key)) (next as any)[key] = body[key];
      const problem = validate(next);
      if (problem) return error(problem, 400);
      let result;
      if (current.data) {
        // Evita que dos lecturas previas pisen una baja/cambio concurrente.
        if (!Number.isSafeInteger(current.data.revision) || current.data.revision < 1) return error("Revisión de preferencia inválida", 409);
        result = await db.from(TABLE).update(next).eq("profile_id", profileId).eq("tenant_id", tenantId).eq("revision", current.data.revision).select(SELECT).maybeSingle();
      } else {
        result = await db.from(TABLE).insert({ profile_id: profileId, tenant_id: tenantId, ...next }).select(SELECT).maybeSingle();
      }
      if (result.error) {
        if (missing(result.error)) return migration();
        if (result.error.code === "23505") return error("La preferencia cambió; vuelve a cargarla", 409);
        return error("No se pudo guardar la preferencia", 500);
      }
      if (!result.data) return error("La preferencia cambió; vuelve a cargarla", 409);
      if (result.data.profile_id !== profileId || result.data.tenant_id !== tenantId) return error("Preferencia no autorizada", 403);
      return json({ preference: { profile_id: profileId, tenant_id: tenantId, ...settings(result.data), revision: result.data.revision } });
    } catch {
      // Nunca serializar excepciones de base, cuerpos ni datos de perfiles en logs.
      return error("No se pudo procesar la preferencia", 500);
    }
  }
  return { GET: (req: Request) => handle(req, false), PUT: (req: Request) => handle(req, true) };
}
