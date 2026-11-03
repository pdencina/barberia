// Bloque final del correo de la boleta: agradecimiento + calificación + agendar la próxima cita. Reemplaza al correo aparte
// «Gracias por tu visita» (un solo correo en vez de dos). Pura: se prueba sin enviar nada.
import { armarEnlacesCorreo, type CorreoLinks, type TenantLinks } from "@/lib/post-service-links";

const esc = (v: string) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export interface ThanksParams { links: CorreoLinks; barberName: string; businessName?: string | null; accent: string }

export function receiptThanksHtml({ links, barberName, businessName, accent }: ThanksParams): string {
  const estrellas = [1, 2, 3, 4, 5].map(() => `<a href="${esc(links.reviewUrl)}" style="text-decoration:none;color:#F5B301;font-size:26px;letter-spacing:3px;">★</a>`).join("");
  const sobre = businessName ? ` en <strong style="color:#111827;">${esc(businessName)}</strong>` : "";
  return `
      <tr><td style="padding:24px 36px 0 36px;">
        <div style="background:#F3FAFA;border:1px solid #D7EEEE;border-radius:14px;padding:24px 20px;text-align:center;">
          <div style="font-size:18px;font-weight:800;color:#111827;letter-spacing:-0.2px;">¡Gracias por tu visita! 🙌</div>
          <div style="font-size:14px;color:#6B7280;line-height:1.6;margin-top:8px;">Esperamos que hayas disfrutado tu atención con <strong style="color:#111827;">${esc(barberName)}</strong>${sobre}.<br>${esc(links.intro)}</div>
          <div style="margin-top:14px;">${estrellas}</div>
          <div style="margin-top:14px;">
            <a href="${esc(links.reviewUrl)}" style="display:inline-block;background:${accent};color:#FFFFFF;text-decoration:none;padding:13px 30px;border-radius:10px;font-weight:700;font-size:14px;">${esc(links.reviewLabel)}</a>
          </div>
        </div>
      </td></tr>
      <tr><td align="center" style="padding:18px 36px 8px 36px;">
        <div style="font-size:13px;color:#6B7280;">¿Quieres volver? <a href="${esc(links.bookUrl)}" style="color:${accent};font-weight:700;text-decoration:none;">Agenda tu próxima cita →</a></div>
      </td></tr>`;
}

// Enlaces para un negocio (lee su link de Google Maps y su link de reserva). Tolera que falte la columna de Google Maps.
export async function cargarEnlacesBoleta(supabase: any, tenantId: string | null | undefined, refId: string): Promise<{ links: CorreoLinks; logoUrl: string | null; name: string | null }> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.re-booking.cl";
  let t: any = null;
  if (tenantId) {
    // Sin las migraciones nuevas (Place ID, Google Maps) se prueba con menos columnas hasta que alguna consulta funcione.
    for (const cols of ["logo_url, name, slug, google_maps_url, google_place_id", "logo_url, name, slug, google_maps_url", "logo_url, name, slug"]) {
      const r: { data: any; error: any } = await supabase.from("tenants").select(cols).eq("id", tenantId).maybeSingle();
      if (!r.error) { t = r.data; break; }
    }
  }
  const tenant: TenantLinks | null = t ? { google_maps_url: t.google_maps_url, google_place_id: t.google_place_id, slug: t.slug } : null;
  return { links: armarEnlacesCorreo(appUrl, tenant, refId), logoUrl: t?.logo_url || null, name: t?.name || null };
}
