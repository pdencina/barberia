// Enlaces del correo «Gracias por tu visita»: si el negocio tiene su link de Google Maps, la calificación va ahí;
// si no, a la página interna de reseñas. «Agendar nueva cita» va al link de reserva del negocio.
export interface TenantLinks { google_maps_url?: string | null; slug?: string | null }
export interface CorreoLinks { reviewUrl: string; reviewLabel: string; subject: string; intro: string; bookUrl: string }

const esUrlWeb = (u: string) => { try { const p = new URL(u); return p.protocol === "https:" || p.protocol === "http:"; } catch { return false; } };

export function armarEnlacesCorreo(appUrl: string, tenant: TenantLinks | null | undefined, appointmentId: string): CorreoLinks {
  const maps = String(tenant?.google_maps_url || "").trim();
  const usaGoogle = !!maps && esUrlWeb(maps);
  return {
    reviewUrl: usaGoogle ? maps : `${appUrl}/review/${appointmentId}`,
    reviewLabel: usaGoogle ? "Califícanos en Google Maps ★" : "Califica tu experiencia ★",
    subject: usaGoogle ? "Gracias por tu visita! — Califícanos en Google Maps" : "Gracias por tu visita! — Califica tu experiencia",
    intro: usaGoogle ? "Tu reseña en Google Maps nos ayuda a que más personas nos encuentren!" : "Tu opinion nos ayuda a mejorar!",
    bookUrl: tenant?.slug ? `${appUrl}/b/${tenant.slug}` : `${appUrl}/booking`,
  };
}
