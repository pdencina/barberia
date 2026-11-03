// Resumen de las reseñas internas (tabla reviews) de un negocio. Puro: se prueba sin base de datos.
export interface ResenaRow { id: string; rating: number; comment: string | null; created_at: string; barber_id: string; client_name?: string | null }
export interface ResumenResenas {
  total: number; promedio: number;
  distribucion: { estrellas: number; cantidad: number }[];          // 5 a 1
  esteMes: number; mesAnterior: number;
  porMes: { mes: string; cantidad: number; promedio: number }[];    // ultimos N meses, de mas antiguo a mas nuevo
  porProfesional: { id: string; nombre: string; cantidad: number; promedio: number }[];
  recientes: { id: string; rating: number; comment: string; fecha: string; profesional: string; cliente: string }[];
}

const mesChile = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago", year: "numeric", month: "2-digit" }).format(new Date(iso)).slice(0, 7);
const fechaChile = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(new Date(iso));
const sumarMeses = (ym: string, d: number) => { const [y, m] = ym.split("-").map(Number); const t = y * 12 + (m - 1) + d; return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`; };
const redondear = (n: number) => Math.round(n * 100) / 100;

export function resumirResenas(rows: ResenaRow[], barbers: { id: string; name: string }[], hoyChile: string, meses = 12, maxRecientes = 30): ResumenResenas {
  const validas = rows.filter((r) => Number.isFinite(Number(r.rating)) && r.rating >= 1 && r.rating <= 5);
  const total = validas.length;
  const suma = validas.reduce((s, r) => s + r.rating, 0);
  const mesHoy = hoyChile.slice(0, 7);
  const nombre = new Map(barbers.map((b) => [b.id, b.name]));

  const porMesMap = new Map<string, { n: number; s: number }>();
  for (const r of validas) { const m = mesChile(r.created_at); const c = porMesMap.get(m) || { n: 0, s: 0 }; c.n++; c.s += r.rating; porMesMap.set(m, c); }
  const porMes = Array.from({ length: meses }, (_, i) => { const m = sumarMeses(mesHoy, i - (meses - 1)); const c = porMesMap.get(m); return { mes: m, cantidad: c?.n || 0, promedio: c ? redondear(c.s / c.n) : 0 }; });

  const porPro = new Map<string, { n: number; s: number }>();
  for (const r of validas) { const c = porPro.get(r.barber_id) || { n: 0, s: 0 }; c.n++; c.s += r.rating; porPro.set(r.barber_id, c); }

  return {
    total, promedio: total ? redondear(suma / total) : 0,
    distribucion: [5, 4, 3, 2, 1].map((e) => ({ estrellas: e, cantidad: validas.filter((r) => r.rating === e).length })),
    esteMes: porMesMap.get(mesHoy)?.n || 0, mesAnterior: porMesMap.get(sumarMeses(mesHoy, -1))?.n || 0,
    porMes,
    porProfesional: Array.from(porPro.entries()).map(([id, c]) => ({ id, nombre: nombre.get(id) || "Profesional", cantidad: c.n, promedio: redondear(c.s / c.n) })).sort((a, b) => b.cantidad - a.cantidad),
    recientes: [...validas].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, maxRecientes)
      .map((r) => ({ id: r.id, rating: r.rating, comment: (r.comment || "").trim(), fecha: fechaChile(r.created_at), profesional: nombre.get(r.barber_id) || "Profesional", cliente: (r.client_name || "").trim() || "Cliente" })),
  };
}
