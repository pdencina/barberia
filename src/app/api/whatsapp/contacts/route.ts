import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, resolveTenantForRequest } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/accounting";
import { loadVisitInfo } from "@/lib/retention";

// GET: clientes con telefono para la lista de difusion de WhatsApp, con su ultima visita REAL.
export async function GET(req: NextRequest) {
  const supabase = createAdminSupabase();
  const { searchParams } = new URL(req.url);
  // SEGURIDAD: nunca confiar directo en el tenantId de la URL — resolveTenantForRequest lo
  // reemplaza por el negocio real del usuario logueado salvo que sea super_admin.
  const { tenantId } = await resolveTenantForRequest(searchParams.get("tenantId"));

  // Never return contacts across all businesses. Without a concrete tenant, return an
  // empty list instead of everyone (this is the same cross-business leak that let one
  // business broadcast to 647 people from other salons).
  if (!tenantId || tenantId === "ALL") {
    return NextResponse.json([]);
  }

  // Clientes con telefono de ESTE negocio. Se leen por paginas: Supabase entrega como maximo 1.000 filas por consulta y,
  // antes, un negocio con mas clientes quedaba con 1.000 al azar (y la pantalla mostraba "1000").
  // Ley 21.719: se excluye a quien pidio no ser contactado o rechazo las promociones (migracion 101; si falta, se omite).
  const base = () => supabase.from("clients").select("id, name, phone, email").not("phone", "is", null).neq("phone", "").eq("tenant_id", tenantId);
  let clients: any[];
  try {
    clients = await fetchAllRows(() => supabase.from("clients").select("id, name, phone, email, marketing_consent, do_not_contact").not("phone", "is", null).neq("phone", "").eq("tenant_id", tenantId));
    clients = clients.filter((c) => c.do_not_contact !== true && c.marketing_consent !== false);
  } catch {
    clients = await fetchAllRows(base);
  }
  clients.sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "es"));

  // Ultima visita REAL (cita completada o venta cobrada, desde el inicio real del negocio): mismo calculo que Retencion.
  const { lastVisitMap, upcoming } = await loadVisitInfo(supabase, tenantId);

  return NextResponse.json(clients.map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone,
    email: c.email,
    lastVisit: lastVisitMap[c.id] || null,
    hasUpcoming: upcoming.has(c.id),
  })));
}
