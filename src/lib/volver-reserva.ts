// Al volver de Mercado Pago, las pantallas de resultado llevan al link del negocio (no a /booking a secas, que no sabe de qué negocio es).
// Los datos vienen en la dirección (?n=<negocio>&p=<profesional>&r=<referencia>): solo se aceptan si tienen la forma correcta (nunca se arma un link con texto libre).
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function enlaceDeVuelta(search: string): { href: string; ref: string | null } {
  const q = new URLSearchParams(search);
  const n = q.get("n") || "", p = q.get("p") || "", r = q.get("r") || "";
  const negocio = SLUG.test(n) && n.length >= 3 && n.length <= 40 ? n : null;
  const prof = negocio && SLUG.test(p) && p.length >= 3 && p.length <= 40 ? p : null;
  return { href: negocio ? `/${negocio}${prof ? `/${prof}` : ""}` : "/booking", ref: UUID.test(r) ? r : null };
}
