// Link directo para dejar una reseña en Google. Se arma con el ID del lugar (Place ID), que cada negocio pega en Configuración.
const BASE = "https://search.google.com/local/writereview?placeid=";

// Acepta el ID suelto («ChIJ…»), el link completo de reseña («…writereview?placeid=ChIJ…») o un link con «place_id=». Devuelve el ID limpio, o null.
export function parsePlaceId(input: string | null | undefined): string | null {
  const t = String(input ?? "").trim();
  if (!t) return null;
  let candidate = t;
  const m = /[?&](?:placeid|place_id)=([^&#\s]+)/i.exec(t);
  if (m) { try { candidate = decodeURIComponent(m[1]); } catch { candidate = m[1]; } }
  return /^[A-Za-z0-9_-]{20,200}$/.test(candidate) ? candidate : null;
}

export const googleReviewUrl = (placeId: string | null | undefined): string | null => {
  const id = parsePlaceId(placeId);
  return id ? `${BASE}${encodeURIComponent(id)}` : null;
};
