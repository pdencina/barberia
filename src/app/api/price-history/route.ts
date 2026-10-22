import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, resolveTenantForRequest } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = createAdminSupabase();
  const { searchParams } = new URL(req.url);
  const entityType = searchParams.get("type"); // service, product
  const entityId = searchParams.get("entityId");

  // SEGURIDAD: sin sesion valida no hay negocio. Antes esta ruta no validaba nada y devolvia el historial de precios de todos los negocios.
  const { tenantId } = await resolveTenantForRequest(searchParams.get("tenantId"));
  if (!tenantId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const baseQuery = () =>
    supabase
      .from("price_history")
      .select("*, changed_by_profile:profiles!price_history_changed_by_fkey(name)")
      .order("created_at", { ascending: false })
      .limit(50);

  // Super admin sin negocio elegido ("ALL"): como siempre, sin filtro de negocio.
  if (tenantId === "ALL") {
    let query = baseQuery();
    if (entityType) query = query.eq("entity_type", entityType);
    if (entityId) query = query.eq("entity_id", entityId);
    const { data } = await query;
    return NextResponse.json(data || []);
  }

  // Los registros de price_history no guardan el negocio (tenant_id queda vacio): se acota por los servicios y productos que SI son de este negocio.
  const [svc, prod] = await Promise.all([
    entityType && entityType !== "service" ? Promise.resolve({ data: [] as any[] }) : supabase.from("services").select("id").eq("tenant_id", tenantId),
    entityType && entityType !== "product" ? Promise.resolve({ data: [] as any[] }) : supabase.from("products").select("id").eq("tenant_id", tenantId),
  ]);
  let ids: string[] = [...(svc.data || []), ...(prod.data || [])].map((r: any) => r.id);
  if (entityId) ids = ids.filter((id) => id === entityId);
  if (ids.length === 0) return NextResponse.json([]);

  // Lotes pequenos: una lista larga de ids en .in() supera el largo maximo de la URL.
  const batches: string[][] = [];
  for (let i = 0; i < ids.length; i += 80) batches.push(ids.slice(i, i + 80));
  const results = await Promise.all(
    batches.map((b) => {
      let q = baseQuery().in("entity_id", b);
      if (entityType) q = q.eq("entity_type", entityType);
      return q;
    })
  );
  const rows = results
    .flatMap((r) => r.data || [])
    .sort((a: any, b: any) => String(b.created_at).localeCompare(String(a.created_at)))
    .slice(0, 50);
  return NextResponse.json(rows);
}
