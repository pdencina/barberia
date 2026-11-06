// Grupos de clientes para medir el crecimiento real:
//  - "nuevo":     nació en re-booking (reserva online, POS o alta manual).
//  - "activo":    se cargó desde un archivo y ya agendó/compró en re-booking.
//  - "cargado":   se cargó desde un archivo y todavía no usa re-booking (sirve para marketing aparte).
export type GrupoCliente = "nuevo" | "activo" | "cargado";
export const GRUPOS: GrupoCliente[] = ["nuevo", "activo", "cargado"];

export const esGrupo = (v: unknown): v is GrupoCliente => typeof v === "string" && (GRUPOS as string[]).includes(v);

export function grupoDe(c: { imported_at?: string | null }, conActividad: boolean): GrupoCliente {
  if (!c.imported_at) return "nuevo";
  return conActividad ? "activo" : "cargado";
}

export interface ResumenGrupos {
  total: number; nuevos: number; activos: number; cargados: number;
  nuevosPorMes: { mes: string; n: number }[];   // clientes nacidos en re-booking, por mes de alta
}

export function resumirGrupos(clientes: { id: string; imported_at?: string | null; created_at?: string | null }[], conActividad: Set<string>, ultimosMeses = 6): ResumenGrupos {
  let nuevos = 0, activos = 0, cargados = 0;
  const porMes = new Map<string, number>();
  for (const c of clientes) {
    const g = grupoDe(c, conActividad.has(c.id));
    if (g === "nuevo") { nuevos++; const m = String(c.created_at || "").slice(0, 7); if (m) porMes.set(m, (porMes.get(m) || 0) + 1); }
    else if (g === "activo") activos++;
    else cargados++;
  }
  const nuevosPorMes = Array.from(porMes.entries()).sort((a, b) => a[0].localeCompare(b[0])).slice(-ultimosMeses).map(([mes, n]) => ({ mes, n }));
  return { total: clientes.length, nuevos, activos, cargados, nuevosPorMes };
}
