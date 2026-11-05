// Reseñas de Google Maps de un negocio (Places API nueva). Necesita GOOGLE_PLACES_API_KEY en el servidor; sin ella devuelve vacío.
import { parsePlaceId } from "@/lib/google-review";
import type { ResenaDestacada } from "@/lib/resenas-destacadas";

export interface GoogleResenas { items: ResenaDestacada[]; rating: number | null; total: number | null }

export async function resenasDeGoogle(placeIdRaw: string | null | undefined): Promise<GoogleResenas> {
  const vacio: GoogleResenas = { items: [], rating: null, total: null };
  const key = process.env.GOOGLE_PLACES_API_KEY;
  const placeId = parsePlaceId(placeIdRaw);
  if (!key || !placeId) return vacio;
  try {
    const r = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=es`, {
      headers: { "X-Goog-Api-Key": key, "X-Goog-FieldMask": "rating,userRatingCount,reviews" },
      next: { revalidate: 21600 }, // 6 horas: no se cobra una consulta por cada visita
    });
    if (!r.ok) return vacio;
    const d: any = await r.json();
    const items: ResenaDestacada[] = (d.reviews || [])
      .filter((x: any) => Number(x.rating) >= 4 && String(x.text?.text || x.originalText?.text || "").trim().length >= 20)
      .map((x: any) => ({
        rating: Number(x.rating),
        texto: String(x.text?.text || x.originalText?.text).trim().slice(0, 220),
        autor: String(x.authorAttribution?.displayName || "Cliente de Google"),
        origen: "google" as const,
        foto: typeof x.authorAttribution?.photoUri === "string" && x.authorAttribution.photoUri.startsWith("https://") ? x.authorAttribution.photoUri : null,
      }));
    return { items, rating: typeof d.rating === "number" ? d.rating : null, total: typeof d.userRatingCount === "number" ? d.userRatingCount : null };
  } catch { return vacio; }
}
