import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";
import { elegirDestacadas, intercalar } from "@/lib/resenas-destacadas";
import { resenasDeGoogle } from "@/lib/google-places";
import { googleReviewUrl } from "@/lib/google-review";

export const dynamic = "force-dynamic";

// Público: mejores reseñas (re-booking + Google Maps) de un negocio para la página de reservas, y el link para dejar una en Google.
export async function GET(req: NextRequest) {
  const vacio = { items: [], googleUrl: null, googleRating: null, googleTotal: null };
  const tenantId = new URL(req.url).searchParams.get("tenantId") || "";
  if (!/^[0-9a-f-]{36}$/i.test(tenantId)) return NextResponse.json(vacio);
  const supabase = createAdminSupabase();
  try {
    const { data: pros } = await supabase.from("profiles").select("id").eq("tenant_id", tenantId);
    const ids = (pros || []).map((p: any) => p.id);
    const propias = ids.length === 0 ? [] : elegirDestacadas(((await supabase.from("reviews").select("rating, comment, created_at, client:clients(name)")
      .in("barber_id", ids).eq("public", true).gte("rating", 4).order("created_at", { ascending: false }).limit(200)).data || [])
      .map((r: any) => ({ rating: Number(r.rating), comment: r.comment, created_at: r.created_at, cliente: r.client?.name ?? null })), 8);
    const t: { data: any } = await supabase.from("tenants").select("google_place_id, google_rating, google_reviews_count").eq("id", tenantId).maybeSingle();
    const placeId = t.data?.google_place_id || null;
    const g = await resenasDeGoogle(placeId);
    return NextResponse.json({
      items: intercalar(g.items, propias, 12), googleUrl: googleReviewUrl(placeId), googleRating: g.rating ?? (Number(t.data?.google_rating) || null), googleTotal: g.total ?? (Number(t.data?.google_reviews_count) || null),
    }, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } });
  } catch { return NextResponse.json(vacio); }
}
