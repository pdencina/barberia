// Servicios internos: extras que solo se cobran en el Punto de Venta (no se reservan). Pueden durar 0 minutos.
// Puro (salvo leerServicios): se prueba sin base de datos.

export const DURACION_MINIMA_PUBLICA = 5;

// Valida duración según la visibilidad: un servicio público necesita al menos 5 minutos (si no, la agenda no puede reservarlo);
// uno interno puede durar 0.
export function errorDuracion(duration: unknown, internal: boolean): string | null {
  const d = Number(duration);
  if (!Number.isFinite(d) || !Number.isInteger(d) || d < 0 || d > 1440) return "La duración debe ser un número entero de minutos";
  // 0 minutos es válido también en servicios públicos (ej. cejas que no suman tiempo al combinarse).
  // Si la reserva completa suma 0, se usa DURACION_MINIMA_PUBLICA como bloque mínimo.
  return null;
}

export const esInterno = (s: { internal_only?: boolean | null }) => !!s?.internal_only;

// Lee servicios sin los internos, tolerando que la migración 141 aún no exista (sin la columna, todos son públicos).
// `construir(columnas)` debe devolver la consulta de Supabase (sin ejecutar) con las columnas pedidas.
export async function leerServiciosPublicos(construir: (columnas: string) => PromiseLike<{ data: any[] | null; error: any }>, columnas: string) {
  const conColumna = await construir(`${columnas}, internal_only`);
  if (!conColumna.error) return { data: (conColumna.data || []).filter((s: any) => !s.internal_only).map(({ internal_only: _i, ...resto }: any) => resto), error: null };
  const sinColumna = await construir(columnas);
  return { data: sinColumna.data || [], error: sinColumna.error };
}
