// Frecuencia de visita: cuántas veces al mes viene en promedio cada cliente que vino ese mes.
// Visitas = citas completadas con cliente; promedio = visitas / clientes distintos del mes. Puro, se prueba sin base de datos.

export interface CitaVisita { client_id: string | null; date: string }

export interface MesFrecuencia {
  mes: string;            // «2026-10»
  visitas: number;
  clientes: number;       // clientes distintos que vinieron
  promedio: number;       // visitas por cliente (2 decimales)
  volvieron: number;      // clientes con 2 o más visitas en el mes
  pctVolvieron: number;   // % de los clientes del mes que vino 2 o más veces
  parcial: boolean;       // el mes en curso (aún no termina)
}

export const META_FRECUENCIA = 2;
export const META_INTERMEDIA = 1.5;
// Un mes cuenta como «con flujo real» desde que tiene al menos esta cantidad de citas completadas
// (antes el equipo no cerraba las ventas como ahora y el número saldría artificialmente bajo).
export const MIN_VISITAS_MES_REAL = 50;

const r2 = (n: number) => Math.round(n * 100) / 100;

export function calcularFrecuencia(citas: CitaVisita[], mesActual: string, minVisitas = MIN_VISITAS_MES_REAL): MesFrecuencia[] {
  const porMes = new Map<string, Map<string, number>>();
  for (const c of citas) {
    if (!c.client_id || !c.date) continue;
    const mes = c.date.slice(0, 7);
    const m = porMes.get(mes) || new Map<string, number>();
    m.set(c.client_id, (m.get(c.client_id) || 0) + 1);
    porMes.set(mes, m);
  }
  const filas: MesFrecuencia[] = [];
  for (const [mes, m] of Array.from(porMes.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
    const clientes = m.size;
    const visitas = Array.from(m.values()).reduce((s, n) => s + n, 0);
    const volvieron = Array.from(m.values()).filter((n) => n >= 2).length;
    filas.push({ mes, visitas, clientes, promedio: clientes ? r2(visitas / clientes) : 0, volvieron, pctVolvieron: clientes ? Math.round((volvieron / clientes) * 100) : 0, parcial: mes === mesActual });
  }
  // Se parte desde el primer mes con flujo real; los meses anteriores se descartan.
  const inicio = filas.findIndex((f) => f.visitas >= minVisitas);
  return inicio < 0 ? [] : filas.slice(inicio);
}

// Cuántas visitas más (en total) harían falta este mes para llegar a la meta con los mismos clientes.
export function visitasParaMeta(f: MesFrecuencia, meta = META_FRECUENCIA): number {
  return Math.max(0, Math.ceil(f.clientes * meta - f.visitas));
}

// Promedio de un mes mirando solo hasta cierto día (para comparar un mes en curso con el anterior «a la misma fecha»,
// y no un mes a medias contra uno completo, que siempre saldría peor).
export function promedioHastaDia(citas: CitaVisita[], mes: string, hastaDia: number): { visitas: number; clientes: number; promedio: number } {
  const por = new Map<string, number>();
  for (const c of citas) {
    if (!c.client_id || !c.date || c.date.slice(0, 7) !== mes || Number(c.date.slice(8, 10)) > hastaDia) continue;
    por.set(c.client_id, (por.get(c.client_id) || 0) + 1);
  }
  const clientes = por.size;
  const visitas = Array.from(por.values()).reduce((s, n) => s + n, 0);
  return { visitas, clientes, promedio: clientes ? r2(visitas / clientes) : 0 };
}

export const mesAnteriorDe = (mes: string): string => {
  const [y, m] = mes.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
};
export const diasDelMes = (mes: string): number => { const [y, m] = mes.split("-").map(Number); return new Date(Date.UTC(y, m, 0)).getUTCDate(); };

