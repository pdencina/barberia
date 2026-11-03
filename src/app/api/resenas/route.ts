import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, isManagerLevel, resolveTenantForRequest } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/accounting";
import { todayInChile } from "@/lib/utils";
import { resumirResenas } from "@/lib/resenas";
import { googleReviewUrl } from "@/lib/google-review";

export const dynamic = "force-dynamic";

// Reseñas internas (las de la página «Califica tu experiencia») del negocio, para administración y recepción. Solo lectura.
// El negocio sale de la sesión; las reseñas se acotan por los profesionales del negocio.
export async function GET(req: NextRequest) {
  const { ok } = await isManagerLevel();
  if (!ok) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const { tenantId, denied } = await resolveTenantForRequest(new URL(req.url).searchParams.get("tenantId"));
  if (denied || !tenantId || tenantId === "ALL") return NextResponse.json({ error: "Elige un negocio" }, { status: 400 });

  const supabase = createAdminSupabase();
  try {
    const { data: pros } = await supabase.from("profiles").select("id, name").eq("tenant_id", tenantId);
    const barbers = (pros || []) as { id: string; name: string }[];
    const ids = barbers.map((b) => b.id);
    const rows = ids.length === 0 ? [] : await fetchAllRows<any>(() =>
      supabase.from("reviews").select("id, rating, comment, created_at, barber_id, client:clients(name)").in("barber_id", ids));
    const resumen = resumirResenas(rows.map((r: any) => ({ id: r.id, rating: Number(r.rating), comment: r.comment, created_at: r.created_at, barber_id: r.barber_id, client_name: r.client?.name })), barbers, todayInChile(), 12);
    // A dónde manda el correo a calificar: Google Maps (si el negocio lo tiene cargado) o la página interna.
    let googleMapsUrl: string | null = null, googleCount: number | null = null;
    for (const cols of ["google_maps_url, google_reviews_count, google_place_id", "google_maps_url, google_reviews_count"]) {
      const t: { data: any; error: any } = await supabase.from("tenants").select(cols).eq("id", tenantId).maybeSingle();
      if (!t.error) { googleMapsUrl = googleReviewUrl(t.data?.google_place_id) || t.data?.google_maps_url || null; googleCount = t.data?.google_reviews_count ?? null; break; }
    }
    return NextResponse.json({ ...resumen, googleMapsUrl, googleCount });
  } catch { return NextResponse.json({ error: "No se pudieron cargar las reseñas" }, { status: 500 }); }
}
