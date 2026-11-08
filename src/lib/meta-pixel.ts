// Píxel de Meta en el NAVEGADOR (solo páginas de marketing de re-booking). APAGADO si NEXT_PUBLIC_META_PIXEL_ID está vacío.
// Solo carga si la persona aceptó el aviso de cookies. Nunca se mandan correo, teléfono ni datos de salud desde aquí.
export const META_PIXEL_ID = (process.env.NEXT_PUBLIC_META_PIXEL_ID || "").trim();
export const CONSENT_KEY = "rb_meta_consent"; // "granted" | "denied"
const ATTR_KEY = "rb_mkt_attr";
const UTM = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "utm_id", "fbclid"];

export const pixelEnabled = () => /^\d{8,20}$/.test(META_PIXEL_ID);

function ls(op: "get" | "set", key: string, val?: string): string | null {
  try { if (op === "set") { window.localStorage.setItem(key, val || ""); return null; } return window.localStorage.getItem(key); } catch { return null; }
}
export const getConsent = (): "granted" | "denied" | null => { const v = ls("get", CONSENT_KEY); return v === "granted" || v === "denied" ? v : null; };
export const setConsent = (v: "granted" | "denied") => ls("set", CONSENT_KEY, v);

// Id único por evento: el mismo número lo usa el servidor (CAPI) para que Meta no cuente doble.
export const eventId = (name: string, key?: string) => `${name}_${key || Math.random().toString(36).slice(2) + Date.now().toString(36)}`;

function cookie(name: string): string {
  const m = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
  return m ? decodeURIComponent(m[1]) : "";
}

// Guarda de qué anuncio vino (utm_* / fbclid del link). Es primera parte y sin datos personales: se guarda siempre.
export function captureAttribution(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const q = new URLSearchParams(window.location.search);
  const fresh: Record<string, string> = {};
  for (const k of UTM) { const v = q.get(k); if (v) fresh[k] = v.slice(0, 200); }
  if (Object.keys(fresh).length) {
    fresh.landing = window.location.pathname.slice(0, 120);
    ls("set", ATTR_KEY, JSON.stringify(fresh));
    return fresh;
  }
  try { return JSON.parse(ls("get", ATTR_KEY) || "{}"); } catch { return {}; }
}

// Lo que se manda al servidor al pagar. fbp/fbc solo existen si el usuario aceptó cookies.
export function marketingPayload(): Record<string, string> {
  const a = captureAttribution();
  const out: Record<string, string> = { ...a, source_url: window.location.href.split("#")[0].split("?")[0] };
  if (getConsent() === "granted") {
    const fbp = cookie("_fbp"); const fbc = cookie("_fbc");
    if (fbp) out.fbp = fbp;
    if (fbc) out.fbc = fbc;
  }
  return out;
}

declare global { interface Window { fbq?: any; _fbq?: any } }

let loaded = false;
export function loadPixel(): boolean {
  if (typeof window === "undefined" || !pixelEnabled() || getConsent() !== "granted") return false;
  if (loaded || window.fbq) return true;
  const f: any = (window.fbq = function () { (f.callMethod ? f.callMethod : f.queue.push).apply(f, arguments); });
  if (!window._fbq) window._fbq = f;
  f.push = f; f.loaded = true; f.version = "2.0"; f.queue = [];
  const s = document.createElement("script"); s.async = true; s.src = "https://connect.facebook.net/en_US/fbevents.js";
  document.head.appendChild(s);
  window.fbq("init", META_PIXEL_ID);
  loaded = true;
  return true;
}

// Evento estándar de Meta. No hace nada si el píxel está apagado o no hay permiso.
export function track(name: string, params?: Record<string, unknown>, id?: string) {
  if (!loadPixel()) return;
  window.fbq("track", name, params || {}, id ? { eventID: id } : undefined);
}
