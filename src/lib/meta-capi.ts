// API de Conversiones de Meta (CAPI): avisa a Meta DESDE EL SERVIDOR que pasó algo (p. ej. una venta).
// Solo servidor. APAGADO por defecto: sin META_PIXEL_ID y META_CAPI_ACCESS_TOKEN no hace nada.
// Privacidad: correo y teléfono se mandan SOLO como huella SHA-256 (nunca en claro). Jamás datos de salud ni notas.
import { createHash } from "crypto";
import { sanitizeAttribution, type AdAttribution } from "@/lib/ad-tracking";

export type MarketingAttribution = AdAttribution & { fbp?: string; fbc?: string; source_url?: string };

const sha = (v: string) => createHash("sha256").update(v).digest("hex");

export function hashEmail(email: unknown): string | null {
  const e = String(email ?? "").trim().toLowerCase();
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) ? sha(e) : null;
}

// Teléfono chileno: solo dígitos con prefijo 56 (9 dígitos -> 569XXXXXXXX). Si no se puede, no se manda.
export function hashPhone(phone: unknown): string | null {
  let d = String(phone ?? "").replace(/\D/g, "");
  if (d.length === 9) d = "56" + d;
  if (d.length === 11 && d.startsWith("56")) return sha(d);
  return d.length >= 8 && d.length <= 15 && String(phone ?? "").trim().startsWith("+") ? sha(d) : null;
}

export function hashName(v: unknown): string | null {
  const s = String(v ?? "").trim().toLowerCase();
  return s ? sha(s) : null;
}

// Limpia lo que manda el navegador: utm_* y fbclid (reusa el seguimiento existente) + fbp/fbc con formato válido.
export function sanitizeMarketing(input: unknown): MarketingAttribution | null {
  if (!input || typeof input !== "object") return null;
  const src = input as Record<string, unknown>;
  const out: MarketingAttribution = { ...(sanitizeAttribution(src) || {}) };
  if (typeof src.fbp === "string" && /^fb\.\d\.\d{10,14}\.\d{5,25}$/.test(src.fbp)) out.fbp = src.fbp;
  if (typeof src.fbc === "string" && /^fb\.\d\.\d{10,14}\.[\w-]{5,200}$/.test(src.fbc)) out.fbc = src.fbc;
  if (typeof src.source_url === "string" && /^https:\/\/[^\s]{1,300}$/.test(src.source_url)) out.source_url = src.source_url.split("#")[0];
  return Object.keys(out).length ? out : null;
}

export type CapiInput = {
  eventName: string;
  eventId: string; // el MISMO que usa el navegador: así Meta cuenta el evento una sola vez
  email?: string | null;
  phone?: string | null;
  firstName?: string | null;
  attribution?: MarketingAttribution | null;
  value?: number; // CLP
  contentName?: string;
  userAgent?: string;
  ip?: string;
};

export function buildCapiPayload(i: CapiInput, nowSec = Math.floor(Date.now() / 1000)) {
  const a = i.attribution || {};
  const user: Record<string, unknown> = {};
  const em = hashEmail(i.email); if (em) user.em = [em];
  const ph = hashPhone(i.phone); if (ph) user.ph = [ph];
  const fn = hashName(i.firstName); if (fn) user.fn = [fn];
  if (a.fbp) user.fbp = a.fbp;
  if (a.fbc) user.fbc = a.fbc;
  else if (a.fbclid) user.fbc = `fb.1.${Date.parse(a.captured_at || "") || nowSec * 1000}.${a.fbclid}`;
  if (i.userAgent) user.client_user_agent = i.userAgent.slice(0, 300);
  if (i.ip) user.client_ip_address = i.ip;
  const custom: Record<string, unknown> = {};
  if (typeof i.value === "number" && i.value >= 0) { custom.value = Math.round(i.value); custom.currency = "CLP"; }
  if (i.contentName) custom.content_name = i.contentName.slice(0, 100);
  if (a.utm_campaign) custom.utm_campaign = a.utm_campaign;
  const ev: Record<string, unknown> = {
    event_name: i.eventName,
    event_time: nowSec,
    event_id: i.eventId,
    action_source: "website",
    user_data: user,
    custom_data: custom,
  };
  if (a.source_url) ev.event_source_url = a.source_url;
  return { data: [ev] };
}

// Nunca lanza ni bloquea el flujo de pago: si algo falla, se anota en el log y listo.
export async function sendCapiEvent(i: CapiInput, fetchImpl: typeof fetch = fetch): Promise<{ sent: boolean; reason?: string }> {
  const pixel = process.env.META_PIXEL_ID || process.env.NEXT_PUBLIC_META_PIXEL_ID;
  const token = process.env.META_CAPI_ACCESS_TOKEN;
  if (!pixel || !token) return { sent: false, reason: "apagado" };
  try {
    const body: Record<string, unknown> = { ...buildCapiPayload(i), access_token: token };
    if (process.env.META_CAPI_TEST_CODE) body.test_event_code = process.env.META_CAPI_TEST_CODE; // solo para "Probar eventos"
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 4000);
    const res = await fetchImpl(`https://graph.facebook.com/v21.0/${encodeURIComponent(pixel)}/events`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: ctl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) { console.error("[meta-capi] Meta respondió", res.status); return { sent: false, reason: `http ${res.status}` }; }
    return { sent: true };
  } catch (e: any) {
    console.error("[meta-capi] no se pudo enviar:", e?.message);
    return { sent: false, reason: "error" };
  }
}
