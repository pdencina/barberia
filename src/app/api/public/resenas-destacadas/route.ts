import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";
import { elegirDestacadas } from "@/lib/resenas-destacadas";

export const dynamic = "force-dynamic";

// Público: mejores reseñas (4-5 estrellas, con comentario) de un negocio, para la página de reservas.
export async function GET(req: NextRequest) {
  const tenantId = new URL(req.url).searchParams.get("tenantId") || "";
  if (!/^[0-9a-f-]{36}$/i.test(tenantId)) return NextResponse.json([]);
  const supabase = createAdminSupabase();
  try {
    const { data: pros } = await supabase.from("profiles").select("id").eq("tenant_id", tenantId);
    const ids = (pros || []).map((p: any) => p.id);
    if (ids.length === 0) return NextResponse.json([]);
    const { data } = await supabase.from("reviews").select("rating, comment, created_at, client:clients(name)")
      .in("barber_id", ids).eq("public", true).gte("rating", 4).order("created_at", { ascending: false }).limit(200);
    const out = elegirDestacadas((data || []).map((r: any) => ({ rating: Number(r.rating), comment: r.comment, created_at: r.created_at, cliente: r.client?.name ?? null })));
    return NextResponse.json(out, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } });
  } catch { return NextResponse.json([]); }
}
