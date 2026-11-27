// Servicios separados por categoría, en el orden en que aparecen; «Sin categoría» al final. Puro.
export function porCategoria<T extends { category?: string | null }>(lista: T[]): Array<{ nombre: string; items: T[] }> {
  const m = new Map<string, T[]>();
  for (const s of lista) {
    const k = String(s.category || "").trim();
    const g = m.get(k);
    if (g) g.push(s); else m.set(k, [s]);
  }
  const sin = m.get("");
  m.delete("");
  const grupos = Array.from(m, ([nombre, items]) => ({ nombre, items }));
  return sin ? [...grupos, { nombre: "Sin categoría", items: sin }] : grupos;
}
