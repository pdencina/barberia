import { redirect } from "next/navigation";

// Compatibilidad: links antiguos re-booking.cl/b/<negocio> → link limpio re-booking.cl/<negocio>
// Los parametros del link (utm_*, fbclid de los anuncios) se conservan: antes se perdian aqui y la reserva no sabia de que anuncio venia.
export default function TenantBookingRedirect({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams || {})) {
    if (k === "tenant") continue;
    const val = Array.isArray(v) ? v[0] : v;
    if (typeof val === "string") qs.set(k, val);
  }
  const rest = qs.toString();
  redirect(`/${params.slug}${rest ? `?${rest}` : ""}`);
}
