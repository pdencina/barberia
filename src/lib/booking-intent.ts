import { randomUUID } from "crypto";

// Datos de una reserva en espera de pago. Mercado Pago limita la referencia del pago a 256 caracteres, asi que los datos viven en
// nuestra base (booking_intents) y a Mercado Pago solo se le manda la referencia corta. Si aun no esta la migracion 133, se usa el
// formato antiguo (todo dentro de la referencia), que funciona solo si cabe.
export const MAX_REFERENCIA_MP = 256;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function guardarIntento(supabase: any, tenantId: string, data: Record<string, unknown>): Promise<string> {
  const ref = randomUUID();
  const { error } = await supabase.from("booking_intents").insert({ ref, tenant_id: tenantId, data });
  if (!error) return ref;
  const legado = JSON.stringify(data);
  if (legado.length <= MAX_REFERENCIA_MP) return legado; // sin la migracion: sirve solo si cabe
  throw new Error("No se pudo guardar la reserva en espera de pago (falta aplicar la migración 133).");
}

// Lee la referencia que devuelve Mercado Pago: id corto (nuevo) o JSON completo (antiguo).
export async function leerIntento(supabase: any, referencia: string | null | undefined): Promise<Record<string, any> | null> {
  const raw = String(referencia ?? "").trim();
  if (!raw) return null;
  if (UUID.test(raw)) {
    const { data } = await supabase.from("booking_intents").select("data").eq("ref", raw).maybeSingle();
    return (data?.data as Record<string, any>) || null;
  }
  try { const j = JSON.parse(raw); return j && typeof j === "object" ? j : null; } catch { return null; }
}
