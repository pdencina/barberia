// Resumen de cada cliente para la lista: veces que vino, ticket promedio, % de asistencia y total gastado. Puro: se prueba sin base de datos.
import { afectaAsistencia } from "@/lib/cancel-reasons";

export interface CitaStat { client_id: string; status: string; cancel_reason?: string | null }
export interface VentaStat { client_id: string; total: number }
export interface StatsCliente {
  visitas: number;            // veces que vino: citas completadas (o sus ventas, si son más: hay ventas sin cita)
  ventas: number;
  gastado: number;            // pesos
  ticket: number | null;      // gastado / ventas
  asistencia: number | null;  // % = completadas / (completadas + faltas del cliente); null si no tiene citas que cuenten
}
export type OrdenCliente = "nombre" | "visitas" | "ticket" | "asistencia" | "gastado";
export const ORDENES_CLIENTE: OrdenCliente[] = ["nombre", "visitas", "ticket", "asistencia", "gastado"];
export const esOrdenCliente = (v: unknown): v is OrdenCliente => typeof v === "string" && (ORDENES_CLIENTE as string[]).includes(v);
export const esOrdenPorStats = (v: unknown): boolean => esOrdenCliente(v) && v !== "nombre";

export const statsVacias = (): StatsCliente => ({ visitas: 0, ventas: 0, gastado: 0, ticket: null, asistencia: null });

export function calcularStats(citas: CitaStat[], ventas: VentaStat[]): Map<string, StatsCliente> {
  const comp = new Map<string, number>(), faltas = new Map<string, number>();
  for (const c of citas) {
    if (!c.client_id) continue;
    if (c.status === "completed") comp.set(c.client_id, (comp.get(c.client_id) || 0) + 1);
    else if (afectaAsistencia(c)) faltas.set(c.client_id, (faltas.get(c.client_id) || 0) + 1);
  }
  const nv = new Map<string, number>(), gasto = new Map<string, number>();
  for (const v of ventas) {
    if (!v.client_id) continue;
    nv.set(v.client_id, (nv.get(v.client_id) || 0) + 1);
    gasto.set(v.client_id, (gasto.get(v.client_id) || 0) + (Number(v.total) || 0));
  }
  const out = new Map<string, StatsCliente>();
  for (const id of Array.from(new Set([...Array.from(comp.keys()), ...Array.from(faltas.keys()), ...Array.from(nv.keys())]))) {
    const c = comp.get(id) || 0, f = faltas.get(id) || 0, n = nv.get(id) || 0, g = gasto.get(id) || 0;
    out.set(id, { visitas: Math.max(c, n), ventas: n, gastado: Math.round(g), ticket: n > 0 ? Math.round(g / n) : null, asistencia: c + f > 0 ? Math.round((c / (c + f)) * 100) : null });
  }
  return out;
}

// Ordena por el criterio elegido; los clientes sin dato (sin ticket o sin asistencia) quedan siempre al final.
export function ordenarClientes<T extends { id: string; name?: string | null }>(lista: T[], stats: Map<string, StatsCliente>, orden: OrdenCliente, asc: boolean): T[] {
  const nombre = (a: T, b: T) => String(a.name || "").localeCompare(String(b.name || ""), "es");
  if (orden === "nombre") return [...lista].sort((a, b) => (asc ? nombre(a, b) : nombre(b, a)));
  const val = (c: T): number | null => { const s = stats.get(c.id) || statsVacias(); return orden === "visitas" ? s.visitas : orden === "gastado" ? s.gastado : orden === "ticket" ? s.ticket : s.asistencia; };
  return [...lista].sort((a, b) => {
    const x = val(a), y = val(b);
    if (x === null && y === null) return nombre(a, b);
    if (x === null) return 1;
    if (y === null) return -1;
    return (asc ? x - y : y - x) || nombre(a, b);
  });
}
