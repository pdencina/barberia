// Varios grupos de «días sin venir» a la vez (ej. 45–60 y 90–180) en Retención. Puro.
export type Rango = [number, number | null]; // [desde, hasta] — hasta null = sin tope

/** Valida lo que manda el navegador (arreglo, o texto "45-60,90-180,365-"). */
export function parseRangos(v: unknown): Rango[] {
  const lista: any[] = typeof v === "string" ? v.split(",").map((t) => t.split("-")) : Array.isArray(v) ? v : [];
  return lista.slice(0, 20).flatMap((r: any): Rango[] => {
    if (!Array.isArray(r) || r[0] === "" || r[0] === null) return [];
    const a = Number(r[0]);
    const b = r[1] === "" || r[1] === null || r[1] === undefined ? null : Number(r[1]);
    return Number.isFinite(a) && a >= 0 && (b === null || (Number.isFinite(b) && b >= a)) ? [[a, b]] : [];
  });
}

export const rangosATexto = (r: Rango[]) => r.map(([a, b]) => `${a}-${b ?? ""}`).join(",");
export const enRangos = (dias: number, r: Rango[]) => r.some(([a, b]) => dias >= a && (b === null || dias <= b));

/** Une los grupos que se tocan: 45–60 + 60–90 = 45–90. */
export function unirRangos(r: Rango[]): Rango[] {
  const out: Rango[] = [];
  for (const [a, b] of [...r].sort((x, y) => x[0] - y[0])) {
    const u = out[out.length - 1];
    if (u && (u[1] === null || a <= u[1])) u[1] = u[1] === null || b === null ? null : Math.max(u[1], b);
    else out.push([a, b]);
  }
  return out;
}

export function etiquetaRangos(r: Rango[]): string {
  const t = unirRangos(r).map(([a, b]) => (b === null ? `${a}+` : `${a}–${b}`));
  return `${t.length < 2 ? t.join("") : `${t.slice(0, -1).join(", ")} y ${t[t.length - 1]}`} días`;
}
