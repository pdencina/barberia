import { createHmac, timingSafeEqual } from "crypto";
import { decryptSecret } from "@/lib/secret-box";

// Abono al reservar (Mercado Pago del NEGOCIO): credenciales y firma del aviso. El calculo del monto vive en deposit-calc.ts (sin dependencias del servidor, para usarlo tambien en la pagina de reservas).
export { calcularAbono } from "@/lib/deposit-calc";
export type { ModoAbono, ConfigAbono } from "@/lib/deposit-calc";

// Firma del aviso (webhook): Mercado Pago llama a una direccion con el negocio y una firma; asi se sabe de que negocio es sin probar los tokens de todos.
const secreto = () => process.env.DEPOSIT_WEBHOOK_SECRET || process.env.PIN_PEPPER || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
export function firmarNegocio(tenantId: string): string {
  return createHmac("sha256", secreto()).update(`deposit:${tenantId}`).digest("hex").slice(0, 32);
}
export function firmaValida(tenantId: string | null | undefined, firma: string | null | undefined): boolean {
  if (!tenantId || !firma || !secreto()) return false;
  const a = Buffer.from(firmarNegocio(tenantId)), b = Buffer.from(String(firma));
  return a.length === b.length && timingSafeEqual(a, b);
}

// Token de cobro del negocio: el propio de «Cobros online» y, si no lo tiene, el del terminal (como funcionaba antes).
export async function cargarCredencialAbono(supabase: any, tenantId: string): Promise<{ token: string | null; origen: "dedicado" | "terminal" | null }> {
  let r: { data: any; error: any } = await supabase.from("tenant_settings").select("mp_online_access_token, mp_access_token").eq("tenant_id", tenantId).maybeSingle();
  if (r.error) r = await supabase.from("tenant_settings").select("mp_access_token").eq("tenant_id", tenantId).maybeSingle();
  let dedicado: string | null = null;
  try { if (r.data?.mp_online_access_token) dedicado = decryptSecret(r.data.mp_online_access_token); } catch { dedicado = null; } // sin llave o dato alterado: no se usa
  if (dedicado) return { token: dedicado, origen: "dedicado" };
  const terminal = r.data?.mp_access_token || null;
  return terminal ? { token: terminal, origen: "terminal" } : { token: null, origen: null };
}
