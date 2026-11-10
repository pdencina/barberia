// Envio de pasos del embudo desde el navegador. Solo corre si la visita llego por un link de vendedor o creador
// (utm_source=vendedor|creador, guardado por la landing) y la persona no rechazo las cookies. Nunca bloquea ni rompe la pagina.
const ATTR_KEY = "rb_mkt_attr";
const VISIT_KEY = "rb_visit";
const CONSENT_KEY = "rb_meta_consent";

function leer(k: string): string | null { try { return window.localStorage.getItem(k); } catch { return null; } }
function guardar(k: string, v: string) { try { window.localStorage.setItem(k, v); } catch {} }

export function visitaActual(): { visit: string; source: string; campaign: string } | null {
  try {
    if (leer(CONSENT_KEY) === "denied") return null;
    const a = JSON.parse(leer(ATTR_KEY) || "{}");
    const source = String(a.utm_source || "").toLowerCase();
    if (source !== "vendedor" && source !== "creador") return null;
    let visit = leer(VISIT_KEY) || "";
    if (!/^[a-f0-9]{16,40}$/.test(visit)) {
      visit = Array.from(crypto.getRandomValues(new Uint8Array(16))).map((b) => b.toString(16).padStart(2, "0")).join("");
      guardar(VISIT_KEY, visit);
    }
    return { visit, source, campaign: String(a.utm_campaign || "") };
  } catch { return null; }
}

export function pasoEmbudo(step: string, plan?: string) {
  const v = visitaActual();
  if (!v) return;
  try {
    const body = JSON.stringify({ ...v, step, plan });
    if (navigator.sendBeacon) navigator.sendBeacon("/api/public/embudo", new Blob([body], { type: "application/json" }));
    else fetch("/api/public/embudo", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
  } catch {}
}
