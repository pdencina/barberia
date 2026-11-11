import { createAdminSupabase } from "@/lib/supabase/server";

// Totem de autoatencion: utilidades compartidas por las rutas publicas /api/totem/*.
// El totem NO tiene sesion: solo ve datos minimos (primer nombre, hora, servicio) de las citas de HOY del negocio.

export const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin O/0/I/1 para no confundirse

// "k7m-4" / " k7m4 " -> "K7M4". Mapea las confusiones tipicas (O->nada, I/L->nada) simplemente descartando lo que no es del alfabeto.
export function normalizarCodigo(raw: unknown): string {
  return String(raw ?? "").toUpperCase().split("").filter((c) => CODE_ALPHABET.includes(c)).join("").slice(0, 5);
}

// Codigo del negocio (7 caracteres del mismo alfabeto).
export function normalizarCodigoNegocio(raw: unknown): string {
  return String(raw ?? "").toUpperCase().split("").filter((c) => CODE_ALPHABET.includes(c)).join("").slice(0, 7);
}
export function generarCodigoNegocio(): string {
  let c = "";
  for (let i = 0; i < 7; i++) c += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  return c;
}

export function hoyChile(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

// MODO PRUEBAS (10 nov 2026, a pedido de Nico): el tótem también encuentra citas de los próximos 30 días, no solo las de hoy.
// Para volver a la regla real (solo citas de HOY), poner false.
export const TOTEM_PRUEBAS_OTRO_DIA = true;

// Limita una consulta de citas al día que corresponde (hoy; en modo pruebas, hoy y los próximos 30 días).
export function soloDiaDelTotem(q: any): any {
  const hoy = hoyChile();
  if (!TOTEM_PRUEBAS_OTRO_DIA) return q.eq("date", hoy);
  const hasta = new Date(`${hoy}T12:00:00Z`); hasta.setUTCDate(hasta.getUTCDate() + 30);
  return q.gte("date", hoy).lte("date", hasta.toISOString().slice(0, 10));
}

export function primerNombre(n: string | null | undefined): string {
  return String(n || "").trim().split(/\s+/)[0] || "";
}

export function soloDigitos(s: unknown): string {
  return String(s ?? "").replace(/\D/g, "");
}

// Celular chileno: ultimos 9 digitos (9XXXXXXXX). Devuelve null si no calza.
export function celular9(s: unknown): string | null {
  const d = soloDigitos(s);
  const n = d.length >= 9 ? d.slice(-9) : d;
  return /^9\d{8}$/.test(n) ? n : null;
}

// Limitador simple por IP+accion (en memoria; basta para frenar adivinar codigos desde un mismo lugar).
const golpes = new Map<string, number[]>();
export function demasiadosIntentos(clave: string, max = 20, ventanaMs = 60_000): boolean {
  const ahora = Date.now();
  const lista = (golpes.get(clave) || []).filter((t) => ahora - t < ventanaMs);
  lista.push(ahora);
  golpes.set(clave, lista);
  if (golpes.size > 5000) golpes.clear();
  return lista.length > max;
}

export function ipDe(req: Request): string {
  return (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "local";
}

// Negocio por slug con el totem encendido. Devuelve null si no existe, esta suspendido o no activó el totem.
export async function negocioDelTotem(supabase: ReturnType<typeof createAdminSupabase>, codigo: unknown) {
  const s = normalizarCodigoNegocio(codigo);
  if (s.length !== 7) return null;
  const cols = "id, name, slug, logo_url, phone, active, status, kiosk_enabled, kiosk_unlocked, kiosk_info";
  const q = (extra: string) => supabase.from("tenants").select(`${cols}${extra}`).eq("kiosk_code", s).eq("active", true).maybeSingle();
  let r: { data: any; error: any } = await q(", kiosk_pay_qr_enabled, kiosk_terminal_enabled");
  if (r.error) r = await q(", kiosk_pay_qr_enabled"); // migración 168 aún no aplicada
  if (r.error) r = await q(""); // migración 165 aún no aplicada
  const data = r.data;
  if (!data || (data as any).status === "suspended" || !(data as any).kiosk_enabled || !(data as any).kiosk_unlocked) return null; // servicio aparte: debe estar desbloqueado Y encendido
  return data as any;
}

export interface SeccionInfo { title: string; body: string }
export function limpiarSecciones(raw: unknown): SeccionInfo[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((x: any) => ({ title: String(x?.title ?? "").trim().slice(0, 60), body: String(x?.body ?? "").trim().slice(0, 600) }))
    .filter((x) => x.title && x.body)
    .slice(0, 8);
}

// Evita avisos repetidos al equipo: si el cliente aprieta lo mismo varias veces, se avisa UNA vez. Se apoya en audit_log (queda
// guardado, así que sirve aunque cada llamada la atienda otra instancia del servidor). Si audit_log falla, se avisa igual (mejor repetir que callar).
export async function avisoReciente(supabase: any, tenantId: string, clave: string, minutos: number): Promise<boolean> {
  try {
    const desde = new Date(Date.now() - minutos * 60_000).toISOString();
    const { data, error } = await supabase.from("audit_log").select("id").eq("action", "kiosk_aviso").eq("entity_id", tenantId).eq("metadata->>clave", clave).gte("created_at", desde).limit(1).maybeSingle();
    return !error && !!data;
  } catch { return false; }
}

export async function registrarAviso(supabase: any, tenantId: string, clave: string): Promise<void> {
  try {
    await supabase.from("audit_log").insert({ action: "kiosk_aviso", entity_type: "tenant", entity_id: tenantId, description: "Aviso del tótem al equipo", metadata: { clave } });
  } catch { /* sin auditoría no se frena el aviso */ }
}
