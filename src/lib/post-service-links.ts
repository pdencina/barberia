// Enlaces del correo «Gracias por tu visita»: si el negocio tiene su link de Google Maps, la calificación va ahí;
// si no, a la página interna de reseñas. «Agendar nueva cita» va al link de reserva del negocio.
import { googleReviewUrl } from "@/lib/google-review";
export interface TenantLinks { google_maps_url?: string | null; google_place_id?: string | null; slug?: string | null }
export interface CorreoLinks { reviewUrl: string; reviewLabel: string; subject: string; intro: string; bookUrl: string }

const esUrlWeb = (u: string) => { try { const p = new URL(u); return p.protocol === "https:" || p.protocol === "http:"; } catch { return false; } };

export function armarEnlacesCorreo(appUrl: string, tenant: TenantLinks | null | undefined, appointmentId: string): CorreoLinks {
  // Prioridad: link directo de reseña (Place ID) > link de Google Maps del negocio > pagina interna de re-booking.
  const directo = googleReviewUrl(tenant?.google_place_id);
  const maps = String(tenant?.google_maps_url || "").trim();
  const googleUrl = directo || (maps && esUrlWeb(maps) ? maps : null);
  const usaGoogle = !!googleUrl;
  return {
    reviewUrl: googleUrl || `${appUrl}/review/${appointmentId}`,
    reviewLabel: usaGoogle ? "Califícanos en Google Maps ★" : "Califica tu experiencia ★",
    subject: usaGoogle ? "Gracias por tu visita! — Califícanos en Google Maps" : "Gracias por tu visita! — Califica tu experiencia",
    intro: usaGoogle ? "Tu reseña en Google Maps nos ayuda a que más personas nos encuentren!" : "Tu opinion nos ayuda a mejorar!",
    bookUrl: tenant?.slug ? `${appUrl}/${tenant.slug}` : `${appUrl}/booking`,
  };
}
