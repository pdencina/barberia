// Píxel de Meta en el NAVEGADOR (solo páginas de marketing de re-booking). APAGADO si NEXT_PUBLIC_META_PIXEL_ID está vacío.
// Solo carga si la persona aceptó el aviso de cookies. Nunca se mandan correo, teléfono ni datos de salud desde aquí.
export const META_PIXEL_ID = (process.env.NEXT_PUBLIC_META_PIXEL_ID || "").trim();
export const CONSENT_KEY = "rb_meta_consent"; // "granted" | "denied"
const ATTR_KEY = "rb_mkt_attr";
const UTM = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "utm_id", "fbclid"];

export const validPixelId = (id?: string | null) => /^\d{8,20}$/.test((id || "").trim());
export const pixelEnabled = (id: string = META_PIXEL_ID) => validPixelId(id);

function ls(op: "get" | "set", key: string, val?: string): string | null {
  try { if (op === "set") { window.localStorage.setItem(key, val || ""); return null; } return window.localStorage.getItem(key); } catch { return null; }
}
// La respuesta se guarda también en una cookie de 1 año válida para re-booking.cl y www.re-booking.cl: el almacenamiento local se borra
// (Safari lo limpia a los 7 días, otro dominio o una ventana privada parten de cero) y el aviso volvía a aparecer a cada rato.
const consentCookie = (): string | null => { const m = typeof document !== "undefined" ? document.cookie.match(new RegExp("(?:^|; )" + CONSENT_KEY + "=([^;]*)")) : null; return m ? decodeURIComponent(m[1]) : null; };
function writeConsentCookie(v: string) {
  try {
    const host = window.location.hostname;
    const dom = /(^|\.)re-booking\.cl$/.test(host) ? "; Domain=.re-booking.cl" : "";
    document.cookie = `${CONSENT_KEY}=${v}; Max-Age=31536000; Path=/; SameSite=Lax${dom}${window.location.protocol === "https:" ? "; Secure" : ""}`;
  } catch { /* sin cookies: queda el almacenamiento local */ }
}
export const getConsent = (): "granted" | "denied" | null => {
  const v = ls("get", CONSENT_KEY) || consentCookie();
  if (v !== "granted" && v !== "denied") return null;
  if (!ls("get", CONSENT_KEY)) ls("set", CONSENT_KEY, v); // se recupera el almacenamiento local desde la cookie
  return v;
};
export const setConsent = (v: "granted" | "denied") => { ls("set", CONSENT_KEY, v); writeConsentCookie(v); return null; };

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

const started = new Set<string>();
let stubReady = false;
// Carga Meta una sola vez y registra cada Pixel (el de re-booking o el de un negocio). Sin permiso o sin ID valido no hace nada.
export function loadPixel(id: string = META_PIXEL_ID): boolean {
  if (typeof window === "undefined" || !pixelEnabled(id) || getConsent() !== "granted") return false;
  if (!stubReady && !window.fbq) {
    // Ojo: este archivo corre en modo estricto; la receta oficial de Meta (queue.push.apply(f, ...)) revienta aqui.
    const f: any = (window.fbq = function () { if (f.callMethod) f.callMethod.apply(f, arguments); else f.queue.push(arguments); });
    if (!window._fbq) window._fbq = f;
    f.push = f; f.loaded = true; f.version = "2.0"; f.queue = [];
    const s = document.createElement("script"); s.async = true; s.src = "https://connect.facebook.net/en_US/fbevents.js";
    document.head.appendChild(s);
  }
  stubReady = true;
  if (!started.has(id)) {
    // Apaga el rastreo automatico de Meta (clics en botones y campos de formularios): solo enviamos nuestros eventos.
    window.fbq("set", "autoConfig", false, id);
    window.fbq("init", id);
    started.add(id);
  }
  return true;
}

// Evento estandar SOLO para ese Pixel (trackSingle: nunca se cruza con el Pixel de otro negocio).
export function track(name: string, params?: Record<string, unknown>, id?: string, pixelId: string = META_PIXEL_ID) {
  if (!loadPixel(pixelId)) return;
  window.fbq("trackSingle", pixelId, name, params || {}, id ? { eventID: id } : undefined);
}
