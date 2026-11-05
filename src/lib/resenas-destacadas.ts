// Reseñas que se muestran en la página de reservas para dar confianza. Puro: se prueba sin base de datos.
export interface ResenaPublica { rating: number; comment: string | null; created_at: string; cliente: string | null }
export interface ResenaDestacada { rating: number; texto: string; autor: string }

// «Juan Pérez González» -> «Juan P.» (no se publica el nombre completo del cliente)
export function nombreCorto(n: string | null | undefined): string {
  const p = (n || "").trim().split(/\s+/).filter(Boolean);
  if (p.length === 0) return "Cliente";
  const first = p[0].charAt(0).toUpperCase() + p[0].slice(1).toLowerCase();
  return p.length > 1 ? `${first} ${p[1].charAt(0).toUpperCase()}.` : first;
}

export function elegirDestacadas(rows: ResenaPublica[], max = 10): ResenaDestacada[] {
  return rows
    .filter((r) => r.rating >= 4 && (r.comment || "").trim().length >= 20)
    .sort((a, b) => b.rating - a.rating || b.created_at.localeCompare(a.created_at))
    .slice(0, max)
    .map((r) => ({ rating: r.rating, texto: (r.comment || "").trim().slice(0, 220), autor: nombreCorto(r.cliente) }));
}
