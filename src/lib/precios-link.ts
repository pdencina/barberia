// Link corto re-booking.cl/precios para campañas de creadores de contenido: lleva a los planes de la landing y deja
// marcado de donde viene el visitante (se guarda en la solicitud de alta y se ve en Super Admin > Campañas).
// Los parametros que ya traiga el link (por ejemplo ?utm_campaign=nombre) mandan sobre los valores por defecto.
export const PRECIOS_DEFAULTS: Record<string, string> = { utm_source: "creador", utm_medium: "contenido", utm_campaign: "precios" };
const PASAN = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "utm_id", "fbclid", "ref", "plan", "seats", "cycle"];

export function preciosDestino(params: URLSearchParams): string {
  const out = new URLSearchParams();
  for (const [k, v] of Object.entries(PRECIOS_DEFAULTS)) out.set(k, v);
  for (const k of PASAN) {
    const v = params.get(k);
    if (v) out.set(k, v.slice(0, 200));
  }
  return `/landing?${out.toString()}#precios`;
}
