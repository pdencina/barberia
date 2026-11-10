// Metricas por vendedor a partir de las solicitudes de alta (signup_requests). Puro: se prueba sin base de datos.
// Una solicitud es de un vendedor si guardo utm_source=vendedor y utm_campaign=<slug del vendedor>.
export type SolicitudRow = { status: string; amount: number | null; plan?: string | null; created_at?: string | null; ad_attribution?: any };
export type VendedorStats = { iniciados: number; pagados: number; ingresos: number; conversion: number; ventas: { fecha: string | null; plan: string | null; monto: number }[] };

export function statsDeVendedor(rows: SolicitudRow[], slug: string): VendedorStats {
  const mias = rows.filter((r) => r.ad_attribution?.utm_source === "vendedor" && r.ad_attribution?.utm_campaign === slug);
  const pagadas = mias.filter((r) => r.status === "paid");
  const ingresos = pagadas.reduce((a, r) => a + (Number(r.amount) || 0), 0);
  return {
    iniciados: mias.length,
    pagados: pagadas.length,
    ingresos,
    conversion: mias.length ? Math.round((pagadas.length / mias.length) * 100) : 0,
    ventas: pagadas.map((r) => ({ fecha: r.created_at ? String(r.created_at).slice(0, 10) : null, plan: r.plan ?? null, monto: Number(r.amount) || 0 })).sort((a, b) => String(b.fecha).localeCompare(String(a.fecha))),
  };
}
