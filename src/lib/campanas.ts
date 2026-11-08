// Resumen "qué campaña trajo qué" a partir de las solicitudes de alta (signup_requests). Puro: se prueba sin base de datos.
export type CampRow = { status: string; amount: number | null; ad_attribution?: any };
export type CampSummary = { campaign: string; source: string; iniciados: number; pagados: number; ingresos: number; conversion: number };

export function resumenCampanas(rows: CampRow[]): CampSummary[] {
  const map = new Map<string, CampSummary>();
  for (const r of rows) {
    const a = r.ad_attribution || {};
    const campaign = a.utm_campaign || (a.fbclid ? "(anuncio de Meta sin nombre)" : "(directo / sin etiqueta)");
    const source = a.utm_source || (a.fbclid ? "meta" : "directo");
    const key = `${source}|${campaign}`;
    const c = map.get(key) || { campaign, source, iniciados: 0, pagados: 0, ingresos: 0, conversion: 0 };
    c.iniciados++;
    if (r.status === "paid") { c.pagados++; c.ingresos += Number(r.amount) || 0; }
    map.set(key, c);
  }
  return Array.from(map.values())
    .map((c) => ({ ...c, conversion: c.iniciados ? Math.round((c.pagados / c.iniciados) * 100) : 0 }))
    .sort((x, y) => y.ingresos - x.ingresos || y.iniciados - x.iniciados);
}
