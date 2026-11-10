import { NextResponse } from "next/server";
import { fetchAllRows } from "@/lib/accounting";
import { roleCan } from "@/lib/empresas/capabilities";
import { badRequest, cleanText, dbErrorResponse, isUuid, readJson } from "@/lib/empresas/errors";
import { requireCompany } from "@/lib/empresas/guard";
import { faltaMigracion } from "@/lib/empresas/settings";
import { createAdminSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const BASE_COLUMNS = "id, name, tax_id, contact_name, phone, email, address, city, customer_type, active";
// Columnas de las migraciones 158 (cartera) y 160 (permiso de WhatsApp). Si faltan, se lee sin ellas.
const COLUMNS = `${BASE_COLUMNS}, assigned_seller_id, whatsapp_opt_in`;

// El vendedor ve su cartera y los clientes sin vendedor; el dueño (y bodega no entra aquí), todos.
export async function GET() {
  const g = await requireCompany("clientes.ver");
  if (!g.ok) return g.response;
  const admin = createAdminSupabase();
  const all = roleCan(g.role, "cartera.ver_todas");
  try {
    const rows = await fetchAllRows(() => {
      let q = admin.from("company_customers").select(COLUMNS).eq("tenant_id", g.tenantId);
      if (!all) q = q.or(`assigned_seller_id.is.null,assigned_seller_id.eq.${g.userId}`);
      return q.order("name");
    });
    return NextResponse.json({ customers: rows });
  } catch (e: any) {
    if (!faltaMigracion(e)) return dbErrorResponse(e, "clientes GET");
    // Sin la 158 todavía no hay cartera: todos ven todos, como antes.
    try {
      const rows = await fetchAllRows(() => admin.from("company_customers").select(BASE_COLUMNS).eq("tenant_id", g.tenantId).order("name"));
      return NextResponse.json({ customers: rows, warning: "Falta aplicar la migración 158." });
    } catch (e2: any) {
      return dbErrorResponse(e2, "clientes GET");
    }
  }
}

export async function POST(req: Request) {
  const g = await requireCompany("clientes.editar");
  if (!g.ok) return g.response;
  const body = await readJson(req);
  const name = cleanText(body?.name, 200);
  if (!name) return badRequest("Escribe el nombre del cliente.");
  const row: Record<string, unknown> = {
    tenant_id: g.tenantId,
    name,
    tax_id: cleanText(body?.taxId, 20),
    contact_name: cleanText(body?.contactName, 200),
    phone: cleanText(body?.phone, 40),
    email: cleanText(body?.email, 200),
    address: cleanText(body?.address, 300),
    city: cleanText(body?.city, 100),
    customer_type: body?.customerType === "distributor" ? "distributor" : "client",
  };
  // Un vendedor que crea un cliente lo deja en su cartera; el dueño puede elegir el vendedor.
  if (roleCan(g.role, "cartera.asignar")) {
    if (isUuid(body?.sellerId)) row.assigned_seller_id = body!.sellerId;
  } else {
    row.assigned_seller_id = g.userId;
  }
  if (body?.whatsappOptIn === true) {
    row.whatsapp_opt_in = true;
    row.whatsapp_opt_in_at = new Date().toISOString();
  }
  const admin = createAdminSupabase();
  let { data, error } = await admin.from("company_customers").insert(row).select(COLUMNS).single();
  if (error && faltaMigracion(error)) {
    // Sin las migraciones nuevas se crea como antes, sin cartera ni permiso.
    delete row.assigned_seller_id; delete row.whatsapp_opt_in; delete row.whatsapp_opt_in_at;
    ({ data, error } = await admin.from("company_customers").insert(row).select(BASE_COLUMNS).single());
  }
  if (error) return dbErrorResponse(error, "clientes POST");
  return NextResponse.json({ customer: data }, { status: 201 });
}
