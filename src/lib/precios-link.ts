// Link corto re-booking.cl/precios para campañas de creadores de contenido: lleva a los planes de la landing y deja
// marcado de donde viene el visitante (se guarda en la solicitud de alta y se ve en Super Admin > Campañas).
// Los parametros que ya traiga el link (por ejemplo ?utm_campaign=nombre) mandan sobre los valores por defecto.
export const PRECIOS_DEFAULTS: Record<string, string> = { utm_source: "creador", utm_medium: "contenido", utm_campaign: "precios" };
const PASAN = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "utm_id", "fbclid", "ref", "plan", "seats", "cycle"];

// ?v=<vendedor>: la visita y la venta quedan a nombre de ese vendedor (utm_source=vendedor, utm_campaign=<slug>).
export const slugVendedorValido = (v: string | null | undefined) => /^[a-z0-9-]{2,40}$/.test(v || "");

export function preciosDestino(params: URLSearchParams): string {
  const out = new URLSearchParams();
  for (const [k, v] of Object.entries(PRECIOS_DEFAULTS)) out.set(k, v);
  const vend = (params.get("v") || "").toLowerCase();
  if (slugVendedorValido(vend)) { out.set("utm_source", "vendedor"); out.set("utm_medium", "vendedor"); out.set("utm_campaign", vend); return `/landing?${out.toString()}#precios`; }
  for (const k of PASAN) {
    const v = params.get(k);
    if (v) out.set(k, v.slice(0, 200));
  }
  return `/landing?${out.toString()}#precios`;
}
